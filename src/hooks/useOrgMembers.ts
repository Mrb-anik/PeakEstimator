/**
 * useOrgMembers.ts
 * ─────────────────────────────────────────────────────────────────
 * Hook for managing team members within an organization.
 * 
 * Used by: Settings > Team tab (Phase 2), OrgManagement page
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../api/supabase';
import { useOrganization } from '../providers/OrganizationProvider';
import type { Profile } from '../types';
import type { UserRole } from '../lib/permissionGuard';
import { toast } from 'sonner';

export interface OrgMember extends Profile {
  member_role?: UserRole;
  accepted_at?: string | null;
}

export function useOrgMembers() {
  const { organization } = useOrganization();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!organization?.id) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMembers((data as OrgMember[]) ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load members';
      console.error('[useOrgMembers]', msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const updateMemberRole = async (memberId: string, role: UserRole): Promise<void> => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', memberId)
        .eq('organization_id', organization?.id ?? '');

      if (error) throw error;
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
      toast.success('Role updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update role';
      toast.error(msg);
    }
  };

  const removeMember = async (memberId: string): Promise<void> => {
    if (!confirm('Remove this member from your organization?')) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ organization_id: null, role: 'viewer', updated_at: new Date().toISOString() })
        .eq('id', memberId)
        .eq('organization_id', organization?.id ?? '');

      if (error) throw error;
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success('Member removed from organization');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove member';
      toast.error(msg);
    }
  };

  return {
    members,
    loading,
    fetchMembers,
    updateMemberRole,
    removeMember,
    memberCount: members.length,
  };
}
