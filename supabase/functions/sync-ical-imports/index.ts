// Edge function: sync-ical-imports
// =================================
// Lee apartments.airbnb_ical_url y apartments.booking_ical_url, descarga el
// feed, parsea, y reconcilia blocked_dates:
//   - Inserta nuevos rangos con source='airbnb' o 'booking'
//   - Borra los que ya no aparecen en el feed (cancelaciones)
//   - Idempotente: misma URL + mismo feed = sin cambios
//
// Trigger: invocada cada 30min por tjm-jobs sync-ical-channels.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { parseIcal } from "../_shared/ical.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

interface ApartmentRow {
    id: number;
    slug: string;
    name: string;
    airbnb_ical_url: string | null;
    booking_ical_url: string | null;
}

interface ExistingBlock {
    id: string;
    apartment_id: number;
    start_date: string;
    end_date: string;
    source: string | null;
}

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function fetchFeed(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, {
            headers: { "User-Agent": "TJM-iCal-Sync/1.0 (+https://tiojosemaria.com)" },
            redirect: "follow",
        });
        if (!res.ok) return null;
        return await res.text();
    } catch { return null; }
}

async function syncApartmentSource(apt: ApartmentRow, source: "airbnb" | "booking", url: string) {
    const feed = await fetchFeed(url);
    if (!feed) return { source, fetched: false, inserted: 0, removed: 0, parsed: 0 };

    const events = parseIcal(feed);
    // Booking/Airbnb emiten DTEND como día siguiente al último ocupado (exclusivo). Pasamos a inclusive: end_date = start...DTEND-1.
    const blocks = events
        .filter(e => e.status !== "CANCELLED")
        .map(e => {
            const endInclusive = new Date(e.end);
            endInclusive.setDate(endInclusive.getDate() - 1);
            return {
                start_date: e.start,
                end_date: endInclusive.toISOString().slice(0, 10),
            };
        })
        .filter(b => b.start_date <= b.end_date);

    // Cargar existentes del source
    const { data: existing } = await supabase
        .from("blocked_dates")
        .select("id, apartment_id, start_date, end_date, source")
        .eq("apartment_id", apt.id)
        .eq("source", source);

    const existingMap = new Map<string, ExistingBlock>();
    for (const b of (existing || []) as ExistingBlock[]) {
        existingMap.set(`${b.start_date}|${b.end_date}`, b);
    }
    const incomingKeys = new Set(blocks.map(b => `${b.start_date}|${b.end_date}`));

    // Insertar nuevos
    const toInsert = blocks.filter(b => !existingMap.has(`${b.start_date}|${b.end_date}`));
    let inserted = 0;
    if (toInsert.length > 0) {
        const { error } = await supabase
            .from("blocked_dates")
            .insert(toInsert.map(b => ({ ...b, apartment_id: apt.id, source })));
        if (!error) inserted = toInsert.length;
    }

    // Borrar los que ya no están (cancelaciones en el canal)
    const toRemoveIds = (existing || [])
        .filter(b => !incomingKeys.has(`${b.start_date}|${b.end_date}`))
        .map(b => b.id);
    let removed = 0;
    if (toRemoveIds.length > 0) {
        const { error } = await supabase.from("blocked_dates").delete().in("id", toRemoveIds);
        if (!error) removed = toRemoveIds.length;
    }

    return { source, fetched: true, parsed: events.length, inserted, removed };
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    const { data: apartments, error } = await supabase
        .from("apartments")
        .select("id, slug, name, airbnb_ical_url, booking_ical_url")
        .eq("is_active", true);

    if (error) return json(500, { error: error.message });

    const results: Array<{ apartment: string; airbnb?: unknown; booking?: unknown }> = [];

    for (const apt of (apartments || []) as ApartmentRow[]) {
        const entry: { apartment: string; airbnb?: unknown; booking?: unknown } = { apartment: apt.slug };
        if (apt.airbnb_ical_url) {
            entry.airbnb = await syncApartmentSource(apt, "airbnb", apt.airbnb_ical_url);
        }
        if (apt.booking_ical_url) {
            entry.booking = await syncApartmentSource(apt, "booking", apt.booking_ical_url);
        }
        results.push(entry);
    }

    return json(200, { syncedAt: new Date().toISOString(), results });
});
