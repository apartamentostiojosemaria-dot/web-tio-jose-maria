import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("RESEND_FROM") || "Tío José María <reservas@tiojosemaria.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://n8nlmfb-tiojosemaria.fhsavp.easypanel.host";
// CN-002: secret dedicado para firmar los enlaces 1-click. Si no esta
// definido cae al service role key (compat hacia atras). Una vez el usuario
// anada BOOKING_SIGN_SECRET en Edge Function Secrets, rotar el service role
// key ya no rompe los enlaces de email pendientes.
const SIGN_SECRET = Deno.env.get("BOOKING_SIGN_SECRET") || SUPABASE_SERVICE_ROLE_KEY;
const WA_PHONE = "34676344675";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function whatsappLink(text: string) {
  return `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(text)}`;
}
function phoneLink(message: string) {
  return `<a href="${whatsappLink(message)}" style="color:#25D366;font-weight:bold;text-decoration:none;">676 34 46 75</a>`;
}

async function verifyToken(bookingId: string, action: string, token: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SIGN_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${bookingId}:${action}`));
  // CN-002: HMAC completo 64 hex chars (256 bits), no truncar
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { skipped: true };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  return res.json();
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function redirect(query: Record<string, string>) {
  const qs = new URLSearchParams(query).toString();
  return new Response(null, {
    status: 302,
    headers: { Location: `${SITE_URL}/admin/respuesta?${qs}` },
  });
}

async function findAlternatives(admin: ReturnType<typeof createClient>, currentApartmentId: number, checkIn: string, checkOut: string, paxCount: number) {
  const { data: candidates } = await admin
    .from("apartments")
    .select("id, name, slug, price_low, capacity_people")
    .eq("is_active", true)
    .neq("id", currentApartmentId)
    .gte("capacity_people", paxCount || 1);
  if (!candidates || candidates.length === 0) return [];
  const { data: conflicts } = await admin
    .from("blocked_dates")
    .select("apartment_id")
    .lt("start_date", checkOut)
    .gt("end_date", checkIn);
  const busyIds = new Set((conflicts || []).map(c => c.apartment_id as number));
  return candidates.filter(c => !busyIds.has(c.id as number));
}

async function handleAction(bookingId: number, action: "confirm" | "reject", reason: string | null) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: booking } = await supabase
    .from("guest_bookings")
    .select("*, apartments(name)")
    .eq("id", bookingId)
    .single();
  if (!booking) return { error: "not_found" };
  const alreadyProcessed = booking.status === "confirmed" || booking.status === "rejected";
  const newStatus = action === "confirm" ? "confirmed" : "rejected";
  const aptName = booking.apartments?.name || "Apartamento";
  const checkIn = formatDate(booking.check_in);
  const checkOut = formatDate(booking.check_out);
  const price = booking.total_price ? `${booking.total_price}€` : "A confirmar";

  if (!alreadyProcessed) {
    await supabase.from("guest_bookings")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", bookingId);

    if (action === "confirm") {
      await supabase.from("blocked_dates")
        .update({ source: "confirmed" })
        .eq("apartment_id", booking.apartment_id)
        .eq("start_date", booking.check_in)
        .eq("end_date", booking.check_out)
        .eq("source", "booking_pending");

      const waMsg = `Hola, acabo de recibir la confirmacion de mi reserva en ${aptName} del ${checkIn} al ${checkOut}. Tengo una consulta.`;
      const html = `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: #dcfce7; margin: 0 auto 16px; line-height: 64px; font-size: 32px;">✓</div>
            <h1 style="color: #556B2F; font-size: 28px; margin: 0;">Reserva Confirmada</h1>
          </div>
          <p>Hola ${booking.guest_name},</p>
          <p>Nos alegra confirmarte tu estancia en <strong>${aptName}</strong>.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 24px; margin: 16px 0;">
            <p><strong>Entrada:</strong> ${checkIn}</p>
            <p><strong>Salida:</strong> ${checkOut}</p>
            <p><strong>Precio total:</strong> ${price}</p>
          </div>
          <h3 style="color: #556B2F;">Información útil</h3>
          <ul style="color: #555;">
            <li>Entrada a partir de las <strong>16:00</strong></li>
            <li>Salida antes de las <strong>12:00</strong></li>
            <li>Dirección: <strong>Calle Baja 1, 23486 Hinojares (Jaén)</strong></li>
          </ul>
          <p>Si tienes cualquier duda, escríbenos por WhatsApp al ${phoneLink(waMsg)}.</p>
          <p style="color: #556B2F; font-weight: bold; margin-top: 24px;">Apartamentos Rurales Tío José María</p>
        </div>
      `;
      await sendEmail(booking.guest_email, `Reserva confirmada - ${aptName}`, html);
    } else {
      const alternatives = await findAlternatives(supabase, booking.apartment_id, booking.check_in, booking.check_out, booking.pax_count || 1);
      let alternativesBlock = "";
      if (alternatives.length > 0) {
        const items = alternatives.map(a => `
          <a href="${SITE_URL}/apartamento/${a.slug}" style="display:block;background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:8px 0;text-decoration:none;color:#374151;">
            <strong style="color: #556B2F; font-size: 16px;">${a.name}</strong>
            <span style="color:#6b7280;font-size:14px;"> · ${a.capacity_people} plazas · desde ${a.price_low}€/noche</span>
            <span style="display:block;color:#556B2F;font-size:13px;font-weight:bold;margin-top:4px;">Ver disponibilidad y reservar →</span>
          </a>
        `).join("");
        alternativesBlock = `
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:16px;padding:20px;margin:24px 0;">
            <p style="margin:0 0 12px;color:#166534;font-weight:bold;">¡Tenemos otros apartamentos libres para esos días!</p>
            ${items}
          </div>
        `;
      } else {
        alternativesBlock = `
          <p style="color:#374151;">Sentimos que para esos días concretos no tengamos ningún apartamento disponible. Si puedes mover las fechas, en nuestra web verás la disponibilidad en tiempo real.</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="${SITE_URL}/#apartamentos" style="display:inline-block;background:#556B2F;color:white;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:bold;">Ver otras fechas →</a>
          </p>
        `;
      }
      const waMsg = `Hola, me han comunicado que ${aptName} no esta disponible del ${checkIn} al ${checkOut}. ¿Podriamos hablarlo y ver alternativas?`;
      const html = `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #556B2F; font-size: 24px;">Sobre tu solicitud de reserva</h1>
          <p>Hola ${booking.guest_name},</p>
          <p>Sentimos comunicarte que <strong>${aptName}</strong> no tiene disponibilidad para las fechas que solicitaste (${checkIn} → ${checkOut}).</p>
          ${reason ? `<div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin: 16px 0;"><p style="margin: 0; color: #92400e;"><strong>Motivo:</strong> ${reason}</p></div>` : ""}
          ${alternativesBlock}
          <p style="color:#374151;">Si prefieres hablarlo, escríbenos por WhatsApp al ${phoneLink(waMsg)} y te ayudamos a encontrar la mejor opción.</p>
          <p style="color: #556B2F; font-weight: bold; margin-top: 24px;">Apartamentos Rurales Tío José María</p>
        </div>
      `;
      await sendEmail(booking.guest_email, `Sobre tu solicitud de reserva - ${aptName}`, html);
      await supabase.from("blocked_dates")
        .delete()
        .eq("apartment_id", booking.apartment_id)
        .eq("start_date", booking.check_in)
        .eq("end_date", booking.check_out)
        .eq("source", "booking_pending");
    }
  }
  return { ok: true, alreadyProcessed, aptName, guestName: booking.guest_name, checkIn, checkOut, price, newStatus };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);

  if (req.method === "GET") {
    const id = url.searchParams.get("id");
    const action = url.searchParams.get("action") as "confirm" | "reject" | null;
    const token = url.searchParams.get("t");
    if (!id || !action || !token || !"confirm reject".includes(action)) {
      return redirect({ status: "error", reason: "invalid_link" });
    }
    const valid = await verifyToken(id, action, token);
    if (!valid) return redirect({ status: "error", reason: "invalid_token" });
    const result = await handleAction(parseInt(id, 10), action, null);
    if ("error" in result) return redirect({ status: "error", reason: result.error });
    return redirect({
      status: result.alreadyProcessed ? "already" : "ok",
      action, apt: result.aptName, guest: result.guestName,
      checkIn: result.checkIn, checkOut: result.checkOut, price: result.price,
    });
  }

  try {
    const { booking_id, status, reason } = await req.json();
    if (!booking_id || !status) {
      return new Response(JSON.stringify({ error: "booking_id and status required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const action = status === "confirmed" ? "confirm" : "reject";
    const result = await handleAction(booking_id, action, reason || null);
    if ("error" in result) {
      return new Response(JSON.stringify(result),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: true, alreadyProcessed: result.alreadyProcessed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
