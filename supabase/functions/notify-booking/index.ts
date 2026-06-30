import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "apartamentostiojosemaria@gmail.com";
const ADMIN_PHONE = "34676344675";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("RESEND_FROM") || "Tío José María <reservas@tiojosemaria.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIGN_SECRET = Deno.env.get("BOOKING_SIGN_SECRET") || SUPABASE_SERVICE_ROLE_KEY;
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET") || "";
const ACTION_URL = `${SUPABASE_URL}/functions/v1/booking-status-update`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function whatsappLink(text: string) { return `https://wa.me/${ADMIN_PHONE}?text=${encodeURIComponent(text)}`; }
function phoneLink(message: string) {
  return `<a href="${whatsappLink(message)}" style="color:#25D366;font-weight:bold;text-decoration:none;">676 34 46 75</a>`;
}

async function signAction(bookingId: number, action: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SIGN_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${bookingId}:${action}`));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { skipped: true, reason: "RESEND_API_KEY not set in function env" };
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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

// CN-003: rate limit por IP usando tabla rate_limits con ventana de 1h
async function checkRateLimit(admin: ReturnType<typeof createClient>, ip: string, perHour: number): Promise<{ allowed: boolean; current: number }> {
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0); // redondear al inicio de la hora actual
  const key = `booking:${ip}`;

  // Intentar incrementar; si no existe, insertar
  const { data: existing } = await admin
    .from("rate_limits")
    .select("id, count")
    .eq("key", key)
    .eq("window_start", windowStart.toISOString())
    .maybeSingle();

  if (existing) {
    const newCount = existing.count + 1;
    await admin.from("rate_limits").update({ count: newCount }).eq("id", existing.id);
    return { allowed: newCount <= perHour, current: newCount };
  } else {
    await admin.from("rate_limits").insert({ key, window_start: windowStart.toISOString(), count: 1 });
    return { allowed: 1 <= perHour, current: 1 };
  }
}

// CN-003: verificar token Turnstile contra el endpoint de Cloudflare
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true; // si no esta configurado, no se exige
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }),
    });
    const json = await res.json();
    return json.success === true;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { booking_id, turnstile_token, debug } = body;

    if (!booking_id || typeof booking_id !== "number") {
      return new Response(JSON.stringify({ error: "booking_id (number) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // CN-003: rate limit por IP (5 reservas/hora por defecto, configurable)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { data: cfgRow } = await admin
      .from("web_config")
      .select("value")
      .eq("key", "booking_rate_limit_per_hour")
      .single();
    const perHour = parseInt(cfgRow?.value || "5", 10);
    const limit = await checkRateLimit(admin, ip, perHour);
    if (!limit.allowed) {
      return new Response(JSON.stringify({
        error: "rate_limit_exceeded",
        message: "Demasiadas reservas desde tu conexion. Espera 1 hora o escribenos por WhatsApp.",
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // CN-003: si Turnstile esta activo, verificar token
    const captchaOk = await verifyTurnstile(turnstile_token, ip);
    if (!captchaOk) {
      return new Response(JSON.stringify({
        error: "captcha_failed",
        message: "Verificacion de seguridad fallida. Recarga la pagina y vuelve a intentar.",
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: booking } = await admin
      .from("guest_bookings")
      .select("*, apartments(name)")
      .eq("id", booking_id)
      .single();

    if (!booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let blockedDatesResult: unknown = null;
    if (booking.check_in && booking.check_out && booking.apartment_id) {
      const { error: blockErr } = await admin.from("blocked_dates").insert({
        apartment_id: booking.apartment_id,
        start_date: booking.check_in,
        end_date: booking.check_out,
        source: "booking_pending",
      });
      blockedDatesResult = blockErr ? { error: blockErr.message } : { ok: true };
    }

    const aptName = booking.apartments?.name || "Apartamento";
    const checkIn = formatDate(booking.check_in);
    const checkOut = formatDate(booking.check_out);
    const price = booking.total_price ? `${booking.total_price}€` : "A confirmar";

    const confirmToken = await signAction(booking_id, "confirm");
    const rejectToken = await signAction(booking_id, "reject");
    const confirmUrl = `${ACTION_URL}?id=${booking_id}&action=confirm&t=${confirmToken}`;
    const rejectUrl = `${ACTION_URL}?id=${booking_id}&action=reject&t=${rejectToken}`;
    const actionButtons = `
      <div style="text-align:center;margin:32px 0 8px;">
        <a href="${confirmUrl}" style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:bold;margin:4px 6px;">✓ Confirmar reserva</a>
        <a href="${rejectUrl}" style="display:inline-block;background:white;color:#dc2626;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:bold;border:1px solid #dc2626;margin:4px 6px;">✕ Rechazar</a>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin:8px 0 24px;">Un solo click. El huésped recibe el aviso automático.</p>
    `;

    const adminWaMsg = `Hola ${booking.guest_name}, te escribo desde Apartamentos Tío José María por tu solicitud para ${aptName} del ${checkIn} al ${checkOut}.`;
    const adminPhoneRaw = (booking.guest_phone || "").replace(/\D/g, "");
    const guestPhoneCell = adminPhoneRaw
      ? `<a href="https://wa.me/${adminPhoneRaw.startsWith("34") ? adminPhoneRaw : "34" + adminPhoneRaw}?text=${encodeURIComponent(adminWaMsg)}" style="color:#25D366;font-weight:bold;text-decoration:none;">${booking.guest_phone}</a>`
      : "No proporcionado";

    const adminHtml = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #556B2F; font-size: 24px;">Nueva solicitud de reserva</h1>
        <div style="background: #f9f8f5; border-radius: 16px; padding: 24px; margin: 16px 0;">
          <p><strong>Apartamento:</strong> ${aptName}</p>
          <p><strong>Huésped:</strong> ${booking.guest_name}</p>
          <p><strong>Email:</strong> <a href="mailto:${booking.guest_email}" style="color:#556B2F;">${booking.guest_email}</a></p>
          <p><strong>Teléfono:</strong> ${guestPhoneCell}</p>
          <p><strong>Fechas:</strong> ${checkIn} → ${checkOut}</p>
          <p><strong>Huéspedes:</strong> ${booking.pax_count || 2}</p>
          <p><strong>Precio:</strong> ${price}</p>
          ${booking.notes ? `<p><strong>Notas:</strong> ${booking.notes}</p>` : ""}
        </div>
        ${actionButtons}
        <p style="color: #888; font-size: 14px;">Tambien puedes gestionarla desde el panel admin.</p>
      </div>
    `;
    const adminEmail = await sendEmail(ADMIN_EMAIL, `Nueva reserva: ${booking.guest_name} - ${aptName}`, adminHtml);

    const guestWaMsg = `Hola, he enviado una solicitud de reserva para ${aptName} del ${checkIn} al ${checkOut}. Queria comentaros algo.`;
    const guestHtml = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #556B2F; font-size: 24px;">Hemos recibido tu solicitud</h1>
        <p>Hola ${booking.guest_name},</p>
        <p>Gracias por tu interés en alojarte con nosotros en <strong>${aptName}</strong>.</p>
        <div style="background: #f9f8f5; border-radius: 16px; padding: 24px; margin: 16px 0;">
          <p><strong>Entrada:</strong> ${checkIn}</p>
          <p><strong>Salida:</strong> ${checkOut}</p>
          <p><strong>Precio estimado:</strong> ${price}</p>
        </div>
        <p>Te confirmaremos la disponibilidad antes de 24 horas. Si necesitas algo, puedes escribirnos por WhatsApp al ${phoneLink(guestWaMsg)}.</p>
        <p style="color: #556B2F; font-weight: bold;">Apartamentos Rurales Tío José María</p>
        <p style="color: #888; font-size: 12px;">Calle Baja 1, 23486 Hinojares (Jaén)</p>
      </div>
    `;
    const guestEmail = await sendEmail(booking.guest_email, `Tu solicitud de reserva en Tío José María`, guestHtml);

    const whatsappMsg = `Nueva reserva web:\n${booking.guest_name}\n${aptName}\n${checkIn} → ${checkOut}\n${price}\nTel: ${booking.guest_phone || "sin tel"}\nEmail: ${booking.guest_email}`;
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${ADMIN_PHONE}&text=${encodeURIComponent(whatsappMsg)}`;

    const responseBody: Record<string, unknown> = { success: true, whatsapp_url: whatsappUrl };
    if (debug) {
      responseBody.debug = {
        from: FROM_ADDRESS,
        has_resend_key: !!RESEND_API_KEY,
        has_dedicated_sign_secret: !!Deno.env.get("BOOKING_SIGN_SECRET"),
        turnstile_active: !!TURNSTILE_SECRET,
        rate_limit_used: limit.current,
        rate_limit_max: perHour,
        ip,
        admin_email: adminEmail,
        guest_email: guestEmail,
        blocked_dates: blockedDatesResult,
      };
    }

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
