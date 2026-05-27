# PeakEstimator — Phase 2 Changelog

## Summary
Phase 2 builds on Phase 1's foundations with:
- Admin portal tab extraction (4 tabs fully extracted from 4,454-line monolith)
- Organization sub-account management UI
- Platform-wide usage & revenue metrics dashboard
- Feature flag management UI
- Audit log viewer
- Usage metering system (Edge Function + DB triggers)
- Team management hooks

All changes are backward-compatible.

---

## 🟢 New Admin Portal Tabs (Extracted)

### SubAccountsTab (`src/pages/admin/tabs/SubAccountsTab.tsx`)
**Replaces:** `AdminPortal.tsx` sub_accounts section (~400 lines)
- Full org CRUD (create, edit, delete)
- Per-org billing tier selector (instant update)
- Per-org feature flag overrides modal
- Per-org AI token limit controls with presets (50K / 500K / 2M / Unlimited)
- AI usage progress bars per org
- Impersonate org owner via `onImpersonate` → `OrganizationProvider.startImpersonation()`
- Invite users into specific orgs
- Stats row: total orgs, enterprise/pro/free counts
- Subdomain display: `{slug}.peakestimator.top`

### UsageMetricsTab (`src/pages/admin/tabs/UsageMetricsTab.tsx`)
**Replaces:** `AdminPortal.tsx` revenue + churn sections
- MRR / ARR calculated from org billing tiers
- KPI cards: MRR, total orgs, total members, AI tokens
- Plan distribution bar chart
- Per-org usage table with AI consumption bars
- Sort by: AI tokens | Proposals | Tier
- Active orgs (30d) metric

### FeatureFlagsTab (`src/pages/admin/tabs/FeatureFlagsTab.tsx`)
**Replaces:** `AdminPortal.tsx` feature_flags section
- Full feature flag matrix (16 flags)
- Tier badges (free / pro / enterprise)
- Override count per flag (how many orgs have custom overrides)
- Filter by tier
- Read-only at platform level (per-org overrides in SubAccountsTab)

### AuditLogsTab (`src/pages/admin/tabs/AuditLogsTab.tsx`)
**Replaces:** `AdminPortal.tsx` audit_logs section
- Reads from `impersonation_logs` table (Phase 1)
- Enriches with actor/target profile emails
- Shows duration, IP address, active/ended status
- Paginated (25 per page)
- Search by actor, target, or org

---

## 🟡 AdminPortalShell Upgrade

**File:** `src/pages/admin/AdminPortalShell.tsx`
- Phase 2 tabs render directly (no lazy wrapper needed)
- Legacy tabs still delegate to AdminPortal.tsx via `<Suspense>`
- Tab nav with P2 badge on extracted tabs
- `initialTab` prop passed to AdminPortal for legacy tab routing
- `onImpersonate` bridges to `OrganizationProvider.startImpersonation()`
- Members pre-fetched at shell level and passed as prop

**AdminPortal.tsx changes:**
- Added `{ initialTab }` prop for shell integration
- `useState` initialized from `initialTab` prop

---

## 🟡 New Hooks

### `useOrgUsage` (`src/hooks/useOrgUsage.ts`)
- Reads `organization_usage` for the active org
- Returns: `usage`, `canUseAI`, `aiUsagePct`, `tokensRemaining`, `isUnlimited`
- Used by AI scope button, Settings page, usage indicators

### `useOrgMembers` (`src/hooks/useOrgMembers.ts`)
- Reads all profiles in the active organization
- `updateMemberRole(id, role)` — scoped to org
- `removeMember(id)` — clears organization_id (soft remove)

---

## 🟢 New Edge Function

### `usage-meter` (`supabase/functions/usage-meter/index.ts`)
Actions: `check` | `consume` | `reset` | `status`

- `check` — returns `{ allowed, tokens_remaining, usage_pct }`
- `consume` — deducts tokens used from org's monthly quota (upsert)
- `reset` — resets monthly usage (all orgs or specific org)
- `status` — returns full usage snapshot
- -1 token limit = unlimited (Enterprise)
- Platform owners can target any org

---

## 🟢 New Database Migration

### `20260527210000_phase2_usage_metering.sql`

1. `ai_requests_count` column on `organization_usage`
2. `projects_count` column + backfill
3. `increment_ai_usage(org_id, tokens)` RPC function — called from Edge Functions
4. `check_ai_allowance(org_id)` RPC function — check before AI calls
5. `set_project_organization_id()` trigger — auto-sets org_id on new projects
6. `increment_org_project_count()` trigger — tracks project count
7. `decrement_org_project_count()` trigger — decrements on delete
8. Updated organizations RLS — members can read own org
9. Updated organization_usage RLS — members can read own usage

---

## AI Estimator Patch

**File:** `supabase/functions/ai-estimator/index.ts`
- Calls `increment_ai_usage` RPC after each successful AI call
- Non-blocking (fire-and-forget, won't fail user request)
- Passes `userProfile.organization_id` as org context

---

## Files Changed/Added

| File | Type | Change |
|------|------|--------|
| `src/pages/admin/AdminPortalShell.tsx` | Modified | Phase 2 tab routing, impersonation bridge |
| `src/pages/AdminPortal.tsx` | Modified | `initialTab` prop added |
| `src/pages/admin/tabs/SubAccountsTab.tsx` | **New** | Org management UI |
| `src/pages/admin/tabs/UsageMetricsTab.tsx` | **New** | Platform metrics |
| `src/pages/admin/tabs/FeatureFlagsTab.tsx` | **New** | Flag management |
| `src/pages/admin/tabs/AuditLogsTab.tsx` | **New** | Audit log viewer |
| `src/hooks/useOrgUsage.ts` | **New** | Usage metering hook |
| `src/hooks/useOrgMembers.ts` | **New** | Team management hook |
| `supabase/functions/usage-meter/index.ts` | **New** | Usage metering Edge Function |
| `supabase/functions/ai-estimator/index.ts` | Modified | Token tracking added |
| `supabase/migrations/20260527210000_phase2_usage_metering.sql` | **New** | DB triggers + RPC functions |

---

## Next: Phase 3

- Organization Settings page (branding, billing, members, API keys)
- White label subdomain routing
- Stripe subscription integration (create/upgrade/cancel)
- Monthly usage reset cron job
- Advanced analytics (pipeline, churn prediction)
- Remaining admin tab extractions (members, CRM, AI settings, automation)
- Team invite flow (email → accept → org membership)
