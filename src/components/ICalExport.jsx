import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ICalExport = () => {
    const { slug } = useParams();
    const [icsContent, setIcsContent] = useState('Cargando calendario...');

    useEffect(() => {
        const generateICal = async () => {
            try {
                // 1. Obtener apartamento
                const { data: apt } = await supabase
                    .from('apartments')
                    .select('id, name')
                    .eq('slug', slug)
                    .single();

                if (!apt) {
                    setIcsContent('Apartamento no encontrado');
                    return;
                }

                // 2. Obtener bloqueos (Manuales y externos)
                const { data: blocks } = await supabase
                    .from('blocked_dates')
                    .select('*')
                    .eq('apartment_id', apt.id);

                // 3. Formatear en estándar iCal
                let ical = [
                    'BEGIN:VCALENDAR',
                    'VERSION:2.0',
                    'PRODID:-//Tio Jose Maria//NONSGML v1.0//ES',
                    'CALSCALE:GREGORIAN',
                    'METHOD:PUBLISH',
                    `X-WR-CALNAME:Disponibilidad - ${apt.name}`
                ];

                blocks.forEach(block => {
                    const start = block.start_date.replace(/-/g, '');
                    const end = block.end_date.replace(/-/g, '');
                    const uid = `${block.id}@tiojosemaria.es`;

                    ical.push('BEGIN:VEVENT');
                    ical.push(`DTSTART;VALUE=DATE:${start}`);
                    ical.push(`DTEND;VALUE=DATE:${end}`);
                    ical.push(`DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`);
                    ical.push(`UID:${uid}`);
                    ical.push(`SUMMARY:Ocupado (${block.source})`);
                    ical.push('END:VEVENT');
                });

                ical.push('END:VCALENDAR');
                const finalStr = ical.join('\r\n');

                // En un SPA de React, esto es un truco para servir texto plano
                document.title = `calendar-${slug}.ics`;
                document.body.innerHTML = `<pre style="word-wrap: break-word; white-space: pre-wrap;">${finalStr}</pre>`;
                setIcsContent(finalStr);

            } catch (error) {
                setIcsContent('Error al generar iCal');
            }
        };

        generateICal();
    }, [slug]);

    return null; // El contenido se inyecta directamente en el body para ser "leíble" por iCal
};

export default ICalExport;
