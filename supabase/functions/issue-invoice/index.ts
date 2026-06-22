// Edge function: issue-invoice
// =============================
// Llama a RPC issue_invoice (idempotente, hash chain Verifactu) y dispara
// el envío al sistema AEAT (submit-verifactu) en fire-and-forget.
//
// Llamada típica desde stripe-webhook tras checkout.session.completed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "content-type": "application/json" } });

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    let body: { bookingCode?: string; receptorNif?: string; receptorNombre?: string; receptorDireccion?: string; receptorEmail?: string };
    try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

    const code = (body.bookingCode || "").trim().toUpperCase();
    if (!code || !/^TJM-[A-Z0-9]{6}$/.test(code)) return json(400, { error: "invalid_booking_code" });

    const { data: booking, error: bErr } = await supabase
        .from("guest_bookings")
        .select("id, status")
        .eq("booking_code", code)
        .single();
    if (bErr || !booking) return json(404, { error: "booking_not_found" });
    if (!["confirmed", "completed"].includes(booking.status)) return json(409, { error: "booking_not_confirmed" });

    const { data, error } = await supabase.rpc("issue_invoice", {
        p_booking_id: booking.id,
        p_receptor_nif: body.receptorNif || null,
        p_receptor_nombre: body.receptorNombre || null,
        p_receptor_direccion: body.receptorDireccion || null,
        p_receptor_email: body.receptorEmail || null,
    });
    if (error) return json(500, { error: error.message });

    const inv = Array.isArray(data) ? data[0] : data;

    // Disparar envío Verifactu en fire-and-forget
    fetch(`${SUPABASE_URL}/functions/v1/submit-verifactu`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ invoiceId: inv.invoice_id }),
    }).catch(e => console.warn("[issue-invoice] verifactu fire-and-forget:", e));

    return json(200, { invoice: inv });
});
