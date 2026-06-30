import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import PageHead from '../components/seo/PageHead';

const PrivacyPolicy = () => {
    const openCookieSettings = () => {
        window.dispatchEvent(new CustomEvent('tjm:cookie-consent-reopen'));
    };

    return (
        <div className="min-h-screen bg-white">
            <PageHead
                title="Política de Privacidad"
                description="Política de privacidad de Apartamentos Rurales Tío José María. Tratamiento de datos personales, cookies, sistemas de IA y derechos del usuario conforme al RGPD, LOPDGDD y AI Act."
                path="/privacidad"
            />
            <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center">
                    <Link to="/" className="flex items-center gap-2 text-rural-700 font-bold hover:gap-3 transition-all">
                        <ChevronLeft size={20} aria-hidden="true" /> Volver
                    </Link>
                </div>
            </nav>

            <main className="pt-24 pb-20 px-6">
                <div className="max-w-4xl mx-auto prose prose-gray">
                    <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2 text-text-primary">Política de Privacidad</h1>
                    <p className="text-sm text-gray-400 mb-10">Última actualización: 22 de junio de 2026</p>

                    <p className="text-gray-700 leading-relaxed mb-6">
                        En Apartamentos Rurales Tío José María tratamos tus datos personales con el cuidado que exige el
                        Reglamento (UE) 2016/679 (RGPD), la Ley Orgánica 3/2018 (LOPDGDD), la Ley 34/2002 (LSSI-CE) y el
                        Reglamento (UE) 2024/1689 (AI Act). Esta política te explica qué datos recogemos, para qué, durante
                        cuánto tiempo, con quién los compartimos y cómo puedes ejercer tus derechos.
                    </p>

                    <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">1. Responsable del tratamiento</h2>
                    <ul className="text-gray-700 leading-relaxed mb-4 list-disc pl-6">
                        <li><strong>Titular:</strong> Jesús Martínez Sánchez (persona física, autónomo)</li>
                        <li><strong>NIF:</strong> 26433801Q</li>
                        <li><strong>Denominación comercial:</strong> Apartamentos Rurales Tío José María</li>
                        <li><strong>Domicilio:</strong> Calle Baja 1, 23486 Hinojares, Jaén (España)</li>
                        <li><strong>Email:</strong> apartamentostiojosemaria@gmail.com</li>
                        <li><strong>Teléfono:</strong> +34 676 34 46 75</li>
                        <li><strong>Registro turístico:</strong> VTAR/JA/00044 (Junta de Andalucía)</li>
                    </ul>

                    <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">2. Delegado de Protección de Datos (DPO)</h2>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        No se ha designado Delegado de Protección de Datos porque la actividad no encaja en los supuestos
                        del artículo 37 del RGPD ni del artículo 34 de la LOPDGDD (no es una autoridad pública, no realiza
                        tratamiento a gran escala de datos sensibles, ni observación habitual y sistemática a gran escala).
                        Para cualquier asunto de privacidad puedes contactar directamente con el responsable en el email
                        indicado más arriba.
                    </p>

                    <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">3. Datos que recopilamos y finalidades</h2>
                    <p className="text-gray-700 leading-relaxed mb-2">Tratamos los siguientes datos, agrupados por finalidad:</p>
                    <ul className="text-gray-700 leading-relaxed mb-4 list-disc pl-6 space-y-2">
                        <li>
                            <strong>Reserva y estancia.</strong> Nombre y apellidos, DNI/NIE/pasaporte, dirección, teléfono,
                            email, fechas de entrada y salida, apartamento reservado, número de acompañantes y, cuando
                            corresponda, datos de pago gestionados por la pasarela. Base: ejecución del contrato (art. 6.1.b
                            RGPD) y obligación legal del registro de viajeros y sistema SES.HOSPEDAJES (art. 6.1.c).
                        </li>
                        <li>
                            <strong>Área de cliente.</strong> Email y contraseña (cifrada), datos de la reserva activa,
                            preferencias de estancia y mensajes con el alojamiento. Base: ejecución del contrato.
                        </li>
                        <li>
                            <strong>Suscripción y newsletter.</strong> Email y, opcionalmente, nombre. Base: consentimiento
                            (art. 6.1.a). Puedes darte de baja en cualquier momento desde el enlace de cada envío.
                        </li>
                        <li>
                            <strong>Asistente virtual e interacciones con sistemas de IA.</strong> Mensajes que escribes al
                            asistente, idioma, identificador anónimo de sesión, modelo usado, marca de tiempo y respuesta
                            generada. Base: ejecución del contrato (para huéspedes con reserva activa) o interés legítimo en
                            atender consultas (visitantes), informados en todo momento. Detalle en el apartado 8.
                        </li>
                        <li>
                            <strong>Analítica web (opcional).</strong> Páginas vistas, eventos de navegación, dispositivo,
                            país y duración aproximada de la visita, de forma agregada y sin perfilado individual. Base:
                            consentimiento (art. 6.1.a). Sólo se activa si lo aceptas en el aviso de cookies.
                        </li>
                        <li>
                            <strong>Marketing y remarketing (opcional).</strong> Identificadores publicitarios que permiten
                            mostrar contenido y mediciones fuera del sitio. Base: consentimiento (art. 6.1.a). Sólo se activa
                            si lo aceptas en el aviso de cookies.
                        </li>
                        <li>
                            <strong>Cumplimiento legal.</strong> Datos de la reserva exigidos por la normativa turística
                            andaluza, el Real Decreto 933/2021 (registro documental de viajeros SES.HOSPEDAJES) y la
                            normativa fiscal. Base: obligación legal (art. 6.1.c).
                        </li>
                    </ul>

                    <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">4. Plazos de conservación</h2>
                    <ul className="text-gray-700 leading-relaxed mb-4 list-disc pl-6 space-y-1">
                        <li><strong>Datos de reserva y facturación:</strong> 5 años desde la finalización del contrato (Ley General Tributaria) y los plazos prescriptivos civiles aplicables.</li>
                        <li><strong>Registro de viajeros (SES.HOSPEDAJES):</strong> 3 años conforme al Real Decreto 933/2021.</li>
                        <li><strong>Área de cliente:</strong> mientras la cuenta esté activa, más 1 año tras la última actividad o hasta que solicites su baja.</li>
                        <li><strong>Suscripción a la guía/newsletter:</strong> hasta que retires el consentimiento.</li>
                        <li><strong>Logs del asistente de IA:</strong> 12 meses con fines de seguridad, calidad y depuración, después se anonimizan o eliminan.</li>
                        <li><strong>Datos de analítica:</strong> 14 meses como máximo, agregados.</li>
                        <li><strong>Datos de marketing:</strong> hasta que retires el consentimiento o expire la cookie correspondiente.</li>
                    </ul>

                    <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">5. Destinatarios y encargados del tratamiento</h2>
                    <p className="text-gray-700 leading-relaxed mb-2">
                        No vendemos ni cedemos tus datos a terceros con fines comerciales. Trabajamos con los siguientes
                        proveedores que actúan como encargados del tratamiento bajo contrato (art. 28 RGPD):
                    </p>
                    <ul className="text-gray-700 leading-relaxed mb-4 list-disc pl-6 space-y-1">
                        <li><strong>Supabase</strong> (base de datos, autenticación y almacenamiento) — servidores en la Unión Europea.</li>
                        <li><strong>Resend</strong> (envío de emails transaccionales y newsletter) — servidores en la UE.</li>
                        <li><strong>Trigger.dev</strong> (orquestación de automatizaciones y avisos) — servidores en la UE.</li>
                        <li><strong>Amazon Web Services (AWS)</strong> — infraestructura del asistente de IA (Amazon Bedrock), ejecutado en la región de la Unión Europea (Fráncfort).</li>
                        <li><strong>Meta Platforms Ireland</strong> (mensajería WhatsApp para huéspedes que la habiliten) — servidores en la UE.</li>
                        <li><strong>Stripe</strong> (pasarela de pago de las reservas) — servidores en la UE con transferencias garantizadas.</li>
                        <li><strong>Pasarelas de reserva de terceros</strong> (Booking, Airbnb u otras cuando uses sus canales) — su tratamiento se rige por sus propias políticas.</li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        También cedemos datos cuando una norma con rango de ley lo exige (Ministerio del Interior vía
                        SES.HOSPEDAJES, autoridades sanitarias, fiscales o judiciales).
                    </p>

                    <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">6. Decisiones automatizadas y perfilado</h2>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        No tomamos decisiones automatizadas con efectos jurídicos o significativos sobre el usuario. El
                        asistente virtual ofrece información y sugerencias, pero las decisiones sobre la reserva, el precio o
                        la atención personal las toma siempre el responsable. La analítica web se trata de forma agregada y
                        no construye perfiles individuales.
                    </p>

                    <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">7. Transferencias internacionales</h2>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        Procuramos que tus datos se traten dentro del Espacio Económico Europeo. En particular, el
                        asistente de IA se ejecuta sobre Amazon Bedrock en la región de la Unión Europea (Fráncfort),
                        por lo que el contenido de la conversación no sale del EEE por este flujo. Si alguno de nuestros
                        encargados tratara datos fuera del EEE, dicha transferencia se ampara en las Cláusulas Contractuales
                        Tipo aprobadas por la Comisión Europea (Decisión 2021/914) y en garantías adicionales (cifrado en
                        tránsito, minimización de datos personales y no entrenamiento de modelos con tu información).
                    </p>

                    <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">8. Sistemas de inteligencia artificial</h2>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        Conforme al artículo 50 del Reglamento (UE) 2024/1689 (AI Act), te informamos de que algunas
                        funcionalidades del sitio están basadas en sistemas de IA generativa:
                    </p>
                    <ul className="text-gray-700 leading-relaxed mb-4 list-disc pl-6 space-y-1">
                        <li><strong>Asistente virtual</strong> para responder dudas sobre el alojamiento, la zona y la reserva. Antes de iniciar la conversación verás un aviso indicando que estás hablando con un sistema automatizado.</li>
                        <li><strong>Modelos usados:</strong> familia Claude (Anthropic), ejecutada a través de Amazon Bedrock en la región de la UE (Fráncfort). El modelo concreto y su versión se registran en los logs internos.</li>
                        <li><strong>Datos enviados al modelo:</strong> sólo el mensaje del usuario y, cuando aplica, el contexto público del sitio (guías, FAQs, descripciones de apartamentos). Nunca enviamos datos personales de otros huéspedes ni información identificable que no sea estrictamente necesaria.</li>
                        <li><strong>Logging:</strong> guardamos prompt, respuesta, modelo y marca de tiempo durante 12 meses para seguridad y mejora; después se anonimizan o eliminan.</li>
                        <li><strong>Limitaciones:</strong> el asistente puede equivocarse o estar desactualizado. Para cualquier información vinculante (precios, disponibilidad, condiciones legales) prevalece lo que diga el responsable por escrito.</li>
                        <li><strong>No entrenamiento:</strong> nuestros proveedores no usan tus conversaciones para entrenar sus modelos.</li>
                    </ul>

                    <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">9. Tus derechos</h2>
                    <p className="text-gray-700 leading-relaxed mb-2">Puedes ejercer en cualquier momento los siguientes derechos:</p>
                    <ul className="text-gray-700 leading-relaxed mb-4 list-disc pl-6 space-y-1">
                        <li>Acceso, rectificación, supresión, oposición, limitación y portabilidad de tus datos.</li>
                        <li>Retirar el consentimiento prestado para finalidades opcionales (analítica, marketing, newsletter).</li>
                        <li>No ser objeto de decisiones automatizadas significativas (ya garantizado, ver apartado 6).</li>
                        <li>Reclamar ante la <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="underline text-rural-700">Agencia Española de Protección de Datos</a> si consideras que tu derecho no ha sido atendido.</li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        Para ejercerlos, escribe a <a href="mailto:apartamentostiojosemaria@gmail.com" className="underline text-rural-700">apartamentostiojosemaria@gmail.com</a> indicando el derecho que quieres ejercer y, si es posible, acompañando una copia de tu DNI o documento equivalente. Responderemos en el plazo máximo de un mes.
                    </p>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        En caso de brecha de seguridad que afecte a tus datos, notificaremos a la AEPD en un plazo máximo de
                        72 horas (art. 33 RGPD) y, si supone un alto riesgo para tus derechos, te lo comunicaremos
                        directamente (art. 34 RGPD).
                    </p>

                    <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">10. Cookies y almacenamiento local</h2>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        Usamos tres tipos de cookies y tecnologías similares. Las técnicas son imprescindibles y están exentas
                        de consentimiento previo (art. 22.2 LSSI). Las opcionales sólo se activan si las aceptas en el aviso
                        de cookies, y puedes cambiar tu elección en cualquier momento.
                    </p>
                    <ul className="text-gray-700 leading-relaxed mb-4 list-disc pl-6 space-y-2">
                        <li>
                            <strong>Técnicas (necesarias).</strong> <code>tjm_cookie_consent_v2</code> guarda tu elección
                            sobre cookies. <code>sb-*</code> son tokens de sesión de Supabase, sólo presentes cuando inicias
                            sesión en el área de cliente o admin. El Service Worker y la caché PWA almacenan recursos del
                            sitio para que funcione offline; no contienen datos personales.
                        </li>
                        <li>
                            <strong>Analítica (opcional).</strong> Métricas agregadas de uso del sitio (páginas vistas,
                            duración, dispositivo, país). Sin perfilado individual.
                        </li>
                        <li>
                            <strong>Marketing (opcional).</strong> Cookies y píxeles de terceros para mostrar contenido
                            relevante fuera del sitio y medir campañas.
                        </li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        <button
                            type="button"
                            onClick={openCookieSettings}
                            className="underline text-rural-700 font-medium hover:text-rural-800 cursor-pointer"
                        >
                            Gestionar mis preferencias de cookies
                        </button>
                        {' '}— vuelve a abrir el panel para cambiar tu decisión cuando quieras.
                    </p>

                    <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">11. Cambios en esta política</h2>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        Si actualizamos esta política te lo indicaremos cambiando la fecha de "Última actualización". Cuando
                        el cambio afecte a finalidades para las que prestaste consentimiento, te lo pediremos de nuevo.
                    </p>
                </div>
            </main>
        </div>
    );
};

export default PrivacyPolicy;
