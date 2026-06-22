// Edge function: ical-export
// ===========================
// GET /functions/v1/ical-export?slug=albahaca
// Devuelve un .ics con todas las reservas activas (hold, pending, confirmed)
// del apartamento + los blocked_dates de fuentes externas (Airbnb/Booking) +
// los bloqueos manuales del admin.
//
// Booking, Airbnb y Vrbo consumen esta URL como "iCal import" para no
// hacer double-booking con reservas que vienen de canales propios o de
// otros OTAs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildIcalFeed } from "../_shared/ical.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

Deno.serve(async (req) => {
    if (req.method !== "GET") return new Response("method_not_allowed", { status: 405 });

    const url = new URL(req.url);
    const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
    if (!slug || !/^[a-z0-9-]{2,40}$/.test(slug)) {
        return new Response("invalid_slug", { status: 400 });
    }

    const { data: apt, error: aErr } = await supabase
        .from("apartments")
        .select("id, slug, name, is_active")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

    if (aErr || !apt) return new Response("apartment_not_found", { status: 404 });

    // Reservas activas
    const { data: bookings } = await supabase
        .from("guest_bookings")
        .select("booking_code, check_in, check_out, status")
        .eq("apartment_id", apt.id)
        .in("status", ["hold", "pending", "confirmed"])
        .gte("check_out", new Date().toISOString().slice(0, 10));

    // Bloqueos externos + manuales — convertir a "reserva" sintética por uniformidad
    const { data: blocks } = await supabase
        .from("blocked_dates")
        .select("id, start_date, end_date, source")
        .eq("apartment_id", apt.id)
        .gte("end_date", new Date().toISOString().slice(0, 10));

    const blockEvents = (blocks || []).map(b => ({
        booking_code: `BLOCK-${b.id.slice(0, 8)}`,
        check_in: b.start_date,
        // En iCal DTEND es exclusivo; nuestro end_date es inclusive → +1 día
        check_out: new Date(new Date(b.end_date).getTime() + 86400000).toISOString().slice(0, 10),
        status: "confirmed" as const,
    }));

    const allEvents = [...(bookings || []), ...blockEvents];

    const ics = buildIcalFeed({
        apartmentSlug: apt.slug,
        apartmentName: apt.name,
        bookings: allEvents,
    });

    return new Response(ics, {
        status: 200,
        headers: {
            "content-type": "text/calendar; charset=utf-8",
            "content-disposition": `inline; filename="${apt.slug}.ics"`,
            "cache-control": "public, max-age=600",         // 10min cache
            "access-control-allow-origin": "*",
        },
    });
});
