// Edge function: issue-invoice
// ============================
// Todo lo de facturar una reserva, en una sola puerta:
//
//   POST { action: "issue",          bookingCode | bookingId, receptor? }
//   POST { action: "send",           invoiceId | bookingCode | bookingId, to?, force? }
//   POST { action: "issue_and_send", bookingCode | bookingId, receptor?, to? }
//   POST { action: "rectify",        invoiceId, motivo, importe?, send? }
//   POST { action: "pdf_url",        invoiceId }
//   POST { action: "status",         bookingCode | bookingId }
//
// Sin `action` y con `bookingCode` se comporta como "issue" (compatibilidad
// con el contrato viejo que usaba `stripe-webhook`).
//
// Configuración fiscal (serie, IVA, emisor): `config.ts`, único sitio.
// Verifactu: NO se activa (ver config.ts). Cada factura queda con la huella ya
// calculada y `verifactu_status = 'pending'`, lista para el día que toque.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDF_BUCKET, SIGNED_URL_TTL, formatInvoiceNumber } from "./config.ts";
import {
    getCobroInfo, issueInvoice, issueRectificative,
    type BookingRow, type InvoiceRow, type CobroInfo,
} from "./invoice-core.ts";
import { renderInvoicePdf } from "./pdf.ts";
import { sendInvoiceEmail } from "./email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const BOOKING_SELECT = `id, booking_code, guest_name, guest_email, guest_phone, guest_address,
    check_in, check_out, nights, pax_count, total_price, status, source,
    payment_intent_id, payment_amount_paid, apartment_id, apartments(name)`;

// ---------------------------------------------------------------------------
// Autorización: o eres la propia infraestructura, o eres del equipo
// ---------------------------------------------------------------------------
/** Lee el claim `role` de un JWT sin verificarlo (la pasarela ya lo verificó). */
function jwtRole(token: string): string | null {
    try {
        const payload = token.split(".")[1];
        if (!payload) return null;
        const txt = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        return (JSON.parse(txt) as { role?: string }).role ?? null;
    } catch { return null; }
}

async function authorize(req: Request): Promise<{ ok: true; who: string } | { ok: false; status: number; error: string }> {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return { ok: false, status: 401, error: "missing_token" };
    // Llamada interna (stripe-webhook, crons): la clave de servicio, en
    // cualquiera de sus formatos (JWT legacy con role=service_role, o sb_secret_*).
    if (token === SERVICE_KEY || jwtRole(token) === "service_role") return { ok: true, who: "service" };

    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return { ok: false, status: 401, error: "invalid_token" };

    const { data: profile } = await sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    if (!role || !["admin", "staff", "contabilidad"].includes(role)) {
        return { ok: false, status: 403, error: "forbidden" };
    }
    return { ok: true, who: `${role}:${data.user.id}` };
}

// ---------------------------------------------------------------------------
// Carga de reserva / factura
// ---------------------------------------------------------------------------
async function loadBooking(ref: { bookingId?: number; bookingCode?: string }): Promise<BookingRow | null> {
    let q = sb.from("guest_bookings").select(BOOKING_SELECT);
    if (ref.bookingId) q = q.eq("id", ref.bookingId);
    else if (ref.bookingCode) q = q.eq("booking_code", String(ref.bookingCode).trim().toUpperCase());
    else return null;
    const { data } = await q.limit(1).maybeSingle();
    return (data as BookingRow | null) ?? null;
}

async function loadInvoice(invoiceId: string): Promise<InvoiceRow | null> {
    const { data } = await sb.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
    return (data as InvoiceRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// PDF + Storage
// ---------------------------------------------------------------------------
function pdfPath(inv: InvoiceRow): string {
    const year = inv.fecha_emision.slice(0, 4);
    return `${year}/${formatInvoiceNumber(inv.serie, inv.numero)}.pdf`;
}

async function ensureBucket() {
    const { data } = await sb.storage.getBucket(PDF_BUCKET);
    if (data) return;
    await sb.storage.createBucket(PDF_BUCKET, { public: false, fileSizeLimit: 5 * 1024 * 1024 });
}

/** Genera el PDF, lo sube a Storage y deja `pdf_url` en la fila. */
async function buildAndStorePdf(
    inv: InvoiceRow, cobro: CobroInfo | null, bookingCode?: string | null, aptName?: string | null,
): Promise<{ invoice: InvoiceRow; pdf: Uint8Array | null; error?: string }> {
    try {
        const pdf = await renderInvoicePdf({ invoice: inv, cobro, bookingCode, aptName });
        await ensureBucket();
        const path = pdfPath(inv);
        const up = await sb.storage.from(PDF_BUCKET).upload(path, pdf, {
            contentType: "application/pdf",
            upsert: true,
        });
        if (up.error) throw up.error;

        const url = `${SUPABASE_URL}/storage/v1/object/${PDF_BUCKET}/${path}`;
        const { data } = await sb.from("invoices").update({ pdf_url: url }).eq("id", inv.id).select("*").single();
        return { invoice: (data as InvoiceRow) ?? { ...inv, pdf_url: url }, pdf };
    } catch (e) {
        // Una factura sin PDF sigue siendo una factura: no se tumba la emisión.
        console.error("[issue-invoice] pdf/storage:", e);
        return { invoice: inv, pdf: null, error: String((e as Error)?.message || e) };
    }
}

async function signedPdfUrl(inv: InvoiceRow): Promise<string | null> {
    if (!inv.pdf_url) return null;
    const { data } = await sb.storage.from(PDF_BUCKET).createSignedUrl(pdfPath(inv), SIGNED_URL_TTL);
    return data?.signedUrl ?? null;
}

/** Recupera el PDF de Storage (para adjuntarlo al email sin regenerarlo). */
async function fetchPdf(inv: InvoiceRow): Promise<Uint8Array | null> {
    try {
        const { data, error } = await sb.storage.from(PDF_BUCKET).download(pdfPath(inv));
        if (error || !data) return null;
        return new Uint8Array(await data.arrayBuffer());
    } catch { return null; }
}

// ---------------------------------------------------------------------------
// Respuesta normalizada: lo que consume la pantalla
// ---------------------------------------------------------------------------
async function present(inv: InvoiceRow, cobro: CobroInfo | null, bookingCode?: string | null) {
    return {
        id: inv.id,
        numero: formatInvoiceNumber(inv.serie, inv.numero),
        serie: inv.serie,
        numeroSecuencial: inv.numero,
        fecha: inv.fecha_emision,
        tipo: inv.tipo,
        cliente: inv.receptor_nombre,
        nif: inv.receptor_nif,
        email: inv.receptor_email,
        concepto: inv.concepto,
        base: Number(inv.base_imponible),
        tipoIva: Number(inv.tipo_iva),
        cuotaIva: Number(inv.cuota_iva),
        total: Number(inv.total),
        estadoCobro: cobro?.estado ?? null,
        cobrado: cobro?.cobrado ?? null,
        pendiente: cobro?.pendiente ?? null,
        formaPago: cobro?.formaPago ?? null,
        bookingCode: bookingCode ?? null,
        pdfUrl: await signedPdfUrl(inv),
        emailSentAt: inv.email_sent_at,
        rectificaInvoiceId: inv.rectifica_invoice_id,
        motivoRectificacion: inv.motivo_rectificacion,
        // Hueco Verifactu: informativo, hoy siempre 'pending'
        verifactu: { estado: inv.verifactu_status, huella: inv.verifactu_hash },
    };
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    const auth = await authorize(req);
    if (!auth.ok) return json(auth.status, { error: auth.error });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }

    const action = String(body.action || (body.bookingCode || body.bookingId ? "issue" : "")).trim();
    const ref = {
        bookingId: body.bookingId ? Number(body.bookingId) : undefined,
        bookingCode: body.bookingCode ? String(body.bookingCode) : undefined,
    };

    try {
        switch (action) {
            // -------------------------------------------------- HACER FACTURA
            case "issue":
            case "issue_and_send": {
                const booking = await loadBooking(ref);
                if (!booking) return json(404, { error: "booking_not_found" });
                if (!["confirmed", "completed", "pending"].includes(booking.status)) {
                    return json(409, { error: "booking_not_invoiceable", status: booking.status });
                }

                const cobro = await getCobroInfo(sb, booking);
                const { invoice, created } = await issueInvoice(sb, booking, (body.receptor || {}) as Record<string, string>);

                // PDF: se genera al emitir, y se regenera si aún no lo tenía
                let inv = invoice;
                let pdfError: string | undefined;
                if (created || !invoice.pdf_url || body.regeneratePdf) {
                    const r = await buildAndStorePdf(inv, cobro, booking.booking_code, booking.apartments?.name);
                    inv = r.invoice; pdfError = r.error;
                }

                let email: { sent: boolean; skipped?: string; error?: string } = { sent: false, skipped: "no_solicitado" };
                if (action === "issue_and_send") {
                    email = await doSend(inv, cobro, booking, (body.to as string) || null, Boolean(body.force));
                    if (email.sent) inv = (await loadInvoice(inv.id)) ?? inv;
                }

                return json(200, {
                    ok: true,
                    created,
                    invoice: await present(inv, cobro, booking.booking_code),
                    email,
                    ...(pdfError ? { pdfError } : {}),
                });
            }

            // ---------------------------------------------------- MANDARLA
            case "send": {
                let inv: InvoiceRow | null = null;
                let booking: BookingRow | null = null;

                if (body.invoiceId) {
                    inv = await loadInvoice(String(body.invoiceId));
                    if (!inv) return json(404, { error: "invoice_not_found" });
                    if (inv.booking_id) booking = await loadBooking({ bookingId: inv.booking_id });
                } else {
                    booking = await loadBooking(ref);
                    if (!booking) return json(404, { error: "booking_not_found" });
                    const { data } = await sb.from("invoices").select("*")
                        .eq("booking_id", booking.id).neq("tipo", "rectificativa").limit(1).maybeSingle();
                    inv = data as InvoiceRow | null;
                    if (!inv) return json(404, { error: "invoice_not_found_for_booking" });
                }

                const cobro = booking ? await getCobroInfo(sb, booking) : null;
                const email = await doSend(inv, cobro, booking, (body.to as string) || null, Boolean(body.force));
                const fresh = (await loadInvoice(inv.id)) ?? inv;
                return json(email.error ? 502 : 200, {
                    ok: !email.error,
                    email,
                    invoice: await present(fresh, cobro, booking?.booking_code),
                });
            }

            // ------------------------------------------------- RECTIFICATIVA
            case "rectify": {
                if (!body.invoiceId) return json(400, { error: "invoiceId_requerido" });
                const motivo = String(body.motivo || "").trim();
                if (motivo.length < 3) return json(400, { error: "motivo_requerido" });

                const original = await loadInvoice(String(body.invoiceId));
                if (!original) return json(404, { error: "invoice_not_found" });
                if (original.tipo === "rectificativa") return json(409, { error: "ya_es_rectificativa" });

                const importe = body.importe != null ? Number(body.importe) : undefined;
                const rect = await issueRectificative(sb, original, motivo, importe);

                const booking = original.booking_id ? await loadBooking({ bookingId: original.booking_id }) : null;
                const cobro = booking ? await getCobroInfo(sb, booking) : null;
                const r = await buildAndStorePdf(rect, null, booking?.booking_code, booking?.apartments?.name);

                let email: { sent: boolean; skipped?: string; error?: string } = { sent: false, skipped: "no_solicitado" };
                if (body.send) email = await doSend(r.invoice, null, booking, (body.to as string) || null, true);

                const fresh = (await loadInvoice(rect.id)) ?? r.invoice;
                return json(200, {
                    ok: true,
                    invoice: await present(fresh, null, booking?.booking_code),
                    rectifica: await present(original, cobro, booking?.booking_code),
                    email,
                });
            }

            // ------------------------------------------------------ PDF URL
            case "pdf_url": {
                if (!body.invoiceId) return json(400, { error: "invoiceId_requerido" });
                const inv = await loadInvoice(String(body.invoiceId));
                if (!inv) return json(404, { error: "invoice_not_found" });

                let target = inv;
                if (!inv.pdf_url) {
                    const booking = inv.booking_id ? await loadBooking({ bookingId: inv.booking_id }) : null;
                    const cobro = booking ? await getCobroInfo(sb, booking) : null;
                    const r = await buildAndStorePdf(inv, cobro, booking?.booking_code, booking?.apartments?.name);
                    if (r.error) return json(502, { error: "pdf_error", detalle: r.error });
                    target = r.invoice;
                }
                const url = await signedPdfUrl(target);
                if (!url) return json(502, { error: "no_se_pudo_firmar_url" });
                return json(200, { ok: true, url, expiraEnSegundos: SIGNED_URL_TTL });
            }

            // ------------------------------------- ¿ESTA RESERVA TIENE FACTURA?
            case "status": {
                const booking = await loadBooking(ref);
                if (!booking) return json(404, { error: "booking_not_found" });
                const cobro = await getCobroInfo(sb, booking);
                const { data } = await sb.from("invoices").select("*")
                    .eq("booking_id", booking.id).order("created_at", { ascending: true });
                const rows = (data as InvoiceRow[]) || [];
                const principal = rows.find((r) => r.tipo !== "rectificativa") || null;
                return json(200, {
                    ok: true,
                    bookingCode: booking.booking_code,
                    tieneFactura: Boolean(principal),
                    cobro,
                    factura: principal ? await present(principal, cobro, booking.booking_code) : null,
                    rectificativas: await Promise.all(
                        rows.filter((r) => r.tipo === "rectificativa").map((r) => present(r, null, booking.booking_code)),
                    ),
                });
            }

            default:
                return json(400, { error: "accion_desconocida", action });
        }
    } catch (e) {
        console.error("[issue-invoice]", action, e);
        return json(500, { error: "error_interno", detalle: String((e as Error)?.message || e) });
    }
});

// ---------------------------------------------------------------------------
async function doSend(
    inv: InvoiceRow, cobro: CobroInfo | null, booking: BookingRow | null,
    to: string | null, force: boolean,
): Promise<{ sent: boolean; skipped?: string; error?: string; resendId?: string | null }> {
    const destino = (to || inv.receptor_email || booking?.guest_email || "").trim();
    if (!destino) return { sent: false, skipped: "sin_email" };
    if (inv.email_sent_at && !force) return { sent: false, skipped: "ya_enviada" };
    try {
        let pdf = await fetchPdf(inv);
        if (!pdf) {
            const r = await buildAndStorePdf(inv, cobro, booking?.booking_code, booking?.apartments?.name);
            pdf = r.pdf;
        }
        const resendId = await sendInvoiceEmail({
            to: destino, invoice: inv, cobro, pdf, aptName: booking?.apartments?.name,
        });
        await sb.from("invoices").update({ email_sent_at: new Date().toISOString() }).eq("id", inv.id);
        return { sent: true, resendId };
    } catch (e) {
        console.error("[issue-invoice] email:", e);
        return { sent: false, error: String((e as Error)?.message || e) };
    }
}
