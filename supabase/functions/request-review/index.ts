import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("RESEND_FROM") || "Tío José María <reservas@tiojosemaria.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WA_PHONE = "34676344675";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Devuelve hora actual en zona Europe/Madrid (0-23), DST-aware.
function madridHour(): number {
  const fmt = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    hour12: false,
  });
  return parseInt(fmt.format(new Date()), 10);
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { skipped: true, reason: "no_api_key" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
    });
    return { status: res.status, ok: res.ok, body: await res.json() };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

function whatsappLink(text: string) {
  return `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(text)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Aceptar ?force=1 para saltarse el gate de hora (util en tests manuales)
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  // Leer config: dias tras checkout + hora Madrid + URLs
  const { data: configRows } = await admin.from("web_config").select("key, value")
    .in("key", ["review_request_days", "review_request_hour_madrid", "google_review_url", "booking_review_url"]);
  const config: Record<string, string> = {};
  for (const r of configRows || []) config[r.key] = r.value;
  const daysAfter = parseInt(config.review_request_days || "3", 10);
  const targetHourMadrid = parseInt(config.review_request_hour_madrid || "10", 10);
  const googleUrl = config.google_review_url || "";
  const bookingUrl = config.booking_review_url || "";

  // Gate: solo procesar si estamos en la hora Madrid objetivo.
  // El cron corre a 08:00 y 09:00 UTC; verano 10:00 cae en 08:00 UTC,
  // invierno 10:00 cae en 09:00 UTC. En cada caso solo una de las dos
  // ejecuciones pasa el gate, la otra sale sin hacer nada.
  const currentHour = madridHour();
  if (!force && currentHour !== targetHourMadrid) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "not_target_hour", madrid_hour: currentHour, target: targetHourMadrid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fecha objetivo: hoy - daysAfter
  const target = new Date();
  target.setDate(target.getDate() - daysAfter);
  const targetDate = target.toISOString().slice(0, 10);

  const { data: bookings, error: queryErr } = await admin
    .from("guest_bookings")
    .select("id, guest_name, guest_email, check_in, check_out, apartments(name)")
    .eq("status", "confirmed")
    .eq("check_out", targetDate)
    .is("review_request_sent_at", null);

  if (queryErr) {
    return new Response(JSON.stringify({ error: queryErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results = [];
  for (const b of bookings || []) {
    if (!b.guest_email) continue;
    const firstName = (b.guest_name || "").split(" ")[0] || "hola";
    const aptName = (b as any).apartments?.name || "el apartamento";
    const waMsg = `Hola, me hospede en ${aptName} y queria comentaros una cosa de la estancia.`;

    const googleBtn = googleUrl ? `
      <a href="${googleUrl}" style="display:inline-block;background:#4285F4;color:white;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:bold;margin:6px;">Resena en Google</a>
    ` : "";
    const bookingBtn = bookingUrl ? `
      <a href="${bookingUrl}" style="display:inline-block;background:#003580;color:white;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:bold;margin:6px;">Resena en Booking</a>
    ` : "";

    const html = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px; color:#374151;">
        <h1 style="color: #556B2F; font-size: 24px;">¿Qué tal la estancia, ${firstName}?</h1>
        <p>Esperamos que disfrutarais mucho de Hinojares y que la vuelta a casa haya sido tranquila.</p>
        <p>Si os apetece, nos ayudaríais muchísimo dejando una reseña corta. Para una casa pequeña y familiar como la nuestra, vuestra opinión es lo que hace que otra gente nos descubra.</p>
        <div style="text-align:center;margin:28px 0;">
          ${googleBtn}
          ${bookingBtn}
        </div>
        <p style="color:#6b7280;font-size:14px;">Si hubo algo que no estuvo a la altura, preferíamos saberlo en privado para arreglarlo. <a href="${whatsappLink(waMsg)}" style="color:#25D366;font-weight:bold;">Escríbenos por WhatsApp</a> y lo hablamos.</p>
        <p>Muchas gracias por elegirnos. Aquí os esperamos siempre.</p>
        <p style="color: #556B2F; font-weight: bold; margin-top: 24px;">Mari Carmen y Jesús</p>
        <p style="color: #888; font-size: 12px;">Apartamentos Rurales Tío José María · Calle Baja 1, Hinojares</p>
      </div>
    `;

    const emailRes = await sendEmail(b.guest_email, `¿Qué tal tu estancia en Tío José María?`, html);

    if ((emailRes as any).ok) {
      await admin.from("guest_bookings")
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq("id", b.id);
    }

    results.push({ booking_id: b.id, email: b.guest_email, apt: aptName, email_result: emailRes });
  }

  return new Response(
    JSON.stringify({
      success: true,
      madrid_hour: currentHour,
      target_hour: targetHourMadrid,
      forced: force,
      target_checkout_date: targetDate,
      days_after_checkout: daysAfter,
      processed: results.length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
