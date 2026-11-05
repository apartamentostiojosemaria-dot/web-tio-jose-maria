// One-off (5-nov-2026): rewrite the old auto notes («Traída del aviso de MisterPlan…») with notaFamilia.
// Only notes made 100 % of known auto segments are rewritten; anything a person added is left untouched.
// Usage (from tjm-jobs, with ../.env.local): npx tsx scripts/reescribir-notas-misterplan.ts [--aplicar]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { notaFamilia } from "../src/lib/nota-familia.js";

const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const val = (k: string) => (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim().replace(/^"|"$/g, "");
const sb = createClient(val("VITE_SUPABASE_URL"), val("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const aplicar = process.argv.includes("--aplicar");

const SEG = [
    /^Traída del aviso de MisterPlan del [\d/]+ \(leído el [\d/]+\)(?:, reserva (?<ref>[\w-]+))?, canal .*?\.(?=\s|$)/,
    /^Traída del aviso de MisterPlan \(correo «[^»]*»[^)]*\)\.?/,
    /^Importe [\d.]+ €(?: por \d+ noche\(s\))?(?:, \d+ persona\(s\))?\./,
    /^Booking: (?:tarjeta virtual cargable desde el [\d-]+; )?pago a través de Booking\.com \(comisión estimada 17 %\)\./,
    /^Airbnb cobra al huésped y liquida: NO cobrar nada en persona\./,
    /^Motor web de MisterPlan: (?:[\d.]+ € pagados por transferencia \(anticipo\)\.|sin dato de pago\.) MisterPlan no da su correo; la confirmación se la mandó MisterPlan\./,
    /^Hora de llegada indicada por el huésped: (?<hora>[^.]+)\./,
    /^Observaciones: (?<obs>[\s\S]*)$/,
];

const { data, error } = await sb.from("guest_bookings")
    .select("id, booking_code, channel, external_locator, total_price, check_in, check_out, pax_count, vcc_chargeable_from, commission_amount, internal_notes")
    .like("internal_notes", "Traída del aviso de MisterPlan%");
if (error) throw error;
let hechas = 0; const dejadas: string[] = [];
for (const r of data ?? []) {
    let resto = (r.internal_notes as string).trim();
    let ref: string | undefined, hora: string | undefined, obs: string | undefined;
    for (const re of SEG) {
        const m = resto.match(re);
        if (m) { ref ??= m.groups?.ref; hora ??= m.groups?.hora; obs ??= m.groups?.obs; resto = resto.slice(m[0].length).trim(); }
    }
    if (resto) { dejadas.push(`${r.booking_code}: queda «${resto.slice(0, 80)}»`); continue; }
    const noches = Math.round((Date.parse(r.check_out) - Date.parse(r.check_in)) / 86400000);
    const nueva = notaFamilia({
        canal: r.channel, locator: /^MisterPlan /.test(r.external_locator ?? "") ? undefined : r.external_locator ?? undefined,
        misterplanRef: ref, total: r.total_price != null ? Number(r.total_price) : null, nights: noches || null, pax: r.pax_count,
        vccChargeableFrom: r.vcc_chargeable_from ?? undefined, comision: Number(r.commission_amount) || null, arrivalTime: hora, comments: obs,
    });
    if (aplicar) {
        const { error: e } = await sb.from("guest_bookings").update({ internal_notes: nueva }).eq("id", r.id);
        if (e) throw e;
    }
    hechas++;
    if (hechas <= 3) console.log(`${r.booking_code}\n  antes: ${(r.internal_notes as string).slice(0, 140)}…\n  ahora: ${nueva}`);
}
console.log(`${aplicar ? "reescritas" : "se reescribirían"}: ${hechas} · dejadas como estaban: ${dejadas.length}`);
for (const d of dejadas) console.log("  " + d);
