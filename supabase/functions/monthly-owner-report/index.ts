// Informe mensual al titular del alojamiento (NIF 26433801Q - Jesús Martínez Sánchez).
// Generado el día 1 de cada mes para el mes anterior. Cron Trigger.dev lo dispara.
//
// Calcula: ingresos, número de reservas, noches ocupadas, ocupación por apartamento,
// ingresos por extras, top huespedes recurrentes. Manda email HTML al titular.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const OWNER_EMAIL = Deno.env.get("OWNER_REPORT_EMAIL") || "apartamentostiojosemaria@gmail.com";
const FROM = "Tío José María <hola@tiojosemaria.com>";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const fmtEur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    if (!RESEND_API_KEY) return json(503, { error: "resend_not_configured" });

    let payload: { year?: number; month?: number; recipient?: string } = {};
    try { payload = await req.json(); } catch {}

    // Mes anterior por defecto
    const now = new Date();
    const year = payload.year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
    const month = payload.month || (now.getMonth() === 0 ? 12 : now.getMonth()); // 1-12
    const recipient = payload.recipient || OWNER_EMAIL;

    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Reservas con check_in dentro del mes
    const { data: bookings } = await supabase
        .from("guest_bookings")
        .select("id, booking_code, check_in, check_out, total_price, guest_name, status, source, apartments(name)")
        .gte("check_in", from).lte("check_in", to)
        .in("status", ["confirmed", "completed"])
        .order("check_in");

    const list = bookings || [];
    const totalRevenue = list.reduce((s, b) => s + Number(b.total_price || 0), 0);
    const totalNights = list.reduce((s, b) => s + Math.max(0, (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000), 0);

    // Por apartamento
    const byApt: Record<string, { bookings: number; nights: number; revenue: number }> = {};
    for (const b of list) {
        const aptName = (b.apartments as any)?.name || "Sin apartamento";
        if (!byApt[aptName]) byApt[aptName] = { bookings: 0, nights: 0, revenue: 0 };
        byApt[aptName].bookings++;
        byApt[aptName].nights += Math.max(0, (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000);
        byApt[aptName].revenue += Number(b.total_price || 0);
    }

    // Extras vendidos en el mes
    const { data: addonsSold } = await supabase
        .from("booking_addons")
        .select("unit_price_cents, quantity, name_snapshot, booking:guest_bookings!inner(check_in)")
        .gte("booking.check_in", from).lte("booking.check_in", to);
    const addonsRevenue = (addonsSold || []).reduce((s, a: any) => s + (a.unit_price_cents || 0) * (a.quantity || 1), 0) / 100;

    // Por fuente (de dónde vinieron)
    const bySource: Record<string, number> = {};
    for (const b of list) {
        const src = b.source || "web";
        bySource[src] = (bySource[src] || 0) + 1;
    }

    const monthName = MONTHS[month - 1];
    const subject = `Informe de ${monthName} ${year} — Tío José María`;
    const html = `<!DOCTYPE html><html lang="es"><body style="margin:0;background:#FCFBF9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#2C3319;line-height:1.6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FCFBF9;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #F0EDE6;border-radius:18px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#556B2F,#4A5D28);padding:28px 32px;color:#fff;">
    <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">Informe mensual</p>
    <h1 style="margin:6px 0 0;font-family:Playfair Display,Georgia,serif;font-size:24px;">${monthName} ${year}</h1>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="font-family:Playfair Display,Georgia,serif;color:#2C3319;margin:0 0 16px;font-size:20px;">Resumen del mes</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr>
        <td style="padding:12px;background:#FCFBF9;border:1px solid #F0EDE6;border-radius:12px;width:50%;"><p style="margin:0;font-size:11px;text-transform:uppercase;color:#8C8468;letter-spacing:2px;font-weight:700;">Ingresos totales</p><p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#556B2F;">${fmtEur(totalRevenue)}</p></td>
        <td style="width:12px;"></td>
        <td style="padding:12px;background:#FCFBF9;border:1px solid #F0EDE6;border-radius:12px;width:50%;"><p style="margin:0;font-size:11px;text-transform:uppercase;color:#8C8468;letter-spacing:2px;font-weight:700;">Reservas</p><p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#556B2F;">${list.length}</p></td>
      </tr>
      <tr><td colspan="3" style="height:12px;"></td></tr>
      <tr>
        <td style="padding:12px;background:#FCFBF9;border:1px solid #F0EDE6;border-radius:12px;"><p style="margin:0;font-size:11px;text-transform:uppercase;color:#8C8468;letter-spacing:2px;font-weight:700;">Noches ocupadas</p><p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#556B2F;">${totalNights}</p></td>
        <td></td>
        <td style="padding:12px;background:#FCFBF9;border:1px solid #F0EDE6;border-radius:12px;"><p style="margin:0;font-size:11px;text-transform:uppercase;color:#8C8468;letter-spacing:2px;font-weight:700;">Extras vendidos</p><p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#556B2F;">${fmtEur(addonsRevenue)}</p></td>
      </tr>
    </table>

    <h3 style="font-family:Playfair Display,Georgia,serif;color:#2C3319;margin:24px 0 12px;font-size:18px;">Por apartamento</h3>
    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
      <tr style="background:#FCFBF9;text-align:left;"><th style="padding:8px;font-size:11px;text-transform:uppercase;color:#8C8468;font-weight:700;">Apartamento</th><th style="padding:8px;font-size:11px;text-transform:uppercase;color:#8C8468;font-weight:700;text-align:center;">Reservas</th><th style="padding:8px;font-size:11px;text-transform:uppercase;color:#8C8468;font-weight:700;text-align:center;">Noches</th><th style="padding:8px;font-size:11px;text-transform:uppercase;color:#8C8468;font-weight:700;text-align:right;">Ingresos</th></tr>
      ${Object.entries(byApt).map(([name, v]) => `<tr style="border-top:1px solid #F0EDE6;"><td style="padding:8px;">${name}</td><td style="padding:8px;text-align:center;">${v.bookings}</td><td style="padding:8px;text-align:center;">${v.nights}</td><td style="padding:8px;text-align:right;font-weight:700;">${fmtEur(v.revenue)}</td></tr>`).join("")}
    </table>

    <h3 style="font-family:Playfair Display,Georgia,serif;color:#2C3319;margin:24px 0 12px;font-size:18px;">De dónde vinieron</h3>
    <p style="margin:0;font-size:14px;">${Object.entries(bySource).map(([s, n]) => `${s}: <strong>${n}</strong>`).join(" · ")}</p>

    <p style="margin-top:32px;font-size:12px;color:#8C8468;">Datos extraídos el ${new Date().toLocaleString("es-ES")}. Para detalle completo, entra en el panel de gestión.</p>
  </td></tr>
  <tr><td style="padding:20px 32px;border-top:1px solid #F0EDE6;background:#FCFBF9;font-size:12px;color:#8C8468;">Apartamentos Rurales Tío José María · RTA VTAR/JA/00044 · NIF 26433801Q</td></tr>
</table></td></tr></table></body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: FROM, to: recipient, subject, html }),
    });
    if (!res.ok) { const err = await res.text(); return json(502, { error: "resend_error", detail: err }); }
    const r = await res.json();

    // Auditoría
    await supabase.from("owner_reports").upsert({
        period_year: year, period_month: month,
        sent_at: new Date().toISOString(), sent_to: recipient,
        bookings_count: list.length, nights_count: Math.round(totalNights),
        revenue_cents: Math.round(totalRevenue * 100),
        addons_revenue_cents: Math.round(addonsRevenue * 100),
    }, { onConflict: "period_year,period_month" });

    return json(200, { ok: true, resendId: r.id, year, month, bookings: list.length, revenue: totalRevenue });
});
