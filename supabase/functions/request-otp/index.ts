// Genera código OTP de 6 dígitos, lo guarda hasheado, manda email branded vía Resend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encode as b64encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SR_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Tío José María <hola@tiojosemaria.com>";
const supabase = createClient(SUPABASE_URL, SR_KEY, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

async function sha256(s: string): Promise<string> {
    const data = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return b64encode(new Uint8Array(hash));
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    if (!RESEND_API_KEY) return json(503, { error: "resend_not_configured" });

    let body: { email?: string };
    try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
    const email = (body.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "invalid_email" });

    // Rate limiting básico: máximo 3 códigos por email en 10 min
    const { count } = await supabase
        .from("otp_codes").select("id", { count: "exact", head: true })
        .eq("email", email)
        .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
    if ((count || 0) >= 3) return json(429, { error: "too_many_requests", retry_after_seconds: 600 });

    // Comprobar que el email pertenece a un huésped real (tiene reserva o ya hay profile)
    const [{ data: profile }, { data: booking }] = await Promise.all([
        supabase.from("profiles").select("id").eq("email", email).maybeSingle(),
        supabase.from("guest_bookings").select("id").ilike("guest_email", email).limit(1).maybeSingle(),
    ]);
    if (!profile && !booking) {
        // No revelamos al atacante si el email existe o no — devolvemos OK silencioso
        // (UX: el usuario verá "si tu email está registrado recibirás un código")
        return json(200, { ok: true, sent: false });
    }

    // Generar código y guardar
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256(code + email);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from("otp_codes").insert({
        email, code_hash, expires_at,
        requested_ip: req.headers.get("x-forwarded-for") || null,
        requested_ua: req.headers.get("user-agent") || null,
    });

    // Email branded
    const html = `<!DOCTYPE html><html lang="es"><body style="margin:0;background:#FCFBF9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#2C3319;line-height:1.6;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#FCFBF9;padding:32px 16px;"><tr><td align="center"><table width="500" cellpadding="0" cellspacing="0" style="max-width:500px;background:#fff;border:1px solid #F0EDE6;border-radius:18px;overflow:hidden;"><tr><td style="background:linear-gradient(135deg,#556B2F,#4A5D28);padding:28px 32px;color:#fff;"><p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:0.85;">Acceso a tu cuenta</p><h1 style="margin:6px 0 0;font-family:Fraunces,Georgia,serif;font-size:24px;">Tío José María</h1></td></tr><tr><td style="padding:36px 32px;text-align:center;"><p style="margin:0 0 24px;font-size:15px;color:#2C3319;">Tu código para entrar es:</p><p style="margin:0 0 24px;font-family:'SF Mono',Menlo,monospace;font-size:42px;font-weight:700;letter-spacing:12px;color:#556B2F;background:#FCFBF9;padding:20px 16px;border-radius:14px;border:1px dashed #C4B894;">${code}</p><p style="margin:0;font-size:13px;color:#8C8468;">Caduca en 10 minutos. Si no has sido tú, ignora este correo.</p></td></tr><tr><td style="padding:20px 32px;border-top:1px solid #F0EDE6;background:#FCFBF9;font-size:12px;color:#8C8468;">Mari Carmen y Jesús · Apartamentos Rurales Tío José María · Hinojares (Jaén)</td></tr></table></td></tr></table></body></html>`;
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: FROM, to: email, subject: `Tu código de acceso: ${code}`, html }),
    });
    if (!res.ok) return json(502, { error: "resend_error" });

    return json(200, { ok: true, sent: true });
});
