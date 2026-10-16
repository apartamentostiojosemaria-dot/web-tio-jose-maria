import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Wrench, Check } from 'lucide-react';
import { Boton, fechaCorta } from './ui';

// ============================================================
// TareasCasa — las tareas de la casa que le tocan a la familia
// ============================================================
// Caldera, extintores, electrodomésticos, limpieza de fin de temporada…
// Hasta el 16-oct-2026 solo se veían en el panel de Jesús y vencían sin que
// nadie lo supiera. Aquí salen las vencidas y las de los próximos 14 días;
// «Hecha» la cierra y deja programada la siguiente (migración 0061).
// Si no hay ninguna, no se enseña nada.
// ============================================================

const TareasCasa = () => {
    const [tareas, setTareas] = useState([]);
    const [marcando, setMarcando] = useState(null);
    const [error, setError] = useState('');

    const cargar = useCallback(async () => {
        const { data, error: fallo } = await supabase.rpc('tjm_tareas_casa', { p_dias: 14 });
        if (fallo) { setError('No he podido cargar las tareas de la casa.'); return; }
        setError('');
        setTareas(data || []);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const hecha = async (t) => {
        setMarcando(t.id);
        const { error: fallo } = await supabase.rpc('tjm_completar_tarea', { p_id: t.id, p_notas: null });
        setMarcando(null);
        if (fallo) { setError('No se ha podido marcar. Inténtalo otra vez.'); return; }
        cargar();
    };

    if (!error && tareas.length === 0) return null;

    return (
        <section aria-labelledby="casa-t" className="space-y-3">
            <h3 id="casa-t" className="text-base font-bold text-text-primary">Tareas de la casa</h3>
            {error && <p className="text-base text-red-700">{error}</p>}
            <ul className="bg-white rounded-3xl border border-gray-200 shadow-sm divide-y divide-gray-100">
                {tareas.map((t) => (
                    <li key={t.id} className="p-4 flex items-center gap-3">
                        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${t.vencida ? 'bg-red-50 text-red-700' : 'bg-rural-50 text-rural-700'}`}>
                            <Wrench size={20} aria-hidden="true" />
                        </span>
                        <span className="flex-1 min-w-0">
                            <span className="block font-bold text-base text-text-primary">{t.title}</span>
                            <span className={`block text-sm ${t.vencida ? 'text-red-700 font-bold' : 'text-gray-600'}`}>
                                {t.vencida ? 'Tocaba el ' : 'Toca el '}{fechaCorta(t.scheduled_date)}
                            </span>
                        </span>
                        <Boton variante="secundario" icono={Check} cargando={marcando === t.id}
                            onClick={() => hecha(t)} aria-label={`Marcar como hecha: ${t.title}`}>
                            Hecha
                        </Boton>
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default TareasCasa;
