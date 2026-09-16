// Prueba EN SECO del importador contra el buzón real, desde fuera de Trigger.dev.
//   npx tsx scripts/misterplan-correo-prueba.ts [--desde 2026-09-01] [--limite 50] [--real]
// Carga CORREO_TJM_* del .env.local de la raíz del OS y SUPABASE_* del .env.local
// del repo (sin imprimir ningún valor). Sin --real no escribe nada.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { importarCorreosMisterPlan } from "../src/lib/misterplan-importador.js";

function cargar(ruta: string) {
    if (!existsSync(ruta)) return;
    for (const l of readFileSync(ruta, "utf8").split(/\r?\n/)) {
        const m = l.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
}
cargar(resolve(process.cwd(), "..", ".env.local"));                       // SUPABASE_*
cargar(resolve(process.cwd(), "..", "..", "..", "..", "..", ".env.local")); // CORREO_TJM_* (raíz del OS)
if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const r = await importarCorreosMisterPlan({
    dryRun: !process.argv.includes("--real"),
    desde: arg("--desde"),
    limite: arg("--limite") ? Number(arg("--limite")) : undefined,
    log: (m) => console.error(m),
});
console.log(JSON.stringify({ leidos: r.leidos, procesados: r.procesados, acciones: r.acciones, atencion: r.atencion, detalle: r.detalle }, null, 2));
