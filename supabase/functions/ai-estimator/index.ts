import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { projectId, trade, prompt, imageBase64 } = await req.json();

    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openRouterKey) throw new Error("Missing OPENROUTER_API_KEY secret on server.");

    const systemPrompt = `You are an expert contractor estimating assistant. Given a job description, generate a detailed, realistic estimate as a JSON object. 
Return ONLY valid JSON with no markdown, no backticks, no explanation.
The JSON must have this exact shape:
{
  "lineItems": [
    {
      "description": "string",
      "quantity": number,
      "unit": "string (e.g. HR, EA, LF, SF, LS, day)",
      "unit_price": number,
      "category": "material" | "labor" | "equipment" | "other",
      "markup": number (percentage, e.g. 15)
    }
  ],
  "homeownerSummary": "string (2-3 friendly sentences summarizing the work for a homeowner)",
  "estimatedTotal": number
}
Generate between 4 and 10 line items. Use realistic market prices for the ${trade} trade. Be specific with descriptions.`;

    const userMessage = imageBase64
      ? [
          { type: "text", text: prompt || "Analyze this job site photo and generate a detailed scope of work." },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      : prompt;

    const start = Date.now();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": Deno.env.get("SITE_URL") || "https://peakestimator.top",
        "X-Title": "PeakEstimator AI Estimator",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        max_tokens: 1500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errText}`);
    }

    const aiData = await response.json();
    const rawText = aiData.choices?.[0]?.message?.content ?? "";
    const tokensUsed = aiData.usage?.total_tokens ?? 0;
    const durationMs = Date.now() - start;

    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Calculate real total from line items
    const estimatedTotal = parsed.lineItems.reduce((acc: number, item: any) => {
      return acc + (item.quantity * item.unit_price * (1 + item.markup / 100));
    }, 0);

    // ── Non-blocking usage metering ─────────────────────────────
    if (tokensUsed > 0) {
      // Fire and forget — don't block the response
      supabaseClient.rpc('increment_ai_usage', {
        org_id: userProfile?.organization_id ?? userId,
        tokens_consumed: tokensUsed,
      }).catch((e: unknown) => console.error('[ai-estimator] usage meter error:', e));
    }

    return new Response(JSON.stringify({
      lineItems: parsed.lineItems,
      homeownerSummary: parsed.homeownerSummary,
      estimatedTotal: Math.round(estimatedTotal * 100) / 100,
      tokensUsed,
      costCents: Math.ceil(tokensUsed * 0.00025),
      durationMs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("ai-estimator error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
