import { supabase } from '../lib/supabase';

export const syncApartmentDates = async (apt) => {
    if (!apt.airbnb_ical_url && !apt.booking_ical_url) return null;

    try {
        const allBlockedDates = [];
        const urls = [
            { url: apt.airbnb_ical_url, source: 'airbnb' },
            { url: apt.booking_ical_url, source: 'booking' }
        ].filter(item => item.url);

        for (const { url, source } of urls) {
            // Usamos corsproxy.io que es el más estable para Easypanel
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);

            if (!response.ok) continue;

            const icsText = await response.text();

            // Parser básico de iCal
            const regex = /BEGIN:VEVENT[\s\S]*?DTSTART;VALUE=DATE:(\d{8})[\s\S]*?DTEND;VALUE=DATE:(\d{8})[\s\S]*?END:VEVENT/g;
            let match;
            while ((match = regex.exec(icsText)) !== null) {
                const startStr = match[1];
                const endStr = match[2];

                const start_date = `${startStr.slice(0, 4)}-${startStr.slice(4, 6)}-${startStr.slice(6, 8)}`;
                const end_date = `${endStr.slice(0, 4)}-${endStr.slice(4, 6)}-${endStr.slice(6, 8)}`;

                allBlockedDates.push({
                    apartment_id: apt.id,
                    start_date,
                    end_date,
                    source
                });
            }
        }

        // 1. Limpiar bloqueos antiguos de este apartamento que vengan de sync
        await supabase
            .from('blocked_dates')
            .delete()
            .eq('apartment_id', apt.id)
            .neq('source', 'manual');

        // 2. Insertar nuevos bloqueos
        if (allBlockedDates.length > 0) {
            const { error: insertError } = await supabase
                .from('blocked_dates')
                .insert(allBlockedDates);
            if (insertError) throw insertError;
        }

        return allBlockedDates.length;
    } catch (error) {
        console.error('Error in syncService:', error);
        throw error;
    }
};
