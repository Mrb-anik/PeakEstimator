/**
 * usage-meter Edge Function
 * ─────────────────────────────────────────────────────────────────
 * Tracks and enforces AI token usage per organization.
 *
 * Called by: ai-estimator, ai-transcribe (after each AI call)
 *
 * Actions:
 *   check   — check if org has tokens remaining (read-only)
 *   consume — deduct tokens used (called after AI call succeeds)
 *   reset   — reset monthly usage (called by scheduled job on 1st of month)
 *   status  — get full usage snapshot for an org
 * ─────────────────────────────────────────────────────────────────
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Resolve org for this user
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    const orgId = profile?.organization_id;

    const { action, tokens_used, organization_id } = await req.json();

    // Platform owners can specify org directly
    const targetOrgId = organization_id ?? orgId;

    if (!targetOrgId && action !== 'reset') {
      return new Response(JSON.stringify({ error: "No organization context", allowed: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── check ────────────────────────────────────────────────────
    if (action === "check") {
      const { data: usage } = await supabaseAdmin
        .from("organization_usage")
        .select("ai_tokens_used, ai_tokens_limit")
        .eq("organization_id", targetOrgId)
        .single();

      if (!usage) {
        // No usage row — upsert default and allow
        await supabaseAdmin.from("organization_usage").upsert({
          organization_id: targetOrgId,
          ai_tokens_used: 0,
          ai_tokens_limit: 50_000,
        }, { onConflict: "organization_id" });
        return new Response(JSON.stringify({ allowed: true, tokens_remaining: 50_000 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { ai_tokens_used, ai_tokens_limit } = usage;

      // -1 = unlimited
      if (ai_tokens_limit === -1) {
        return new Response(JSON.stringify({ allowed: true, tokens_remaining: -1, unlimited: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const remaining = ai_tokens_limit - (ai_tokens_used ?? 0);
      return new Response(JSON.stringify({
        allowed: remaining > 0,
        tokens_remaining: Math.max(0, remaining),
        tokens_used: ai_tokens_used,
        tokens_limit: ai_tokens_limit,
        usage_pct: Math.round(((ai_tokens_used ?? 0) / ai_tokens_limit) * 100),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── consume ──────────────────────────────────────────────────
    if (action === "consume") {
      if (!tokens_used || tokens_used <= 0) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Upsert: add tokens to existing count
      const { data: current } = await supabaseAdmin
        .from("organization_usage")
        .select("ai_tokens_used, ai_tokens_limit")
        .eq("organization_id", targetOrgId)
        .single();

      const newUsed = (current?.ai_tokens_used ?? 0) + tokens_used;

      const { error } = await supabaseAdmin
        .from("organization_usage")
        .upsert({
          organization_id: targetOrgId,
          ai_tokens_used: newUsed,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id" });

      if (error) throw error;

      // Warn if >90% usage
      const limit = current?.ai_tokens_limit ?? 50_000;
      const pct = limit === -1 ? 0 : Math.round((newUsed / limit) * 100);

      return new Response(JSON.stringify({
        ok: true,
        tokens_used_total: newUsed,
        usage_pct: pct,
        near_limit: pct >= 90,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── reset ────────────────────────────────────────────────────
    if (action === "reset") {
      // Only callable by platform owners or scheduled jobs (no user context required)
      const isStaff = profile?.role === "platform_owner" || profile?.role === "super_admin";
      if (!isStaff && organization_id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const resetQuery = organization_id
        ? supabaseAdmin.from("organization_usage").update({
            ai_tokens_used: 0,
            proposals_this_month: 0,
            period_start: new Date().toISOString().slice(0, 10),
            last_reset_at: new Date().toISOString(),
          }).eq("organization_id", organization_id)
        : supabaseAdmin.from("organization_usage").update({
            ai_tokens_used: 0,
            proposals_this_month: 0,
            period_start: new Date().toISOString().slice(0, 10),
            last_reset_at: new Date().toISOString(),
          }).neq("ai_tokens_limit", -1); // Don't reset unlimited orgs (no-op, just counts)

      const { error } = await resetQuery;
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, reset_at: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── status ───────────────────────────────────────────────────
    if (action === "status") {
      const { data: usage, error } = await supabaseAdmin
        .from("organization_usage")
        .select("*")
        .eq("organization_id", targetOrgId)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, usage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[usage-meter]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
