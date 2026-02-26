import { supabase } from '../lib/supabase';

export const syncApartmentDates = async (apt) => {
    // 1. Intentar sincronización desde Airbnb/Booking
    let syncCount = 0;
    if (apt.airbnb_ical_url || apt.booking_ical_url) {
        try {
            const allBlockedDates = [];
            const urls = [
                { url: apt.airbnb_ical_url, source: 'airbnb' },
                { url: apt.booking_ical_url, source: 'booking' }
            ].filter(item => item.url);

            for (const { url, source } of urls) {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) continue;

                const icsText = await response.text();

                // Parser robusto: dividimos en eventos primero
                const events = icsText.split('BEGIN:VEVENT');
                events.shift(); // Quitamos la cabecera del calendario

                events.forEach(event => {
                    // Extraer DTSTART (puede tener ;VALUE=DATE o TZID o nada) - m: multiline para ^
                    const startMatch = event.match(/^DTSTART(?:;[^:]*)?:(\d{8})/m);
                    const endMatch = event.match(/^DTEND(?:;[^:]*)?:(\d{8})/m);

                    if (startMatch && endMatch) {
                        const startStr = startMatch[1];
                        const endStr = endMatch[1]; // endMatch[1] es correcto (primer grupo de ese match)

                        allBlockedDates.push({
                            apartment_id: apt.id,
                            start_date: `${startStr.slice(0, 4)}-${startStr.slice(4, 6)}-${startStr.slice(6, 8)}`,
                            end_date: `${endStr.slice(0, 4)}-${endStr.slice(4, 6)}-${endStr.slice(6, 8)}`,
                            source
                        });
                    }
                });
            }

            await supabase.from('blocked_dates').delete().eq('apartment_id', apt.id).neq('source', 'manual');
            if (allBlockedDates.length > 0) {
                await supabase.from('blocked_dates').insert(allBlockedDates);
            }
            syncCount = allBlockedDates.length;
        } catch (error) {
            console.error('Error in sync logic:', error);
        }
    }

    // 2. Generar y subir nuevo iCal exportable (para que Airbnb/Booking nos lean)
    try {
        const { data: allBlocks } = await supabase.from('blocked_dates').select('*').eq('apartment_id', apt.id);

        let ical = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Tio Jose Maria//NONSGML v1.0//ES',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            `X-WR-CALNAME:Disponibilidad - ${apt.name}`
        ];

        allBlocks?.forEach(block => {
            const start = block.start_date.replace(/-/g, '');
            const end = block.end_date.replace(/-/g, '');
            ical.push('BEGIN:VEVENT', `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`, `UID:${block.id}@tiojosemaria.es`, `SUMMARY:Ocupado (${block.source})`, 'END:VEVENT');
        });

        ical.push('END:VCALENDAR');
        const icsText = ical.join('\r\n');

        // Subir a Supabase Storage (Sobrescribir siempre)
        await supabase.storage
            .from('calendars')
            .upload(`${apt.slug}.ics`, icsText, {
                contentType: 'text/calendar',
                upsert: true
            });

    } catch (error) {
        console.error('Error uploading ical to storage:', error);
    }

    return syncCount;
};
