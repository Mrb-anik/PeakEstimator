import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../api/supabase';

export type UserRole =
  | 'platform_owner'
  | 'super_admin'
  | 'agency_admin'
  | 'organization_owner'
  | 'admin'
  | 'manager'
  | 'sales_manager'
  | 'estimator'
  | 'sales_rep'
  | 'technician'
  | 'viewer';

export type Permission =
  | 'dashboard.view'
  | 'organizations.view_all'
  | 'organizations.manage'
  | 'organizations.suspend'
  | 'organizations.impersonate'
  | 'organizations.clone'
  | 'organizations.merge'
  | 'organizations.export'
  | 'users.view_all'
  | 'users.manage'
  | 'users.reset_passwords'
  | 'users.force_mfa'
  | 'users.force_logout'
  | 'features.manage'
  | 'features.lock'
  | 'billing.view_all'
  | 'billing.manage'
  | 'billing.set_plans'
  | 'audit.view_global'
  | 'security.monitor_sessions'
  | 'integrations.manage_global'
  | 'white_label.manage'
  | 'templates.push_global'
  | 'pricing.push_presets'
  | 'estimator.push_formulas'
  | 'materials.push_database'
  | 'labor.push_presets'
  | 'analytics.view_global'
  | 'system.monitor_health'
  | 'api.manage_keys'
  | 'api.manage_limits'
  | 'ai.manage_quotas'
  | 'crm.view'
  | 'crm.manage'
  | 'customers.manage'
  | 'projects.view'
  | 'projects.manage'
  | 'estimates.view'
  | 'estimates.create'
  | 'estimates.update'
  | 'estimates.delete'
  | 'invoices.manage'
  | 'scheduling.manage'
  | 'automation.manage'
  | 'files.manage'
  | 'reports.view'
  | 'settings.manage'
  | 'create_proposals'
  | 'edit_proposals'
  | 'delete_proposals'
  | 'send_proposals'
  | 'lock_proposals'
  | 'edit_line_items'
  | 'manage_price_book'
  | 'use_templates'
  | 'manage_templates'
  | 'use_ai_scope'
  | 'manage_ai_limits'
  | 'view_analytics'
  | 'export_analytics'
  | 'invite_members'
  | 'manage_members'
  | 'manage_roles'
  | 'manage_feature_flags'
  | 'view_audit_logs'
  | 'manage_system_settings'
  | 'manage_billing'
  | 'impersonate_users'
  | 'manage_all_organizations'
  | 'suspend_organizations'
  | 'access_platform_analytics'
  | 'use_field_mode';

const parentPermissions: Permission[] = [
  'dashboard.view',
  'organizations.view_all', 'organizations.manage', 'organizations.suspend', 'organizations.impersonate',
  'organizations.clone', 'organizations.merge', 'organizations.export',
  'users.view_all', 'users.manage', 'users.reset_passwords', 'users.force_mfa', 'users.force_logout',
  'features.manage', 'features.lock',
  'billing.view_all', 'billing.manage', 'billing.set_plans',
  'audit.view_global', 'security.monitor_sessions',
  'integrations.manage_global', 'white_label.manage',
  'templates.push_global', 'pricing.push_presets', 'estimator.push_formulas', 'materials.push_database', 'labor.push_presets',
  'analytics.view_global', 'system.monitor_health',
  'api.manage_keys', 'api.manage_limits', 'ai.manage_quotas',
  'manage_feature_flags', 'view_audit_logs', 'manage_system_settings', 'manage_billing',
  'impersonate_users', 'manage_all_organizations', 'suspend_organizations', 'access_platform_analytics',
];

const ownerPermissions: Permission[] = [
  'dashboard.view', 'crm.view', 'crm.manage', 'customers.manage',
  'projects.view', 'projects.manage',
  'estimates.view', 'estimates.create', 'estimates.update', 'estimates.delete',
  'invoices.manage', 'scheduling.manage', 'automation.manage', 'files.manage', 'reports.view', 'settings.manage',
  'billing.manage',
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
];

const managerPermissions: Permission[] = [
  'dashboard.view', 'crm.view', 'crm.manage', 'customers.manage',
  'projects.view', 'projects.manage',
  'estimates.view', 'estimates.create', 'estimates.update',
  'scheduling.manage', 'automation.manage', 'files.manage', 'reports.view',
  'create_proposals', 'edit_proposals', 'send_proposals', 'lock_proposals',
  'edit_line_items',
  'use_templates',
  'use_ai_scope',
  'view_analytics', 'export_analytics',
  'invite_members',
  'use_field_mode',
];

const ALL_PERMISSIONS = new Set<Permission>([
  ...parentPermissions,
  ...ownerPermissions,
  'organizations.clone', 'organizations.merge', 'organizations.export',
]);

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  platform_owner: ALL_PERMISSIONS,
  super_admin: ALL_PERMISSIONS,
  agency_admin: new Set(parentPermissions),
  organization_owner: new Set(ownerPermissions),
  admin: new Set(ownerPermissions),
  manager: new Set(managerPermissions),
  sales_manager: new Set(managerPermissions),
  estimator: new Set<Permission>([
    'dashboard.view', 'projects.view',
    'estimates.view', 'estimates.create', 'estimates.update',
    'create_proposals', 'edit_proposals', 'send_proposals',
    'edit_line_items',
    'use_templates',
    'use_ai_scope',
    'view_analytics',
    'use_field_mode',
  ]),
  sales_rep: new Set<Permission>([
    'dashboard.view', 'crm.view', 'crm.manage', 'customers.manage',
    'projects.view', 'estimates.view', 'estimates.create',
    'create_proposals', 'send_proposals',
    'use_templates',
    'view_analytics',
  ]),
  technician: new Set<Permission>([
    'dashboard.view', 'projects.view', 'estimates.view',
    'use_field_mode',
    'view_analytics',
  ]),
  viewer: new Set<Permission>([
    'dashboard.view', 'projects.view', 'estimates.view', 'reports.view',
    'view_analytics',
  ]),
};

export const ROLE_RANK: Record<UserRole, number> = {
  platform_owner: 10,
  super_admin: 9,
  agency_admin: 8,
  organization_owner: 7,
  admin: 7,
  manager: 5,
  sales_manager: 5,
  estimator: 3,
  sales_rep: 3,
  technician: 2,
  viewer: 1,
};

export function hasPermission(
  role: UserRole | null | undefined,
  permission: Permission,
  overrides?: Record<string, boolean> | null,
  parentRestrictions?: Record<string, boolean> | null,
): boolean {
  if (!role) return false;
  if (parentRestrictions?.[permission] === false) return false;
  if (typeof overrides?.[permission] === 'boolean') return overrides[permission];
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function isAtLeastRole(
  role: UserRole | null | undefined,
  minimum: UserRole
): boolean {
  if (!role) return false;
  return (ROLE_RANK[role] ?? 0) >= ROLE_RANK[minimum];
}

export function isPlatformStaff(role: UserRole | null | undefined): boolean {
  return role === 'platform_owner' || role === 'super_admin' || role === 'agency_admin';
}

export function isOrgAdmin(role: UserRole | null | undefined): boolean {
  return role === 'organization_owner' || role === 'admin' || role === 'platform_owner' || role === 'super_admin';
}

export interface PermissionState {
  role: UserRole | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  isAtLeast: (minimum: UserRole) => boolean;
  isPlatformStaff: boolean;
  isOrgAdmin: boolean;
}

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
        const resolvedRole = profile.role ?? (profile.is_admin ? 'organization_owner' : 'viewer');
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
