/**
 * monthly-reset Edge Function
 * ─────────────────────────────────────────────────────────────────
 * Resets AI token usage for all organizations on the 1st of each month.
 *
 * Trigger: Supabase Cron (pg_cron) — runs at 00:05 UTC on 1st of month
 *   SELECT cron.schedule(
 *     'monthly-usage-reset',
 *     '5 0 1 * *',
 *     $$ SELECT net.http_post(
 *       url := 'https://<project>.supabase.co/functions/v1/monthly-reset',
 *       headers := '{"Authorization": "Bearer <anon-key>", "x-reset-secret": "<MONTHLY_RESET_SECRET>"}',
 *       body := '{}'
 *     ) $$
 *   );
 *
 * Alternative: Call manually from Admin Portal or usage-meter Edge Function.
 * ─────────────────────────────────────────────────────────────────
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-reset-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Verify reset secret (prevents unauthorized resets)
  const resetSecret = Deno.env.get("MONTHLY_RESET_SECRET");
  if (resetSecret) {
    const providedSecret = req.headers.get("x-reset-secret");
    const authHeader = req.headers.get("Authorization");
    const isServiceRole = authHeader?.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "____");
    if (!isServiceRole && providedSecret !== resetSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const now = new Date();
    const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // Reset all org usage (except unlimited orgs — ai_tokens_limit = -1)
    const { data, error } = await supabaseAdmin
      .from("organization_usage")
      .update({
        ai_tokens_used: 0,
        ai_requests_count: 0,
        proposals_this_month: 0,
        period_start: periodStart,
        last_reset_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .neq("ai_tokens_limit", -1);  // Don't touch unlimited orgs

    if (error) throw error;

    console.log(`[monthly-reset] Completed at ${now.toISOString()} — period: ${periodStart}`);

    return new Response(JSON.stringify({
      ok: true,
      reset_at: now.toISOString(),
      period_start: periodStart,
      message: "Monthly AI usage reset completed for all metered organizations.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[monthly-reset] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
