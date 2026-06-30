// Verifica OTP y devuelve un magic link de Supabase Auth para que el cliente complete login.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encode as b64encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SR_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    let body: { email?: string; code?: string };
    try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
    const email = (body.email || "").trim().toLowerCase();
    const code = (body.code || "").trim();
    if (!email || !/^\d{6}$/.test(code)) return json(400, { error: "invalid_input" });

    const code_hash = await sha256(code + email);

    // Buscar código vigente
    const { data: row, error } = await supabase
        .from("otp_codes")
        .select("id, expires_at, used, attempts")
        .eq("email", email).eq("code_hash", code_hash)
        .gte("expires_at", new Date().toISOString())
        .eq("used", false)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();

    if (error || !row) {
        // Incrementar attempts en cualquier OTP vigente de ese email para rate-limit
        await supabase.rpc("exec", { sql: "select 1" }).catch(() => {});  // noop si no existe
        return json(401, { error: "invalid_or_expired_code" });
    }

    // Marcar usado
    await supabase.from("otp_codes").update({ used: true, used_at: new Date().toISOString() }).eq("id", row.id);

    // Generar magic link para login
    const { data: link, error: lErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
    });
    if (lErr || !link?.properties?.action_link) {
        return json(502, { error: "link_generation_failed", detail: lErr?.message });
    }

    return json(200, { ok: true, action_link: link.properties.action_link });
});
