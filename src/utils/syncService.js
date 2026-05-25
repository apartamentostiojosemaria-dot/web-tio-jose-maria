import { supabase } from '../lib/supabase';
import { logError } from './logger';

// Whitelist defensiva: solo permitimos URLs iCal de Airbnb y Booking.
// Sin esto, un admin malicioso (o admin con sesion comprometida) podria
// meter cualquier URL — incluido endpoints internos via los proxies
// publicos — y exfiltrar info o escanear redes desde nuestra IP origen.
const ALLOWED_ICAL_HOSTS = [
    'airbnb.com', 'airbnb.es', 'airbnb.it', 'airbnb.fr', 'airbnb.de',
    'ical.booking.com', 'admin.booking.com',
];

export const isValidIcalUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
        return ALLOWED_ICAL_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
    } catch {
        return false;
    }
};

export const syncApartmentDates = async (apt) => {
    let syncCount = 0;
    let diagnosticMsg = '';

    // 1. Intentar sincronización desde Airbnb/Booking/Holidu
    if (apt.airbnb_ical_url || apt.booking_ical_url) {
        // Filtrar URLs no permitidas (defense in depth contra SSRF)
        if (apt.airbnb_ical_url && !isValidIcalUrl(apt.airbnb_ical_url)) {
            diagnosticMsg += `\n- airbnb: URL no permitida (solo hosts oficiales Airbnb).`;
            apt = { ...apt, airbnb_ical_url: null };
        }
        if (apt.booking_ical_url && !isValidIcalUrl(apt.booking_ical_url)) {
            diagnosticMsg += `\n- booking: URL no permitida (solo ical.booking.com).`;
            apt = { ...apt, booking_ical_url: null };
        }
        if (!apt.airbnb_ical_url && !apt.booking_ical_url) {
            return { count: 0, message: diagnosticMsg };
        }
        try {
            const allBlockedDates = [];
            const urls = [
                { url: apt.airbnb_ical_url, source: 'airbnb' },
                { url: apt.booking_ical_url, source: 'booking' }
            ].filter(item => item.url);

            const proxyFactories = [
                // 1. CodeTabs (Raw text - Very reliable)
                (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
                // 2. AllOrigins Raw (Raw text)
                (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
                // 3. AllOrigins Get (JSON with potential base64)
                (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`
            ];

            for (const { url, source } of urls) {
                const cacheBusterUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
                let icsText = null;
                let success = false;

                for (let i = 0; i < proxyFactories.length; i++) {
                    try {
                        const proxyUrl = proxyFactories[i](cacheBusterUrl);
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000);

                        const response = await fetch(proxyUrl, { signal: controller.signal });
                        clearTimeout(timeoutId);

                        if (!response.ok) continue;

                        if (i === 2) { // AllOrigins Get returns JSON
                            const json = await response.json();
                            const raw = json.contents;
                            if (raw && raw.startsWith('data:')) {
                                const base64 = raw.split(',')[1];
                                icsText = atob(base64);
                            } else {
                                icsText = raw;
                            }
                        } else {
                            icsText = await response.text();
                        }

                        if (icsText && icsText.includes('BEGIN:VCALENDAR')) {
                            success = true;
                            break;
                        }
                    } catch (e) {
                        logError(`syncService.proxy${i + 1}.${source}`, e);
                    }
                }

                if (!success) {
                    diagnosticMsg += `\n- ${source}: Fallaron todos los servidores de conexión (AllOrigins/CodeTabs).`;
                    continue;
                }

                // Parser universal: extraemos todos los VEVENTs
                const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/gi;
                let eventMatch;
                let sourceCount = 0;

                while ((eventMatch = eventRegex.exec(icsText)) !== null) {
                    const eventContent = eventMatch[1];
                    const startMatch = eventContent.match(/DTSTART(?:;[^:]*)?:(\d{8})/i);
                    const endMatch = eventContent.match(/DTEND(?:;[^:]*)?:(\d{8})/i);

                    if (startMatch && endMatch) {
                        const startStr = startMatch[1];
                        const endStr = endMatch[1];
                        allBlockedDates.push({
                            apartment_id: apt.id,
                            start_date: `${startStr.slice(0, 4)}-${startStr.slice(4, 6)}-${startStr.slice(6, 8)}`,
                            end_date: `${endStr.slice(0, 4)}-${endStr.slice(4, 6)}-${endStr.slice(6, 8)}`,
                            source
                        });
                        sourceCount++;
                    }
                }
                diagnosticMsg += `\n- ${source}: ${sourceCount} reservas encontradas.`;
            }

            // Limpiar y guardar
            await supabase.from('blocked_dates').delete().eq('apartment_id', apt.id).neq('source', 'manual');
            if (allBlockedDates.length > 0) {
                const { error: insErr } = await supabase.from('blocked_dates').insert(allBlockedDates);
                if (insErr) throw new Error(`Error DB: ${insErr.message}`);
            }
            syncCount = allBlockedDates.length;
        } catch (error) {
            logError('syncApartmentDates', error);
            diagnosticMsg += `\n- Error crítico: ${error.message}`;
        }
    }

    // 2. Generar y subir nuevo iCal exportable
    const exportResult = await regenerateICalExport(apt);
    diagnosticMsg += exportResult.message;

    return { count: syncCount, message: diagnosticMsg };
};

// Función independiente: regenera SOLO el archivo .ics de exportación
// Se puede llamar automáticamente tras añadir/borrar reservas manuales
export const regenerateICalExport = async (apt) => {
    try {
        const { data: allBlocks } = await supabase.from('blocked_dates').select('*').eq('apartment_id', apt.id);
        const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        let ical = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Tio Jose Maria//NONSGML v1.0//ES',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            `X-WR-CALNAME:Disponibilidad - ${apt.name}`,
            'X-WR-TIMEZONE:Europe/Madrid'
        ];

        allBlocks?.forEach(block => {
            const start = block.start_date.replace(/-/g, '');
            const end = block.end_date.replace(/-/g, '');
            const safeUid = (block.id || Math.random().toString(36).substr(2, 9)).replace(/[^a-zA-Z0-9-]/g, '');
            ical.push(
                'BEGIN:VEVENT',
                `DTSTAMP:${now}`,
                `DTSTART;VALUE=DATE:${start}`,
                `DTEND;VALUE=DATE:${end}`,
                `UID:${safeUid}@tiojosemaria.com`,
                `SUMMARY:Reserva (${block.source})`,
                'END:VEVENT'
            );
        });

        ical.push('END:VCALENDAR');
        const icsText = ical.join('\r\n') + '\r\n';

        const { error: uploadError } = await supabase.storage
            .from('calendars')
            .upload(`${apt.slug}.ics`, icsText, {
                contentType: 'text/calendar; charset=utf-8',
                cacheControl: '10',
                upsert: true
            });

        if (uploadError) {
            logError('regenerateICalExport.upload', uploadError);
            return { success: false, message: `\n- Error Exportación: ${uploadError.message}` };
        }
        return { success: true, message: `\n- Archivo de exportación actualizado.` };
    } catch (error) {
        logError('regenerateICalExport', error);
        return { success: false, message: `\n- Error Exportación Crítico: ${error.message}` };
    }
};
