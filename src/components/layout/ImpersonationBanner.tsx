/**
 * ImpersonationBanner.tsx
 * ─────────────────────────────────────────────────────────────────
 * Visible banner shown when an admin is impersonating another user.
 * Always rendered at the top of AppLayout when impersonation is active.
 *
 * Safety guarantees:
 *   - Cannot be dismissed — always visible during impersonation
 *   - Shows who is being impersonated and when it started
 *   - "Exit" button immediately clears impersonation state
 *   - Impersonation automatically expires after 2 hours (enforced
 *     by OrganizationProvider's session expiry logic)
 * ─────────────────────────────────────────────────────────────────
 */

import { LogOut, ShieldAlert, Clock } from 'lucide-react';
import { useOrganization } from '../../providers/OrganizationProvider';

export function ImpersonationBanner() {
  const { impersonation, stopImpersonation } = useOrganization();

  if (!impersonation) return null;

  const { targetProfile, startedAt } = impersonation;

  const startTime = new Date(startedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black">
      <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">Admin View Active</span>
          </div>
          <span className="text-sm opacity-80">
            Viewing as{' '}
            <strong className="font-bold">
              {targetProfile.full_name || targetProfile.email}
            </strong>
            {targetProfile.company_name && (
              <span className="opacity-70"> ({targetProfile.company_name})</span>
            )}
          </span>
          <span className="hidden sm:flex items-center gap-1 text-xs opacity-60">
            <Clock className="w-3 h-3" />
            since {startTime}
          </span>
        </div>

        <button
          onClick={stopImpersonation}
          className="flex items-center gap-1.5 px-3 py-1 bg-black/20 hover:bg-black/30 rounded-md text-sm font-medium transition-colors shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          Exit View
        </button>
      </div>
    </div>
  );
}

export default ImpersonationBanner;
