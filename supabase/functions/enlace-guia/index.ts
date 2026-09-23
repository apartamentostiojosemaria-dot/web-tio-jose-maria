// Edge function: enlace-guia
// ==========================
// «He perdido el enlace» de /guia. Recibe { email }, busca reservas VIVAS con
// ese correo (confirmadas o terminadas hace menos de 30 días) y manda a ESE
// correo el enlace de cada una (plantilla guide_link). Al que llama siempre se
// le contesta lo mismo, haya reserva o no: así nadie puede usar esta puerta
// para saber si un correo tiene reserva. Tope: 3 peticiones por hora y IP
// (tabla rate_limits, como send-guide).
//
// Env: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { render } from "../_shared/templates/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const PLACEHOLDER = ["@example.invalid", "@tiojosemaria.local", "@guest.booking.com"];

async function rateLimited(req: Request): Promise<boolean> {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const windowStart = new Date(); windowStart.setMinutes(0, 0, 0);
    const key = `enlace-guia:${ip}`;
    const { data: row } = await admin.from("rate_limits").select("id, count")
        .eq("key", key).eq("window_start", windowStart.toISOString()).maybeSingle();
    if (row) {
        if (row.count >= 3) return true;
        await admin.from("rate_limits").update({ count: row.count + 1 }).eq("id", row.id);
    } else {
        await admin.from("rate_limits").insert({ key, window_start: windowStart.toISOString(), count: 1 });
    }
    return false;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    let email = "";
    try { email = String(((await req.json()) as { email?: string }).email || "").trim().toLowerCase(); } catch { /* sin cuerpo */ }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: "email_invalido" });
    if (await rateLimited(req)) return json(429, { error: "rate_limit" });

    // Siempre la misma respuesta hacia fuera; lo que pase dentro no se cuenta.
    const respuesta = { ok: true };
    if (PLACEHOLDER.some((d) => email.endsWith(d)) || !RESEND_API_KEY) return json(200, respuesta);

    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const limite = new Date(hoy + "T00:00:00Z"); limite.setUTCDate(limite.getUTCDate() - 30);

    const { data: reservas } = await admin
        .from("guest_bookings")
        .select("booking_code, guest_name, guest_email, check_in, check_out, total_price, idioma, apartments(name, slug, images)")
        .ilike("guest_email", email)
        .in("status", ["confirmed", "completed"])
        .gte("check_out", limite.toISOString().slice(0, 10))
        .order("check_in", { ascending: true })
        .limit(5);

    for (const b of reservas ?? []) {
        const apt = (b.apartments as unknown as { name: string; slug: string; images?: string[] }) || { name: "Apartamento", slug: "" };
        const { subject, html, from } = render("guide_link", {
            booking_code: b.booking_code,
            guest_name: b.guest_name,
            guest_email: b.guest_email,
            apartment_name: apt.name,
            apartment_slug: apt.slug,
            apartment_image: Array.isArray(apt.images) && apt.images.length ? apt.images[0] : null,
            check_in: b.check_in,
            check_out: b.check_out,
            total_price: Number(b.total_price),
            idioma: (b as { idioma?: string | null }).idioma ?? null,
        });
        await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: b.guest_email, subject, html }),
        }).catch(() => null);
    }

    return json(200, respuesta);
});
