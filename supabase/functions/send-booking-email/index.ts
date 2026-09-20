// Edge function: send-booking-email
// ==================================
// Recibe { bookingCode, template } y envía el email transaccional
// correspondiente vía Resend. Idempotente: si el flag *_email_sent_at ya
// está marcado, no reenvía.
//
// Disparadores:
//   - stripe-webhook tras marcar booking confirmed → confirmation
//   - Trigger.dev cron diario daily-booking-emails → resto
//   - El panel de la madre (un toque, nunca solo) → booking_changed y
//     booking_cancelled. Estas dos EXIGEN sesión de staff o la clave de
//     servicio: con solo el código de reserva cualquiera podría decirle a
//     un huésped que su reserva está cancelada. `booking_changed` se puede
//     repetir (cada cambio, su aviso); `booking_cancelled` no.
//
// Env vars requeridas:
//   RESEND_API_KEY                 re_...
//   PUBLIC_SITE_URL                https://tiojosemaria.com (opcional)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { render, REPEATABLE_TEMPLATES, TEMPLATE_TO_FLAG, type TemplateKey } from "../_shared/templates/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const OPERATOR_NOTIFY_EMAIL = Deno.env.get("OPERATOR_NOTIFY_EMAIL") || "apartamentostiojosemaria@gmail.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const VALID_TEMPLATES: TemplateKey[] = [
    "confirmation", "reminder_7d", "reminder_24h",
    "review_request", "reactivation", "operator_new_booking", "operator_precheckin_done",
    "booking_changed", "booking_cancelled",
];

/** Las que manda una persona desde el panel: solo staff (o servicio). */
const STAFF_ONLY_TEMPLATES: TemplateKey[] = ["booking_changed", "booking_cancelled"];

/** Correos de relleno de las reservas de canal sin correo: ahí no se escribe.
 *  `example.invalid` lo ponen los importadores de ahora; `tiojosemaria.local`
 *  lo puso el barrido a mano del 11-sep. Ninguno de los dos es un buzón. */
const PLACEHOLDER_DOMAINS = ["@example.invalid", "@tiojosemaria.local"];
const esPlaceholder = (email: string) => {
    const e = email.toLowerCase();
    return PLACEHOLDER_DOMAINS.some((d) => e.endsWith(d));
};

function jwtRole(token: string): string | null {
    try {
        const payload = token.split(".")[1];
        if (!payload) return null;
        const txt = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        return (JSON.parse(txt) as { role?: string }).role ?? null;
    } catch { return null; }
}

/** Mismo criterio que issue-invoice: clave de servicio, o usuario con rol de gestión. */
async function esStaffOServicio(req: Request): Promise<boolean> {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return false;
    if (token === SUPABASE_SERVICE_ROLE_KEY || jwtRole(token) === "service_role") return true;
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return false;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    return !!role && ["admin", "staff", "contabilidad"].includes(role);
}

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });

async function sendResend(opts: { from: string; to: string; subject: string; html: string }) {
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: opts.from, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Resend ${res.status}: ${err.slice(0, 400)}`);
    }
    return await res.json() as { id?: string };
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    if (!RESEND_API_KEY) return json(503, { error: "resend_not_configured" });

    let body: {
        bookingCode?: string; template?: string;
        previous?: { check_in?: string; check_out?: string; apartment_name?: string } | null;
    };
    try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

    const code = (body.bookingCode || "").trim().toUpperCase();
    const template = body.template as TemplateKey | undefined;
    if (!code || !/^TJM-[A-Z0-9]{6}$/.test(code)) return json(400, { error: "invalid_booking_code" });
    if (!template || !VALID_TEMPLATES.includes(template)) return json(400, { error: "invalid_template" });

    if (STAFF_ONLY_TEMPLATES.includes(template) && !(await esStaffOServicio(req))) {
        return json(403, { error: "forbidden" });
    }

    const flag = TEMPLATE_TO_FLAG[template];
    // Los avisos internos van al buzón del negocio: no dependen del correo del
    // huésped (los de Holidu no lo tienen) ni de si vino por un canal.
    const esInterno = template.startsWith("operator_");

    // Cargar booking + apartment (incluye images para mostrar foto en el email)
    const { data: booking, error: bErr } = await supabase
        .from("guest_bookings")
        .select(`id, booking_code, guest_name, guest_email, check_in, check_out,
                 total_price, apartment_id, status, paid_amount, channel, internal_notes,
                 pax_count, ${flag},
                 apartments(name, slug, images)`)
        .eq("booking_code", code)
        .single();

    if (bErr || !booking) return json(404, { error: "booking_not_found" });
    if (!esInterno) {
        if (!booking.guest_email) return json(400, { error: "no_guest_email" });
        if (esPlaceholder(booking.guest_email)) {
            return json(200, { ok: true, skipped: "placeholder_email" });
        }
    }

    // Los avisos del panel van solo a quien reservó directo: al huésped de
    // Booking o Airbnb le escribe el canal, y escribirle nosotros encima
    // confunde (y en Airbnb el correo ni siquiera lo tenemos).
    if (STAFF_ONLY_TEMPLATES.includes(template)) {
        const canal = String(booking.channel || "").toLowerCase();
        if (["booking", "airbnb", "escapada", "casasrurales", "holidu"].includes(canal)) {
            return json(200, { ok: true, skipped: "channel_booking", channel: canal });
        }
        if (template === "booking_cancelled" && booking.status !== "cancelled") {
            return json(409, { error: "booking_not_cancelled" });
        }
        if (template === "booking_changed" && booking.status === "cancelled") {
            return json(409, { error: "booking_cancelled" });
        }
    }

    // Idempotencia: si ya se envió, no reenviar (salvo las que se repiten a propósito)
    if (!REPEATABLE_TEMPLATES.includes(template) && booking[flag as keyof typeof booking]) {
        return json(200, { ok: true, skipped: "already_sent", sentAt: booking[flag as keyof typeof booking] });
    }

    // RGPD: marketing requiere consentimiento explícito. review_request es interés legítimo
    // con opt-out (review_optout en customers).
    if (template === "reactivation" || template === "review_request") {
        const emailKey = booking.guest_email.toLowerCase().trim();
        const { data: c } = await supabase
            .from("customers")
            .select("marketing_consent, review_optout")
            .eq("email", emailKey)
            .maybeSingle();

        if (template === "reactivation" && !c?.marketing_consent) {
            return json(200, { ok: true, skipped: "no_marketing_consent", email: emailKey });
        }
        if (template === "review_request" && c?.review_optout) {
            return json(200, { ok: true, skipped: "review_opted_out", email: emailKey });
        }
    }

    // El de la víspera solo sale si faltan datos de la policía, y dice cuántos
    // (docs/CHECKIN-LEGAL.md, paso 1). Si están todos, no se manda nada y el
    // flag se queda a NULL: no se apunta como enviado algo que no se envió.
    // Se cuenta la tabla directamente: `v_parte_estado` pide sesión de staff
    // y aquí se entra con la clave de servicio.
    let precheckin: { rellenos: number; total: number } | null = null;
    if (template === "reminder_24h") {
        const { count, error: cErr } = await supabase
            .from("traveler_records")
            .select("id", { count: "exact", head: true })
            .eq("booking_id", booking.id);
        if (cErr) return json(500, { error: "precheckin_count_failed", detail: cErr.message });
        const total = Math.max(Number((booking as { pax_count?: number }).pax_count) || 1, 1);
        precheckin = { rellenos: count ?? 0, total };
        if (precheckin.rellenos >= total) {
            return json(200, { ok: true, skipped: "precheckin_completo", ...precheckin });
        }
    }

    // La confirmación solo habla de la policía si el formulario ya está abierto
    // (se abre 7 días antes de la llegada, migración 0018). Fecha en Madrid,
    // igual que send-booking-reminders.
    const hoyMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const diasHastaLlegada = Math.round((Date.parse(String(booking.check_in) + "T00:00:00Z") - Date.parse(hoyMadrid + "T00:00:00Z")) / 86400_000);
    const precheckin_abierto = diasHastaLlegada <= 7;

    const apt = (booking.apartments as unknown as { name: string; slug: string; images?: string[] }) || { name: "Apartamento", slug: "" };
    const firstImage = Array.isArray(apt.images) && apt.images.length > 0 ? apt.images[0] : null;

    // Si es notificacion al operador: cargar warnings + tags + preferences del CRM
    // para que Mari Carmen y Jesus vean el contexto del cliente inmediatamente.
    let customer_warnings: string[] = [];
    let customer_tags: string[] = [];
    let customer_preferences: string | null = null;
    if (template === "operator_new_booking") {
        const emailKey = booking.guest_email.toLowerCase().trim();
        const [{ data: notes }, { data: customer }] = await Promise.all([
            supabase.from("customer_notes").select("body").eq("customer_email", emailKey).eq("is_warning", true).order("created_at", { ascending: false }),
            supabase.from("customers").select("tags, preferences").eq("email", emailKey).maybeSingle(),
        ]);
        customer_warnings = (notes || []).map(n => n.body);
        customer_tags = customer?.tags || [];
        customer_preferences = customer?.preferences || null;
    }

    // Para el aviso de «ya han rellenado»: los nombres de pila, nada más.
    let precheckin_nombres: string[] = [];
    if (template === "operator_precheckin_done") {
        const { data: fichas } = await supabase.from("traveler_records").select("nombre, is_titular").eq("booking_id", booking.id).order("is_titular", { ascending: false });
        precheckin_nombres = (fichas || []).map((f) => String((f as { nombre?: string }).nombre || "").trim()).filter(Boolean);
    }

    const payload = {
        precheckin_nombres,
        booking_code: booking.booking_code,
        guest_name: booking.guest_name,
        guest_email: booking.guest_email,
        apartment_name: apt.name,
        apartment_slug: apt.slug,
        apartment_image: firstImage,
        check_in: booking.check_in,
        check_out: booking.check_out,
        total_price: Number(booking.total_price),
        customer_warnings,
        customer_tags,
        customer_preferences,
        precheckin,
        precheckin_abierto,
        previous: (template === "booking_changed" && body.previous && body.previous.check_in && body.previous.check_out)
            ? {
                check_in: String(body.previous.check_in),
                check_out: String(body.previous.check_out),
                apartment_name: String(body.previous.apartment_name || apt.name),
            }
            : null,
        // Lo que se le devuelve NO se fía del cliente: `cancel_booking` lo dejó
        // escrito en las notas («… a devolver 135 EUR»); si no está, se
        // recalcula con la misma regla (gratis con 7 días o más de antelación).
        ...(template === "booking_cancelled" ? (() => {
            const pagado = Number(booking.paid_amount || 0);
            const notas = String((booking as { internal_notes?: string | null }).internal_notes || "");
            const anotado = [...notas.matchAll(/a devolver ([0-9]+(?:[.,][0-9]+)?) EUR/gi)].pop();
            if (anotado) {
                const devolver = Number(anotado[1].replace(",", "."));
                return { paid_amount: pagado, refund_amount: devolver, free_cancellation: devolver > 0 || pagado === 0 };
            }
            const dias = Math.round((Date.parse(booking.check_in + "T00:00:00Z") - Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z")) / 86400_000);
            const gratis = dias >= 7;
            return { paid_amount: pagado, refund_amount: gratis ? Math.max(pagado, 0) : 0, free_cancellation: gratis };
        })() : {}),
    };

    const { subject, html, from } = render(template, payload);

    // El destinatario depende del template: operator_new_booking va al operador.
    const recipient = esInterno ? OPERATOR_NOTIFY_EMAIL : booking.guest_email;

    let resendId: string | undefined;
    try {
        const r = await sendResend({ from, to: recipient, subject, html });
        resendId = r.id;
    } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        // Un fallo de la API no pasa por el webhook: se apunta aquí (migración 0043).
        await supabase.from("envios").insert({
            canal: "correo", tipo: template, destinatario: recipient, asunto: subject,
            booking_id: booking.id, booking_code: booking.booking_code, estado: "error_api", detalle: detail.slice(0, 500),
        });
        return json(502, { error: "resend_error", detail });
    }
    // La fila del envío, con la reserva enganchada; el webhook de Resend la
    // irá actualizando (entregado, rebotado…). Si el webhook llega antes, el
    // upsert respeta lo que ya haya.
    await supabase.from("envios").upsert({
        canal: "correo", proveedor_id: resendId ?? null, tipo: template, destinatario: recipient, asunto: subject,
        booking_id: booking.id, booking_code: booking.booking_code, estado: "enviado",
    }, { onConflict: "proveedor_id", ignoreDuplicates: true });

    // Marcar flag como enviado (idempotencia). Si la confirmación salió con
    // todo (llegada a ≤ 7 días: cómo llegar, casa y policía), el de los 7 días
    // ya no aporta nada: se apunta también como enviado para no repetirlo.
    const ahora = new Date().toISOString();
    const flags: Record<string, string> = { [flag]: ahora };
    if (template === "confirmation" && precheckin_abierto) flags.reminder_7d_email_sent_at = ahora;
    await supabase
        .from("guest_bookings")
        .update(flags)
        .eq("id", booking.id);

    return json(200, { ok: true, template, resendId, sentTo: recipient });
});
