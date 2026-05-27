/**
 * permissionGuard.ts
 * ─────────────────────────────────────────────────────────────────
 * Centralized RBAC — the single permission enforcement layer.
 *
 * ROLE HIERARCHY (highest → lowest):
 *   platform_owner → super_admin → admin → sales_manager → estimator → technician → viewer
 *
 * platform_owner: internal PeakEstimator staff only.
 *   - Identified by profiles.role = 'platform_owner'
 *   - NOT identified by profiles.is_admin — that field is deprecated
 *     for authorization purposes and kept only for backward compat
 *
 * Usage (React hook):
 *   const { can, role } = usePermissions();
 *   if (can('manage_feature_flags')) { ... }
 *
 * Usage (guard function, non-React):
 *   hasPermission(profile, 'edit_proposals')
 * ─────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../api/supabase';

// ─── Role types ────────────────────────────────────────────────────

export type UserRole =
  | 'platform_owner'   // PeakEstimator internal staff — all access
  | 'super_admin'      // Legacy alias — treated as platform_owner
  | 'admin'            // Organization owner / org admin
  | 'sales_manager'
  | 'estimator'
  | 'technician'
  | 'viewer';

// ─── Permission definitions ────────────────────────────────────────

export type Permission =
  // Proposals
  | 'create_proposals'
  | 'edit_proposals'
  | 'delete_proposals'
  | 'send_proposals'
  | 'lock_proposals'
  // Line items
  | 'edit_line_items'
  // Price book
  | 'manage_price_book'
  // Templates
  | 'use_templates'
  | 'manage_templates'
  // AI
  | 'use_ai_scope'
  | 'manage_ai_limits'
  // Analytics
  | 'view_analytics'
  | 'export_analytics'
  // Team / org
  | 'invite_members'
  | 'manage_members'
  | 'manage_roles'
  // Admin
  | 'manage_feature_flags'
  | 'view_audit_logs'
  | 'manage_system_settings'
  | 'manage_billing'
  // Platform owner only
  | 'impersonate_users'
  | 'manage_all_organizations'
  | 'suspend_organizations'
  | 'access_platform_analytics'
  // Field mode
  | 'use_field_mode';

// ─── Permission matrix ─────────────────────────────────────────────

const ALL_PERMISSIONS = new Set<Permission>([
  'create_proposals', 'edit_proposals', 'delete_proposals', 'send_proposals', 'lock_proposals',
  'edit_line_items',
  'manage_price_book',
  'use_templates', 'manage_templates',
  'use_ai_scope', 'manage_ai_limits',
  'view_analytics', 'export_analytics',
  'invite_members', 'manage_members', 'manage_roles',
  'manage_feature_flags', 'view_audit_logs', 'manage_system_settings', 'manage_billing',
  'impersonate_users', 'manage_all_organizations', 'suspend_organizations', 'access_platform_analytics',
  'use_field_mode',
]);

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  platform_owner: ALL_PERMISSIONS,

  super_admin: ALL_PERMISSIONS, // Backward compat alias

  admin: new Set<Permission>([
    'create_proposals', 'edit_proposals', 'delete_proposals', 'send_proposals', 'lock_proposals',
    'edit_line_items',
    'manage_price_book',
    'use_templates', 'manage_templates',
    'use_ai_scope', 'manage_ai_limits',
    'view_analytics', 'export_analytics',
    'invite_members', 'manage_members', 'manage_roles',
    'view_audit_logs',
    'manage_billing',
    'use_field_mode',
  ]),

  sales_manager: new Set<Permission>([
    'create_proposals', 'edit_proposals', 'send_proposals', 'lock_proposals',
    'edit_line_items',
    'use_templates',
    'use_ai_scope',
    'view_analytics', 'export_analytics',
    'invite_members',
    'use_field_mode',
  ]),

  estimator: new Set<Permission>([
    'create_proposals', 'edit_proposals', 'send_proposals',
    'edit_line_items',
    'use_templates',
    'use_ai_scope',
    'view_analytics',
    'use_field_mode',
  ]),

  technician: new Set<Permission>([
    'use_field_mode',
    'view_analytics',
  ]),

  viewer: new Set<Permission>([
    'view_analytics',
  ]),
};

// ─── Role rank ─────────────────────────────────────────────────────

export const ROLE_RANK: Record<UserRole, number> = {
  platform_owner: 7,
  super_admin: 6,
  admin: 5,
  sales_manager: 4,
  estimator: 3,
  technician: 2,
  viewer: 1,
};

// ─── Pure guard functions ──────────────────────────────────────────

export function hasPermission(
  role: UserRole | null | undefined,
  permission: Permission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function isAtLeastRole(
  role: UserRole | null | undefined,
  minimum: UserRole
): boolean {
  if (!role) return false;
  return (ROLE_RANK[role] ?? 0) >= ROLE_RANK[minimum];
}

/** Returns true if the role can access the admin portal */
export function isPlatformStaff(role: UserRole | null | undefined): boolean {
  return role === 'platform_owner' || role === 'super_admin';
}

/** Returns true if the role can manage their own organization */
export function isOrgAdmin(role: UserRole | null | undefined): boolean {
  return isAtLeastRole(role, 'admin');
}

// ─── React hook ────────────────────────────────────────────────────

export interface PermissionState {
  role: UserRole | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  isAtLeast: (minimum: UserRole) => boolean;
  isPlatformStaff: boolean;
  isOrgAdmin: boolean;
}

/**
 * React hook that reads the current user's role from Supabase profiles
 * and exposes a typed `can()` helper for UI permission gating.
 *
 * Prefers reading from the AuthProvider profile if available to avoid
 * an extra DB call. Falls back to a direct query if needed.
 *
 * @example
 * const { can, isAtLeast } = usePermissions();
 * {can('manage_feature_flags') && <FeatureFlagsPanel />}
 * {isAtLeast('admin') && <OrgSettings />}
 */
export function usePermissions(): PermissionState {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadRole = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mountedRef.current) {
        setLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', user.id)
        .single();

      if (!mountedRef.current) return;

      if (error || !profile) {
        setRole('viewer');
      } else {
        // Backward compat: if no role but is_admin = true, treat as admin
        const resolvedRole = profile.role ??
          (profile.is_admin ? 'admin' : 'viewer');
        setRole(resolvedRole as UserRole);
      }
    } catch (err) {
      console.error('[usePermissions] Error loading role:', err);
      if (mountedRef.current) setRole('viewer');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      loadRole();
    });

    return () => subscription.unsubscribe();
  }, [loadRole]);

  return {
    role,
    loading,
    can: (permission: Permission) => hasPermission(role, permission),
    isAtLeast: (minimum: UserRole) => isAtLeastRole(role, minimum),
    isPlatformStaff: isPlatformStaff(role),
    isOrgAdmin: isOrgAdmin(role),
  };
}
