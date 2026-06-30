import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("RESEND_FROM") || "Tío José María <reservas@tiojosemaria.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://n8nlmfb-tiojosemaria.fhsavp.easypanel.host";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { skipped: true };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  return { status: res.status, ok: res.ok, body: await res.json() };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "valid email required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rate limit ligero: 3 envios/hora por IP (la suscripcion en si tiene UNIQUE
    // constraint en email pero email distintos desde la misma IP podrian abusar)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);
    const rateKey = `guide:${ip}`;
    const { data: rateRow } = await admin
      .from("rate_limits")
      .select("id, count")
      .eq("key", rateKey)
      .eq("window_start", windowStart.toISOString())
      .maybeSingle();
    if (rateRow) {
      if (rateRow.count >= 3) {
        return new Response(JSON.stringify({ error: "rate_limit" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await admin.from("rate_limits").update({ count: rateRow.count + 1 }).eq("id", rateRow.id);
    } else {
      await admin.from("rate_limits").insert({ key: rateKey, window_start: windowStart.toISOString(), count: 1 });
    }

    const guideUrl = `${SITE_URL}/guia-cazorla`;
    const html = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px; color:#374151;">
        <h1 style="color: #556B2F; font-size: 26px; line-height:1.2;">Aquí está nuestra guía del Cazorla que no sale en las guías</h1>
        <p>Gracias por suscribirte. Hemos preparado esta guía con las rutas que más nos gustan, los sitios donde comemos nosotros, las fiestas que merece la pena vivir y los rincones que no salen en TripAdvisor.</p>
        <p>Está escrita por la familia que lleva la casa, no es marketing. Si algo no encaja, avísanos.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${guideUrl}" style="display:inline-block;background:#556B2F;color:white;text-decoration:none;padding:16px 36px;border-radius:999px;font-weight:bold;font-size:16px;">Leer la guía</a>
        </div>
        <p style="color:#6b7280;font-size:14px;">Guarda este email — la guía se irá actualizando con el tiempo. Cada vez que vuelvas al enlace verás la versión más reciente.</p>
        <p style="color:#6b7280;font-size:14px;">¿Tienes pensado venir? <a href="${SITE_URL}/#apartamentos" style="color:#556B2F;font-weight:bold;">Echa un vistazo a los apartamentos</a> o escríbenos por WhatsApp al <a href="https://wa.me/34676344675" style="color:#25D366;font-weight:bold;">676 34 46 75</a>.</p>
        <p style="color: #556B2F; font-weight: bold; margin-top: 24px;">Mari Carmen y Jesús</p>
        <p style="color: #888; font-size: 12px;">Apartamentos Rurales Tío José María · Calle Baja 1, 23486 Hinojares (Jaén)</p>
      </div>
    `;
    const emailRes = await sendEmail(email, `Tu guía del Cazorla que no sale en las guías`, html);

    // Marcar el subscriber con la fecha de envio (si la tabla lo permite)
    await admin.from("email_subscribers")
      .update({ guide_sent_at: new Date().toISOString() })
      .eq("email", email);

    return new Response(JSON.stringify({ success: true, email_result: emailRes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
