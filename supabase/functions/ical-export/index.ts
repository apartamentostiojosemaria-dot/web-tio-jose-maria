// Edge function: ical-export
// ===========================
// Publica el calendario de ocupación de un apartamento para que Airbnb,
// Booking, EscapadaRural y CasasRurales.net lo importen.
//
//   GET /ical/{slug}.ics                 -> todo lo que ocupa
//   GET /ical/{slug}-{canal}.ics         -> todo MENOS lo que vino de ese canal
//   GET /functions/v1/ical-export?slug=albahaca&for=airbnb   (equivalente)
//
// POR QUÉ HAY UN FEED POR CANAL — el bucle
// ----------------------------------------
// TJM es el centro: cada canal le manda su ocupación y TJM se la reparte a
// los demás. Si al feed que lee Airbnb le metemos los bloqueos que vinieron
// DE Airbnb, Airbnb se ve a sí mismo reflejado: sus propias reservas le
// vuelven como "bloqueo externo". Eso ensucia su calendario, y cuando una
// reserva se cancela deja fantasmas que ya no controla nadie.
//
// La regla es simple: al feed de un canal se le quita SOLO lo que vino de ese
// canal. Todo lo demás (reservas propias de la web, teléfono, WhatsApp,
// bloqueos manuales, cierres, y lo que hayan mandado los OTROS canales) sí
// va, que es justo para lo que sirve el sistema.
//
// El sufijo del slug (`albahaca-airbnb`) evita tocar nginx: la regla que ya
// existe (`^/ical/([a-z0-9-]+)\.ics$`) lo redirige tal cual.
//
// UID ESTABLE: si el UID de un evento cambia entre pasadas, el canal de
// destino borra y recrea. Aquí el UID sale del `booking_code` (o del id, si
// la reserva aún no tiene código) y del id del bloqueo, que son estables.
//
// Fechas: eventos de día completo (VALUE=DATE). En hospedaje una noche no
// tiene hora; meter horas y husos es la forma más rápida de desplazar un día.
//   guest_bookings.check_out = día de salida  -> DTEND tal cual (exclusivo)
//   blocked_dates.end_date   = última noche   -> DTEND = end_date + 1

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildIcalFeed, type EventoIcal } from "./ical.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const CANALES: Record<string, string> = {
    airbnb: "Airbnb",
    booking: "Booking",
    escapada: "Escapada Rural",
    casasrurales: "CasasRurales.net",
};

const hoy = () => new Date().toISOString().slice(0, 10);
const masUnDia = (iso: string) =>
    new Date(Date.parse(iso + "T00:00:00Z") + 86_400_000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
        return new Response("method_not_allowed", { status: 405 });
    }

    const url = new URL(req.url);
    let slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
    let excluir = (url.searchParams.get("for") || "").trim().toLowerCase();

    if (!slug || !/^[a-z0-9-]{2,40}$/.test(slug)) return new Response("invalid_slug", { status: 400 });

    // `albahaca-airbnb` -> apartamento `albahaca`, se excluye el canal `airbnb`.
    if (!excluir) {
        for (const canal of Object.keys(CANALES)) {
            if (slug.endsWith(`-${canal}`)) {
                excluir = canal;
                slug = slug.slice(0, -(canal.length + 1));
                break;
            }
        }
    }
    if (excluir && !CANALES[excluir]) return new Response("canal_desconocido", { status: 400 });

    const { data: apt, error: aErr } = await supabase
        .from("apartments")
        .select("id, slug, name, is_active")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

    if (aErr || !apt) return new Response("apartment_not_found", { status: 404 });

    const desde = hoy();
    const eventos: EventoIcal[] = [];

    // --- Reservas: propias (web, teléfono, WhatsApp…) y las importadas de
    //     OTROS canales. Nunca las del canal al que le estamos hablando.
    //     `channel` puede no existir todavía: se cae a `source`, que existe
    //     desde siempre y lleva el mismo valor en las reservas importadas.
    let reservas: Array<Record<string, unknown>> = [];
    {
        const sel = await supabase
            .from("guest_bookings")
            .select("id, booking_code, check_in, check_out, status, source, channel")
            .eq("apartment_id", apt.id)
            .in("status", ["hold", "pending", "confirmed"])
            .gte("check_out", desde);
        if (sel.error) {
            const legacy = await supabase
                .from("guest_bookings")
                .select("id, booking_code, check_in, check_out, status, source")
                .eq("apartment_id", apt.id)
                .in("status", ["hold", "pending", "confirmed"])
                .gte("check_out", desde);
            reservas = (legacy.data || []) as Array<Record<string, unknown>>;
        } else {
            reservas = (sel.data || []) as Array<Record<string, unknown>>;
        }
    }

    for (const b of reservas) {
        // Una reserva de prueba NO sale a los canales. El repo marca las
        // pruebas con source='test' (regla del plan): si se colara, bloquearia
        // fechas de verdad en Airbnb o Booking por una fila que no existe.
        if (b.source === "test") continue;
        const origen = ((b.channel ?? b.source) || "web") as string;
        if (excluir && origen === excluir) continue;   // ← corta el bucle
        eventos.push({
            uid: (b.booking_code as string) || `TJM-R${b.id}`,
            inicio: b.check_in as string,
            fin: b.check_out as string,
            estado: b.status as string,
            titulo: CANALES[origen]
                ? `Reservado (${CANALES[origen]}) — ${apt.name}`
                : `Reservado — ${apt.name}`,
        });
    }

    // --- Bloqueos: manuales, cierres de venta y los importados de otros canales.
    const { data: bloqueos } = await supabase
        .from("blocked_dates")
        .select("id, start_date, end_date, source, reason")
        .eq("apartment_id", apt.id)
        .gte("end_date", desde);

    for (const b of (bloqueos || []) as Array<Record<string, unknown>>) {
        const origen = (b.source as string) || "manual";
        if (excluir && origen === excluir) continue;   // ← corta el bucle
        const etiqueta = CANALES[origen]
            ? `Reservado (${CANALES[origen]})`
            : origen === "cierre" ? "No disponible" : "No disponible";
        eventos.push({
            uid: `BLOCK-${String(b.id).slice(0, 8)}`,
            inicio: b.start_date as string,
            fin: masUnDia(b.end_date as string),
            estado: "confirmed",
            titulo: `${etiqueta} — ${apt.name}`,
        });
    }

    eventos.sort((a, b) => a.inicio.localeCompare(b.inicio));

    const ics = buildIcalFeed({
        nombreCalendario: excluir
            ? `${apt.name} — TJM (para ${CANALES[excluir]})`
            : `${apt.name} — TJM`,
        eventos,
    });

    return new Response(req.method === "HEAD" ? null : ics, {
        status: 200,
        headers: {
            "content-type": "text/calendar; charset=utf-8",
            "content-disposition": `inline; filename="${apt.slug}${excluir ? "-" + excluir : ""}.ics"`,
            // 10 min: los canales refrescan cada 2-3 h, cachear más no aporta
            // y retrasa que vean un bloqueo nuevo.
            "cache-control": "public, max-age=600",
            "x-tjm-eventos": String(eventos.length),
            "x-tjm-excluye": excluir || "ninguno",
            "access-control-allow-origin": "*",
        },
    });
});
