// Edge function: recibir-datos-titular
// =====================================
// Receives the one-time encrypted form from /datos/:token (migration 0076).
// The browser encrypts everything with the operator's public RSA key, so this function only ever sees
// ciphertext. The link token is the only credential: it is random (32 bytes, base64url), stored as a
// sha256 hash, single use and expires in 7 days.
//
// POST { accion: "comprobar", token }            → { valido: boolean }
// POST { accion: "enviar", token, cifrado }      → { ok: true } | 4xx
// cifrado = { v: 1, k, iv, c }: base64 of the RSA-OAEP-wrapped AES-256-GCM key, the 12-byte IV and the ciphertext.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
});

const ORIGENES = ["https://tiojosemaria.com", "https://www.tiojosemaria.com", "http://localhost:3011"];

const cors = (origin: string | null) => ({
    "Access-Control-Allow-Origin": origin && ORIGENES.includes(origin) ? origin : ORIGENES[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
});

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const MAX_CIFRADO = 16_000; // chars of ciphertext: the form is ~1 KB of text

async function sha256Hex(texto: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
    const origin = req.headers.get("origin");
    const headers = { ...cors(origin), "content-type": "application/json" };
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

    if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
    if (req.method !== "POST") return json(405, { error: "metodo" });
    if (Number(req.headers.get("content-length") || 0) > 32_000) return json(413, { error: "demasiado_grande" });

    let body: { accion?: string; token?: string; cifrado?: { v?: number; k?: string; iv?: string; c?: string } };
    try { body = await req.json(); } catch { return json(400, { error: "json" }); }

    const token = String(body.token || "");
    if (!TOKEN.test(token)) return json(400, { valido: false });

    const { data: fila } = await supabase
        .from("datos_titular_envio")
        .select("id, expires_at, recibido_at")
        .eq("token_hash", await sha256Hex(token))
        .maybeSingle();

    const valido = !!fila && !fila.recibido_at && new Date(fila.expires_at) > new Date();

    if (body.accion === "comprobar") return json(200, { valido });
    if (body.accion !== "enviar") return json(400, { error: "accion" });
    if (!valido) return json(410, { error: "enlace_no_valido" });

    const c = body.cifrado;
    const bien = c && c.v === 1
        && typeof c.k === "string" && B64.test(c.k) && c.k.length >= 300 && c.k.length <= 700
        && typeof c.iv === "string" && B64.test(c.iv) && c.iv.length === 16
        && typeof c.c === "string" && B64.test(c.c) && c.c.length >= 40 && c.c.length <= MAX_CIFRADO;
    if (!bien) return json(400, { error: "formato" });

    // Single use: only the row that is still unused gets the ciphertext.
    const { data: guardado, error } = await supabase
        .from("datos_titular_envio")
        .update({ cifrado: { v: 1, k: c!.k, iv: c!.iv, c: c!.c }, recibido_at: new Date().toISOString() })
        .eq("id", fila!.id)
        .is("recibido_at", null)
        .select("id")
        .maybeSingle();

    if (error || !guardado) return json(410, { error: "enlace_no_valido" });
    return json(200, { ok: true });
});
