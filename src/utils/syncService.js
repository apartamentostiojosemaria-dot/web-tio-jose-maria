import { supabase } from '../lib/supabase';

export const syncApartmentDates = async (apt) => {
    let syncCount = 0;
    let diagnosticMsg = '';

    // 1. Intentar sincronización desde Airbnb/Booking/Holidu
    if (apt.airbnb_ical_url || apt.booking_ical_url) {
        try {
            const allBlockedDates = [];
            const urls = [
                { url: apt.airbnb_ical_url, source: 'airbnb' },
                { url: apt.booking_ical_url, source: 'booking' }
            ].filter(item => item.url);

            for (const { url, source } of urls) {
                // Probamos con un proxy más robusto o directo si es posible
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl);

                if (!response.ok) {
                    diagnosticMsg += `\n- Fallo al conectar con ${source} (Error ${response.status})`;
                    continue;
                }

                const json = await response.json();
                const icsText = json.contents;

                if (!icsText || !icsText.includes('BEGIN:VCALENDAR')) {
                    diagnosticMsg += `\n- El enlace de ${source} no devolvió un calendario válido.`;
                    continue;
                }

                // Parser universal: extraemos todos los VEVENTs
                const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/gi;
                let eventMatch;
                let sourceCount = 0;

                while ((eventMatch = eventRegex.exec(icsText)) !== null) {
                    const eventContent = eventMatch[1];

                    // Extraer DTSTART y DTEND (soportamos YYYYMMDD y YYYYMMDDTHHMMSS)
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
            ical.push(
                'BEGIN:VEVENT',
                `DTSTAMP:${now}`,
                `DTSTART;VALUE=DATE:${start}`,
                `DTEND;VALUE=DATE:${end}`,
                `UID:${block.id || Math.random().toString(36).substr(2, 9)}@tiojosemaria.es`,
                `SUMMARY:Reserva (${block.source})`,
                'END:VEVENT'
            );
        });

        ical.push('END:VCALENDAR');
        const icsText = ical.join('\r\n');

        const { error: uploadError } = await supabase.storage
            .from('calendars')
            .upload(`${apt.slug}.ics`, icsText, {
                contentType: 'text/calendar',
                upsert: true
            });

        if (uploadError) {
            diagnosticMsg += `\n- Error Exportación: ${uploadError.message}`;
        } else {
            diagnosticMsg += `\n- Archivo de exportación generado correctamente.`;
        }
    } catch (error) {
        console.error('Critical sync error:', error);
        diagnosticMsg += `\n- Error Exportación Crítico: ${error.message}`;
    }

    return { count: syncCount, message: diagnosticMsg };
};
