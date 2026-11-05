import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { render, type BookingPayload } from "../_shared/templates/index.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("RESEND_FROM") || "Tío José María <reservas@tiojosemaria.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Same filter as send-booking-email: channel bookings without a real mailbox
// get a filler address (`example.invalid` from the importers, `tiojosemaria.local`
// from the 11-sep sweep) or a portal-masked one («n***@***.com»). Never write there.
const PLACEHOLDER_DOMAINS = ["@example.invalid", "@tiojosemaria.local"];
const esPlaceholder = (email: string) => {
  const e = email.toLowerCase().trim();
  return PLACEHOLDER_DOMAINS.some((d) => e.endsWith(d));
};
const esCorreoValido = (email: string) => /^[^\s@*]+@[^\s@*]+\.[a-z]{2,}$/i.test(email.trim());

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
    .select("id, booking_code, guest_name, guest_email, check_in, check_out, total_price, idioma, apartments(name, slug)")
    // completed since 0061 closes stays the day after check-out
    .in("status", ["confirmed", "completed"])
    .eq("check_out", targetDate)
    .is("review_request_sent_at", null);

  if (queryErr) {
    return new Response(JSON.stringify({ error: queryErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results = [];
  for (const b of bookings || []) {
    const email = String(b.guest_email || "").trim();
    if (!email) continue;
    if (esPlaceholder(email) || !esCorreoValido(email)) {
      results.push({ booking_id: b.id, skipped: "placeholder_or_invalid_email" });
      continue;
    }
    // RGPD: the review request is legitimate interest with opt-out (same check
    // as send-booking-email).
    const { data: c } = await admin.from("customers").select("review_optout")
      .eq("email", email.toLowerCase()).maybeSingle();
    if (c?.review_optout) {
      results.push({ booking_id: b.id, skipped: "review_opted_out" });
      continue;
    }

    const apt = (b as { apartments?: { name?: string; slug?: string } | null }).apartments;
    const aptName = apt?.name || "el apartamento";
    // The approved `review_request` template, in the guest's language
    // (guest_bookings.idioma; NULL = Spanish). It greets by first name and
    // leaves the name out when there is none.
    const payload: BookingPayload = {
      booking_code: String(b.booking_code || ""),
      guest_name: String(b.guest_name || ""),
      guest_email: email,
      apartment_name: aptName,
      apartment_slug: apt?.slug || "",
      check_in: String(b.check_in),
      check_out: String(b.check_out),
      total_price: Number(b.total_price) || 0,
      idioma: (b as { idioma?: string | null }).idioma ?? null,
    };
    const { subject, html } = render("review_request", payload);

    const emailRes = await sendEmail(email, subject, html);

    if ((emailRes as any).ok) {
      await admin.from("guest_bookings")
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq("id", b.id);
    }

    results.push({ booking_id: b.id, email, apt: aptName, email_result: emailRes });
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
