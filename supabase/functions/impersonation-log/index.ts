import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * impersonation-log Edge Function
 * 
 * Logs impersonation start/stop events to impersonation_logs table.
 * Only callable by platform_owner / super_admin / is_admin users.
 * 
 * Actions: start | stop
 */

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

    // Verify actor is platform staff
    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .single();

    const isStaff = actorProfile?.is_admin === true ||
      actorProfile?.role === "platform_owner" ||
      actorProfile?.role === "super_admin";

    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { action, targetUserId, targetOrgId, reason, logId } = await req.json();
    const ipAddress = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null;
    const userAgent = req.headers.get("user-agent") ?? null;

    if (action === "start") {
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "targetUserId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data: log, error: insertErr } = await supabaseAdmin
        .from("impersonation_logs")
        .insert({
          actor_id: user.id,
          target_user_id: targetUserId,
          target_org_id: targetOrgId ?? null,
          reason: reason ?? null,
          ip_address: ipAddress,
          user_agent: userAgent,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ ok: true, logId: log.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "stop") {
      if (!logId) {
        return new Response(JSON.stringify({ error: "logId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { error: updateErr } = await supabaseAdmin
        .from("impersonation_logs")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", logId)
        .eq("actor_id", user.id); // Security: only actor can close their own log

      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[impersonation-log]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
