import { useState } from 'react';
import { Wifi, Key, Car, LogOut, AlertTriangle, ScrollText, ChevronDown, ChevronUp, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { COLORS } from '../../constants/colors';

const Section = ({ icon: Icon, title, children, defaultOpen = false, accent = false }) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className={`rounded-2xl border overflow-hidden transition-all ${accent ? 'border-rural-200 bg-rural-50' : 'border-gray-100 bg-white'}`}>
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50/50 transition-colors"
            >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accent ? COLORS.primary : '#f3f4f6' }}>
                    <Icon size={18} className={accent ? 'text-white' : 'text-gray-500'} />
                </div>
                <span className="font-bold text-sm flex-grow" style={{ color: COLORS.text }}>{title}</span>
                {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 pt-0 text-sm text-gray-600 leading-relaxed">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const WelcomePackage = ({ config, guestName }) => {
    const wifi_name = config?.wifi_name;
    const wifi_password = config?.wifi_password;
    const parking = config?.parking_instructions;
    const checkin = config?.checkin_instructions;
    const checkout = config?.checkout_instructions;
    const emergency = config?.emergency_contacts;
    const rules = config?.house_rules;

    const hasContent = wifi_name || parking || checkin || checkout || emergency || rules;
    if (!hasContent) return null;

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 pb-4" style={{ background: `linear-gradient(135deg, ${COLORS.primary}15, ${COLORS.accent}30)` }}>
                <p className="text-2xl mb-1">🏡</p>
                <h2 className="font-serif text-xl font-bold" style={{ color: COLORS.text }}>
                    {guestName ? `Bienvenido/a, ${guestName.split(' ')[0]}` : 'Tu Paquete de Bienvenida'}
                </h2>
                <p className="text-sm mt-1" style={{ color: COLORS.secondary }}>
                    Todo lo que necesitas para tu estancia en Tío José María
                </p>
            </div>

            <div className="p-4 space-y-2">
                {(wifi_name || wifi_password) && (
                    <Section icon={Wifi} title="WiFi" defaultOpen={true} accent>
                        <div className="flex flex-col sm:flex-row gap-4">
                            {wifi_name && (
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Red</p>
                                    <p className="font-mono font-bold text-base" style={{ color: COLORS.text }}>{wifi_name}</p>
                                </div>
                            )}
                            {wifi_password && (
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Contraseña</p>
                                    <p className="font-mono font-bold text-base" style={{ color: COLORS.text }}>{wifi_password}</p>
                                </div>
                            )}
                        </div>
                    </Section>
                )}

                {checkin && (
                    <Section icon={Key} title="Check-in" defaultOpen={true}>
                        <p>{checkin}</p>
                    </Section>
                )}

                {checkout && (
                    <Section icon={LogOut} title="Check-out">
                        <p>{checkout}</p>
                    </Section>
                )}

                {parking && (
                    <Section icon={Car} title="Aparcamiento">
                        <p>{parking}</p>
                    </Section>
                )}

                {rules && (
                    <Section icon={ScrollText} title="Normas de la casa">
                        <p>{rules}</p>
                    </Section>
                )}

                {emergency && (
                    <Section icon={Phone} title="Contactos de emergencia">
                        <div className="space-y-1">
                            {emergency.split('|').map((contact, i) => (
                                <p key={i} className="flex items-center gap-2">
                                    <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                                    {contact.trim()}
                                </p>
                            ))}
                        </div>
                    </Section>
                )}
            </div>
        </div>
    );
};

export default WelcomePackage;
