import React, { useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { renderMarkdown } from './ProtocolsManager';

// Botón flotante "?" en cada manager del admin.
// =============================================
// Carga el protocolo de category=help con related_tab=tabId
// y lo muestra en un panel lateral. Si no existe, muestra mensaje.

const HelpButton = ({ tabId, onNavigate }) => {
    const [open, setOpen] = useState(false);
    const [protocol, setProtocol] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        if (protocol || loading) return;
        setLoading(true);
        const { data } = await supabase
            .from('protocols')
            .select('title, summary, content, slug')
            .eq('category', 'help')
            .eq('related_tab', tabId)
            .limit(1)
            .maybeSingle();
        setProtocol(data);
        setLoading(false);
    };

    useEffect(() => {
        if (open) load();
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <button onClick={() => setOpen(true)}
                title="Ayuda sobre esta sección"
                aria-label="Ayuda sobre esta sección"
                className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center text-rural-700 hover:bg-rural-50 hover:text-primary transition-colors">
                <HelpCircle size={22} aria-hidden="true" />
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-stretch justify-end" onClick={() => setOpen(false)}>
                    <aside className="bg-white w-full sm:max-w-xl h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <header className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-rural-700">Ayuda</p>
                                <h2 className="font-serif text-lg font-bold text-text-primary">
                                    {protocol?.title || (loading ? 'Cargando...' : '¿Qué es esta sección?')}
                                </h2>
                            </div>
                            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700" aria-label="Cerrar">
                                <X size={20} />
                            </button>
                        </header>

                        <div className="px-6 py-5">
                            {loading && <p className="text-gray-500 font-serif italic">Cargando ayuda...</p>}
                            {!loading && !protocol && (
                                <div className="text-center py-12">
                                    <p className="text-gray-600 mb-4">Todavía no hay un protocolo escrito para esta sección.</p>
                                    {onNavigate && (
                                        <button onClick={() => { onNavigate('protocols'); setOpen(false); }}
                                            className="inline-flex items-center gap-2 text-sm font-bold text-white bg-primary px-4 py-2 rounded-xl shadow">
                                            Ir al Manual completo
                                        </button>
                                    )}
                                </div>
                            )}
                            {!loading && protocol && renderMarkdown(protocol.content)}
                        </div>

                        {protocol && onNavigate && (
                            <footer className="border-t border-gray-100 px-6 py-3 bg-gray-50">
                                <button onClick={() => { onNavigate('protocols'); setOpen(false); }}
                                    className="text-sm font-bold text-rural-700 hover:text-primary">
                                    Ver Manual completo →
                                </button>
                            </footer>
                        )}
                    </aside>
                </div>
            )}
        </>
    );
};

export default HelpButton;
