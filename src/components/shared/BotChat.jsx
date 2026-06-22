import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';

const STORAGE_SESSION_KEY = 'tjm_bot_session_id';
const STORAGE_HISTORY_KEY = 'tjm_bot_history';
const MAX_HISTORY = 10;                  // turnos enviados como context al servidor

// AI Act art. 50: el huésped debe saber con qué interactúa ANTES de empezar.
const DISCLAIMER = {
    role: 'assistant',
    text: 'Hola, soy el asistente virtual de Apartamentos Tío José María. Soy una IA basada en Claude (Anthropic). Estoy aquí para responder dudas sobre los apartamentos, Hinojares y la Sierra de Cazorla. No pido datos personales por chat y para reservar siempre debes pasar por la página de reservas. ¿En qué te ayudo?',
    isDisclaimer: true,
};

const generateSessionId = () => {
    // ID anónimo, no PII, válido como string en logs.
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const loadSession = () => {
    try {
        const sid = localStorage.getItem(STORAGE_SESSION_KEY);
        if (sid) return sid;
        const fresh = generateSessionId();
        localStorage.setItem(STORAGE_SESSION_KEY, fresh);
        return fresh;
    } catch {
        return generateSessionId();
    }
};

const loadHistory = () => {
    try {
        const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY * 2) : [];
    } catch { return []; }
};

const saveHistory = (msgs) => {
    try {
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY * 2)));
    } catch { /* localStorage lleno o deshabilitado: ignoramos */ }
};

const SUGGESTED = [
    '¿Cómo llego a Hinojares?',
    '¿Qué hacer en la Sierra de Cazorla?',
    '¿Cuánto cuestan los apartamentos?',
    '¿Cuál es la mejor época para venir?',
];

const BotChat = () => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [sessionId] = useState(() => (typeof window !== 'undefined' ? loadSession() : ''));
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    // Cargar historial al abrir por primera vez
    useEffect(() => {
        if (!open) return;
        if (messages.length === 0) {
            const stored = loadHistory();
            setMessages(stored.length > 0 ? stored : [DISCLAIMER]);
        }
        const t = setTimeout(() => inputRef.current?.focus(), 250);
        return () => clearTimeout(t);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Autoscroll al final cuando llegan mensajes
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, sending]);

    // Persistir historial (excluyendo el disclaimer que se inyecta cada vez)
    useEffect(() => {
        const persistable = messages.filter(m => !m.isDisclaimer);
        if (persistable.length > 0) saveHistory(persistable);
    }, [messages]);

    // Cierre con Escape
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    const send = useCallback(async (text) => {
        const message = (text ?? input).trim();
        if (!message || sending) return;
        setInput('');
        const next = [...messages, { role: 'user', text: message }];
        setMessages(next);
        setSending(true);

        // history enviado al servidor: SOLO turnos previos del huésped y del bot, sin disclaimer
        const history = next
            .filter(m => !m.isDisclaimer)
            .slice(0, -1)  // sin el último (que es el que enviamos como "message")
            .slice(-MAX_HISTORY)
            .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }));

        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const res = await fetch(`${supabaseUrl}/functions/v1/bot-chat`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'apikey': anonKey,
                    'authorization': `Bearer ${anonKey}`,
                },
                body: JSON.stringify({ sessionId, message, history, language: 'es' }),
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
            }
            const data = await res.json();
            setMessages([...next, { role: 'assistant', text: data.reply, sources: data.sources }]);
        } catch (e) {
            setMessages([...next, {
                role: 'assistant',
                text: 'Vaya, algo no ha ido bien por aquí. Si la cosa es urgente, escríbenos por WhatsApp al +34 676 34 46 75 y te respondemos enseguida.',
                isError: true,
            }]);
            // eslint-disable-next-line no-console
            console.warn('[bot-chat] error:', e?.message || e);
        } finally {
            setSending(false);
        }
    }, [input, messages, sending, sessionId]);

    return (
        <>
            {/* Botón flotante (esquina inferior derecha; encima del WhatsAppFab si existe se solapa, ajusta en stylesheet) */}
            <motion.button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Abrir asistente virtual"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: open ? 0 : 1, opacity: open ? 0 : 1 }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', damping: 18 }}
                className="fixed bottom-6 left-6 z-[55] w-14 h-14 rounded-full bg-primary text-white shadow-xl flex items-center justify-center hover:shadow-2xl"
            >
                <MessageCircle size={24} aria-hidden="true" />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent border-2 border-white" />
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.96 }}
                        transition={{ type: 'spring', damping: 22 }}
                        role="dialog"
                        aria-modal="false"
                        aria-label="Asistente virtual de Tío José María"
                        className="fixed bottom-6 left-6 right-6 sm:right-auto sm:w-[380px] z-[60] flex flex-col bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
                        style={{ maxHeight: 'min(72vh, 640px)' }}
                    >
                        {/* Header */}
                        <header className="px-5 py-4 bg-gradient-to-br from-primary to-rural-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
                                    <Sparkles size={18} aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="font-serif font-bold leading-tight">Asistente virtual</p>
                                    <p className="text-xs text-white/70">Tío José María · IA basada en Claude</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Cerrar asistente"
                                className="text-white/85 hover:text-white"
                            >
                                <X size={20} aria-hidden="true" />
                            </button>
                        </header>

                        {/* Mensajes */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-surface-warm">
                            {messages.map((m, i) => (
                                <MessageBubble key={i} role={m.role} text={m.text} isDisclaimer={m.isDisclaimer} isError={m.isError} sources={m.sources} />
                            ))}
                            {sending && (
                                <div className="flex justify-start">
                                    <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
                                        <TypingDots />
                                    </div>
                                </div>
                            )}
                            {messages.length <= 1 && !sending && (
                                <div className="pt-2 space-y-2">
                                    <p className="text-xs text-gray-500 font-medium px-1">Algunas preguntas frecuentes:</p>
                                    {SUGGESTED.map((s, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => send(s)}
                                            className="block w-full text-left text-sm px-3 py-2 rounded-xl bg-white hover:bg-rural-50 border border-gray-100 text-text-primary transition-colors"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <form
                            onSubmit={(e) => { e.preventDefault(); send(); }}
                            className="border-t border-gray-100 bg-white px-3 py-3 flex items-center gap-2"
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Escribe tu pregunta..."
                                disabled={sending}
                                aria-label="Mensaje al asistente"
                                maxLength={500}
                                className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-100 rounded-full outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 text-text-primary disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={sending || !input.trim()}
                                aria-label="Enviar"
                                className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-rural-700 transition-colors"
                            >
                                <Send size={16} aria-hidden="true" />
                            </button>
                        </form>

                        {/* Pie con disclaimer breve permanente */}
                        <p className="text-[10px] text-gray-400 leading-tight px-4 pb-2 text-center">
                            IA generativa, puede equivocarse. Para reservas y temas vinculantes, usa la web o WhatsApp.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

const MessageBubble = ({ role, text, isDisclaimer, isError, sources }) => {
    const isUser = role === 'user';
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={[
                    'max-w-[85%] px-4 py-3 text-sm leading-relaxed shadow-sm border',
                    isUser
                        ? 'bg-primary text-white rounded-2xl rounded-br-md border-primary'
                        : isDisclaimer
                            ? 'bg-rural-100 text-rural-900 rounded-2xl rounded-bl-md border-rural-200 font-medium'
                            : isError
                                ? 'bg-amber-50 text-amber-900 rounded-2xl rounded-bl-md border-amber-200'
                                : 'bg-white text-text-primary rounded-2xl rounded-bl-md border-gray-100',
                ].join(' ')}
            >
                <p className="whitespace-pre-wrap">{text}</p>
                {sources && sources.length > 0 && (
                    <p className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500 uppercase tracking-widest">
                        Basado en: {sources.slice(0, 3).map(s => s.title).join(' · ')}
                    </p>
                )}
            </div>
        </div>
    );
};

const TypingDots = () => (
    <span className="inline-flex gap-1" aria-label="Escribiendo">
        {[0, 1, 2].map(i => (
            <span
                key={i}
                className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
            />
        ))}
    </span>
);

export default BotChat;
