// Edge function: provision-access-code
// ======================================
// Genera código de cerradura electrónica por reserva.
//   - TTLock: API api.ttlock.com con clientId+clientSecret+username
//   - Nuki: api.nuki.io con bearer token
//   - manual: solo genera un código aleatorio y lo guarda (sin provider)
//
// Modo STUB si las credenciales del provider no están configuradas: genera
// un código aleatorio de 6 dígitos y lo persiste sin llamar al proveedor.
// Útil para validar el flujo + enviar el código al huésped por email.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TTLOCK_CLIENT_ID = Deno.env.get("TTLOCK_CLIENT_ID");
const TTLOCK_CLIENT_SECRET = Deno.env.get("TTLOCK_CLIENT_SECRET");
const TTLOCK_USERNAME = Deno.env.get("TTLOCK_USERNAME");
const TTLOCK_PASSWORD_MD5 = Deno.env.get("TTLOCK_PASSWORD_MD5");
const NUKI_API_TOKEN = Deno.env.get("NUKI_API_TOKEN");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const random6 = () => String(Math.floor(100000 + Math.random() * 900000));

interface ProvisionResult {
    code: string;
    providerRef: string | null;
    status: "active" | "pending_provision" | "error";
    error?: string;
}

// === TTLock (stub bracket; cuando el operador instale cerradura se ajusta) ===
async function provisionTtlock(opts: {
    lockDeviceId: string;
    validFrom: Date;
    validUntil: Date;
    bookingCode: string;
}): Promise<ProvisionResult> {
    if (!TTLOCK_CLIENT_ID || !TTLOCK_CLIENT_SECRET || !TTLOCK_USERNAME || !TTLOCK_PASSWORD_MD5) {
        return { code: random6(), providerRef: null, status: "pending_provision" };
    }
    // TTLock requiere login OAuth con username+password MD5, luego /v3/keyboardPwd/add
    // Se documentará e implementará al instalar la cerradura. Por ahora dejamos shape.
    return { code: random6(), providerRef: null, status: "pending_provision" };
}

// === Nuki ===
async function provisionNuki(opts: {
    lockDeviceId: string;
    validFrom: Date;
    validUntil: Date;
    bookingCode: string;
}): Promise<ProvisionResult> {
    if (!NUKI_API_TOKEN) {
        return { code: random6(), providerRef: null, status: "pending_provision" };
    }
    try {
        const code = random6();
        const res = await fetch(`https://api.nuki.io/smartlock/${opts.lockDeviceId}/auth`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${NUKI_API_TOKEN}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                name: opts.bookingCode,
                type: 13,   // keypad PIN
                code: parseInt(code, 10),
                allowedFromDate: opts.validFrom.toISOString(),
                allowedUntilDate: opts.validUntil.toISOString(),
            }),
        });
        if (!res.ok) {
            const text = await res.text();
            return { code, providerRef: null, status: "error", error: `Nuki ${res.status}: ${text.slice(0, 200)}` };
        }
        const data = await res.json() as { id?: string | number };
        return { code, providerRef: data.id ? String(data.id) : null, status: "active" };
    } catch (e) {
        return { code: random6(), providerRef: null, status: "error", error: e instanceof Error ? e.message : String(e) };
    }
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    let body: { bookingCode?: string };
    try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

    const code = (body.bookingCode || "").trim().toUpperCase();
    if (!code || !/^TJM-[A-Z0-9]{6}$/.test(code)) return json(400, { error: "invalid_booking_code" });

    const { data: booking, error: bErr } = await supabase
        .from("guest_bookings")
        .select("id, apartment_id, check_in, check_out, status, apartments(lock_provider, lock_device_id)")
        .eq("booking_code", code)
        .single();
    if (bErr || !booking) return json(404, { error: "booking_not_found" });
    if (!["confirmed", "completed"].includes(booking.status)) return json(409, { error: "booking_not_confirmed" });

    // Idempotencia: si ya hay un access_code activo para este booking, devolverlo
    const { data: existing } = await supabase
        .from("access_codes")
        .select("id, code, status")
        .eq("booking_id", booking.id)
        .in("status", ["active", "pending_provision"])
        .maybeSingle();
    if (existing) {
        return json(200, { code: existing.code, status: existing.status, skipped: "already_provisioned" });
    }

    const apt = booking.apartments as unknown as { lock_provider?: string; lock_device_id?: string };
    const provider = apt?.lock_provider || "manual";
    const lockDeviceId = apt?.lock_device_id || "";

    // Ventana de validez: check-in 16:00 a check-out 12:00 (Europe/Madrid).
    // Sumamos margen ±2h por flexibilidad operativa.
    const validFrom = new Date(`${booking.check_in}T14:00:00+02:00`);
    const validUntil = new Date(`${booking.check_out}T13:00:00+02:00`);

    let result: ProvisionResult;
    if (provider === "ttlock" && lockDeviceId) {
        result = await provisionTtlock({ lockDeviceId, validFrom, validUntil, bookingCode: code });
    } else if (provider === "nuki" && lockDeviceId) {
        result = await provisionNuki({ lockDeviceId, validFrom, validUntil, bookingCode: code });
    } else {
        result = { code: random6(), providerRef: null, status: "pending_provision" };
    }

    await supabase.from("access_codes").insert({
        booking_id: booking.id,
        apartment_id: booking.apartment_id,
        lock_provider: provider,
        lock_device_id: lockDeviceId || null,
        code: result.code,
        valid_from: validFrom.toISOString(),
        valid_until: validUntil.toISOString(),
        provider_ref: result.providerRef,
        status: result.status,
    });

    return json(200, { code: result.code, status: result.status, provider, error: result.error });
});
