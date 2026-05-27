# PeakEstimator — Phase 1 Transformation Changelog

## Summary
All changes are backward-compatible. Existing functionality, data, and deployments are preserved.
No tables dropped. No columns renamed. No business logic removed.

---

## 🔴 STOP-SHIP Fixes Applied

### 1. Duplicate `SystemSettings` Interface — FIXED
**File:** `src/types/index.ts`
- Removed the stub `SystemSettings` interface (lines ~222-234)
- Kept the extended version `SystemSettings extends WireDetails`
- Added backward-compat `selected_tier` field to `Project` interface (deprecated alias)
- Added `platform_owner` to `UserRole` type

### 2. Dual Auth Listeners (Memory Leak) — FIXED
**File:** `src/App.tsx`, new `src/providers/AuthProvider.tsx`
- `SmartRoot` and `ProtectedRoute` each had their own `onAuthStateChange` subscription
- Both are now removed. Single subscription lives in `AuthProvider`
- Zero double-renders, zero memory leaks, correct session state everywhere

### 3. `is_admin` Hardcoded Role Checks — FIXED
**Files:** `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `src/pages/Settings.tsx`, `src/pages/AdminPortal.tsx`
- All `profile?.is_admin` checks now also check `profile?.role === 'platform_owner'` and `'super_admin'`
- Backward compatible — `is_admin = true` still grants access
- New role `platform_owner` is now first-class in the permission system

### 4. Impersonation State Leakage — FIXED
**File:** `src/hooks/useProjects.ts`
- Projects now clear immediately when `activeUserId` changes (prevents data flash)
- `prevUserIdRef` tracks previous user to detect switch
- Organization-scoped queries prevent cross-tenant leakage

### 5. Logo Upload — No Validation — FIXED
**File:** `src/pages/Settings.tsx`
- Added MIME type check: only `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml` allowed
- Added 5MB file size limit
- Added `contentType` header to storage upload
- Input cleared on validation failure or after successful upload
- Wrapped in try/finally to always reset loading state

### 6. `selected_tier` vs `selected_option_tier` — FIXED
**File:** `src/pages/ClientPortal.tsx`
- `approve_project_by_share_token` call now uses `?? project.selected_tier` fallback
- `activeTier` derivation now uses `?? project?.selected_tier` fallback
- Both fields coexist safely during migration

### 7. Missing Env Var Validation — FIXED
**Files:** `src/lib/envValidation.ts`, `src/main.tsx`
- `validateEnvironment()` called at startup — throws with clear message if vars missing
- Shows user-friendly error UI in the browser instead of silent failure
- No more `console.warn('⚠️ Supabase env vars not set')`

### 8. `OPENAI_API_KEY` Reference — FIXED
**File:** `.env.example`
- Replaced `OPENAI_API_KEY` with `OPENROUTER_API_KEY`
- All Edge Functions already use `OPENROUTER_API_KEY` correctly

### 9. `peakeastimator.top` URL Typo — FIXED
**Files:** `supabase/functions/ai-estimator/index.ts`, `supabase/functions/admin-manager/index.ts`, `supabase/functions/email-followup/index.ts`, `supabase/functions/notify-contractor/index.ts`, `src/pages/AdminPortal.tsx`
- Fixed all 5 occurrences of the misspelled domain

### 10. `.bak` Files — BLOCKED IN GITIGNORE
**File:** `.gitignore`
- Added `*.bak` and `*.bak.*` to `.gitignore`
- Files: `src/pages/ClientPortal.tsx.bak`, `src/pages/EstimatorWorkspace.tsx.bak`

### 11. `console.log` in Production — FIXED
**Files:** `src/lib/followUpCampaigns.ts`, `src/api/apiClient.ts`
- 8 `console.log` statements removed from `followUpCampaigns.ts`
- `console.info` in `apiClient.ts` gated behind `import.meta.env.DEV`

---

## 🟡 Architecture Foundations Added

### AuthProvider (`src/providers/AuthProvider.tsx`)
- Centralized auth context — replaces all scattered `onAuthStateChange` calls
- Provides: `session`, `user`, `profile`, `loading`, `signOut`, `refreshProfile`
- `useAuth()` hook for consumption

### OrganizationProvider (`src/providers/OrganizationProvider.tsx`)
- Tenant context — org data, plan, feature flags, role
- Manages impersonation state safely
- Calls `impersonation-log` Edge Function for audit trail
- `useOrganization()` hook for consumption

### Feature Gating (`src/hooks/useFeature.ts`)
- `useFeature('ai-scope')` — single flag check
- `useFeatureGate()` — full gate object with `hasFeature()`, `plan`, `isPro`, etc.
- Plan → feature matrix defined for Free / Pro / Enterprise
- Org-level flags can override plan defaults

### Error Boundaries (`src/components/layout/ErrorBoundary.tsx`)
- App-level: full-screen fallback (never white screen)
- Route-level: card fallback with retry button
- All major routes wrapped in `<ErrorBoundary>`
- Dev mode shows error details; production shows friendly message

### ImpersonationBanner (`src/components/layout/ImpersonationBanner.tsx`)
- Fixed amber banner at top of screen during impersonation
- Shows who is being impersonated and since when
- "Exit View" button safely stops impersonation

### AdminPortalShell (`src/pages/admin/AdminPortalShell.tsx`)
- Lazy-loading orchestrator wrapping the existing AdminPortal
- Zero regression in Phase 1 — delegates to original monolith
- Tab extraction happens in Phase 2

### Currency Utilities (`src/lib/currency.ts`)
- `formatCurrency()` — NaN-safe, returns `$0.00` for invalid inputs
- `safeNumber()` — converts any value safely with fallback
- `formatPercent()` — percentage with fallback

### Impersonation Log Edge Function (`supabase/functions/impersonation-log/index.ts`)
- Secure server-side audit logging for impersonation events
- Verifies caller is platform staff before writing
- Records start/stop with IP, user agent, timestamps

---

## 🟢 Database Migration

### `supabase/migrations/20260527200000_phase1_org_rbac.sql`
**What it adds (all backward-compatible):**
1. `platform_owner` added to `profiles.role` constraint
2. `organization_members` table — team management
3. `subscription_plans` table — seeded with Free/Pro/Enterprise
4. `organization_usage` table — usage metering foundation
5. `impersonation_logs` table — full audit trail
6. `is_platform_owner()` DB function — authoritative staff check
7. `is_admin()` updated to call `is_platform_owner()` (backward compat)
8. Org-scoped `projects` SELECT policy added
9. Performance indexes on `organization_id` columns
10. Backfill: `projects.organization_id` populated from `profiles.organization_id`
11. `organization_usage` seeded for all existing orgs

---

## Files Changed

| File | Type | Change |
|------|------|--------|
| `src/types/index.ts` | Modified | Removed duplicate SystemSettings, added platform_owner role |
| `src/App.tsx` | Replaced | AuthProvider, OrganizationProvider, ErrorBoundaries, lazy routes |
| `src/main.tsx` | Modified | validateEnvironment() at startup |
| `src/api/supabase.ts` | Modified | Hard fail on missing env vars |
| `src/store/useAppStore.ts` | Modified | Safe impersonation reset, error handling |
| `src/hooks/useProjects.ts` | Modified | Org-scoped queries, instant clear on user switch |
| `src/lib/permissionGuard.ts` | Modified | platform_owner tier, backward compat |
| `src/pages/Settings.tsx` | Modified | Logo validation, is_admin → role-aware |
| `src/pages/AdminPortal.tsx` | Modified | is_admin → role-aware, typo fix |
| `src/components/layout/Sidebar.tsx` | Modified | is_admin → role-aware |
| `src/pages/ClientPortal.tsx` | Modified | selected_tier fallback |
| `src/api/apiClient.ts` | Modified | Debug logs gated to DEV |
| `src/lib/followUpCampaigns.ts` | Modified | console.log removed |
| `.env.example` | Modified | OPENROUTER_API_KEY, additional secrets |
| `.gitignore` | Modified | *.bak excluded |
| `tsconfig.json` | Modified | strict mode, @ paths |
| `supabase/functions/ai-estimator/index.ts` | Modified | URL typo fix |
| `supabase/functions/admin-manager/index.ts` | Modified | URL typo fix |
| `supabase/functions/email-followup/index.ts` | Modified | URL typo fix |
| `supabase/functions/notify-contractor/index.ts` | Modified | URL typo fix |
| `src/providers/AuthProvider.tsx` | **New** | Centralized auth context |
| `src/providers/OrganizationProvider.tsx` | **New** | Tenant + impersonation context |
| `src/hooks/useAuth.ts` | **New** | Auth hook re-export |
| `src/hooks/useOrganization.ts` | **New** | Org hook re-export |
| `src/hooks/useFeature.ts` | **New** | Feature gating hooks |
| `src/components/layout/ErrorBoundary.tsx` | **New** | React error boundary |
| `src/components/layout/ImpersonationBanner.tsx` | **New** | Admin view indicator |
| `src/lib/envValidation.ts` | **New** | Startup env validation |
| `src/lib/currency.ts` | **New** | NaN-safe currency formatters |
| `src/pages/admin/AdminPortalShell.tsx` | **New** | Lazy tab orchestrator |
| `supabase/functions/impersonation-log/index.ts` | **New** | Audit log Edge Function |
| `supabase/migrations/20260527200000_phase1_org_rbac.sql` | **New** | Phase 1 DB migration |

---

## Next: Phase 2

- Organization management UI (create/invite/manage orgs)
- RBAC enforcement in all data queries
- Usage metering + AI token tracking
- Admin portal tab modularization
- Tenant-aware realtime subscriptions
- Plan entitlement enforcement
- Organization settings page
