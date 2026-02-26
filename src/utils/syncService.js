import { supabase } from '../lib/supabase';

export const syncApartmentDates = async (apt) => {
    let syncCount = 0;
    let diagnosticMsg = '';
    console.log('--- iCal Sync Service v2.3 Activated (Verified Proxies) ---');

    // 1. Intentar sincronización desde Airbnb/Booking/Holidu
    if (apt.airbnb_ical_url || apt.booking_ical_url) {
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
                        console.log(`Trying proxy ${i + 1} for ${source}: ${proxyUrl}`);
                        const response = await fetch(proxyUrl);

                        if (!response.ok) {
                            console.warn(`Proxy ${i + 1} returned status ${response.status}`);
                            continue;
                        }

                        if (i === 2) { // AllOrigins Get returns JSON
                            const json = await response.json();
                            const raw = json.contents;
                            if (raw && raw.startsWith('data:')) {
                                // Decode base64 if AllOrigins wrapped it
                                const base64 = raw.split(',')[1];
                                icsText = atob(base64);
                            } else {
                                icsText = raw;
                            }
                        } else {
                            // Raw text proxies
                            icsText = await response.text();
                        }

                        if (icsText && icsText.includes('BEGIN:VCALENDAR')) {
                            success = true;
                            console.log(`Proxy ${i + 1} succeeded for ${source}. Content starts with: ${icsText.substring(0, 50)}...`);
                            break;
                        } else {
                            console.warn(`Proxy ${i + 1} did not return a valid iCal string. Recieved: ${icsText?.substring(0, 50)}`);
                        }
                    } catch (e) {
                        console.warn(`Proxy ${i + 1} failed for ${source}:`, e);
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
                    // Extraer DTSTART y DTEND (YYYYMMDD)
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
            console.error('Error in sync logic:', error);
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
            console.error('Error uploading to storage:', uploadError);
            return { success: false, message: `\n- Error Exportación: ${uploadError.message}` };
        }
        console.log(`Calendario ${apt.slug}.ics actualizado automáticamente.`);
        return { success: true, message: `\n- Archivo de exportación actualizado.` };
    } catch (error) {
        console.error('Critical export error:', error);
        return { success: false, message: `\n- Error Exportación Crítico: ${error.message}` };
    }
};
