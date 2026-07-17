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
                description="Política de privacidad de Apartamentos Rurales Tío José María: tratamiento de datos, cookies y derechos del usuario conforme al RGPD."
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
                    <p className="text-sm text-gray-400 mb-10">Última actualización: 17 de julio de 2026</p>

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
                            <strong>Mapas incrustados (opcional).</strong> Si decides cargar el mapa de Google Maps embebido
                            en alguna página, tu navegador se conecta directamente a Google y le transmite datos de
                            navegación (ver apartado 10). No usamos ese mapa para construir perfiles ni con fines de
                            marketing propio.
                        </li>
                        <li>
                            <strong>Cumplimiento legal.</strong> Datos de la reserva exigidos por la normativa turística
                            andaluza, el Real Decreto 933/2021 (registro documental de viajeros SES.HOSPEDAJES) y la
                            normativa fiscal. Base: obligación legal (art. 6.1.c).
                        </li>
                    </ul>

                    <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">4. Plazos de conservación</h2>
                    <p className="text-gray-700 leading-relaxed mb-3">
                        Conservamos cada dato solo mientras es necesario para la finalidad que lo justifica y, después, el
                        tiempo exigido por la normativa aplicable:
                    </p>
                    <div className="overflow-x-auto mb-4 rounded-xl border border-gray-200">
                        <table className="w-full text-sm text-left text-gray-700">
                            <thead className="bg-rural-50 text-xs uppercase tracking-wide text-gray-600">
                                <tr>
                                    <th scope="col" className="px-4 py-2.5 font-bold">Dato</th>
                                    <th scope="col" className="px-4 py-2.5 font-bold">Plazo de conservación</th>
                                    <th scope="col" className="px-4 py-2.5 font-bold">Base legal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <tr>
                                    <td className="px-4 py-2.5 align-top font-medium text-text-primary">Obligaciones tributarias de la reserva</td>
                                    <td className="px-4 py-2.5 align-top">4 años desde la finalización de la obligación</td>
                                    <td className="px-4 py-2.5 align-top">Art. 66 Ley General Tributaria</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2.5 align-top font-medium text-text-primary">Facturas y documentación mercantil</td>
                                    <td className="px-4 py-2.5 align-top">6 años desde el último asiento de los libros</td>
                                    <td className="px-4 py-2.5 align-top">Art. 30 Código de Comercio</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2.5 align-top font-medium text-text-primary">Registro de viajeros (SES.HOSPEDAJES)</td>
                                    <td className="px-4 py-2.5 align-top">3 años</td>
                                    <td className="px-4 py-2.5 align-top">Real Decreto 933/2021</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2.5 align-top font-medium text-text-primary">Área de cliente</td>
                                    <td className="px-4 py-2.5 align-top">Mientras la cuenta esté activa, más 1 año tras la última actividad o hasta que solicites su baja</td>
                                    <td className="px-4 py-2.5 align-top">Ejecución del contrato</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2.5 align-top font-medium text-text-primary">Suscripción a la guía/newsletter</td>
                                    <td className="px-4 py-2.5 align-top">Hasta que retires el consentimiento</td>
                                    <td className="px-4 py-2.5 align-top">Consentimiento (art. 6.1.a RGPD)</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2.5 align-top font-medium text-text-primary">Logs del asistente de IA</td>
                                    <td className="px-4 py-2.5 align-top">12 meses; después se anonimizan o eliminan</td>
                                    <td className="px-4 py-2.5 align-top">Interés legítimo (seguridad y calidad)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        Al margen de estos plazos, cualquier dato puede conservarse de forma bloqueada mientras existan
                        acciones legales pendientes derivadas de la relación contractual.
                    </p>

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
                        la atención personal las toma siempre el responsable. No usamos analítica web ni construimos
                        perfiles individuales de los visitantes.
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
                        <li>Retirar el consentimiento prestado para finalidades opcionales (newsletter, mapas incrustados).</li>
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
                        Esta web no usa cookies de analítica ni de marketing. Solo utilizamos cookies técnicas, exentas de
                        consentimiento previo por ser imprescindibles para el funcionamiento del sitio (art. 22.2 LSSI):
                    </p>
                    <ul className="text-gray-700 leading-relaxed mb-4 list-disc pl-6 space-y-2">
                        <li>
                            <strong><code>tjm_cookie_consent_v2</code></strong> — guarda que ya has visto el aviso de
                            cookies. Duración: 1 año.
                        </li>
                        <li>
                            <strong><code>sb-*</code></strong> — tokens de sesión de Supabase, sólo presentes cuando inicias
                            sesión en el área de cliente o de administración. Duración: sesión / hasta cierre de sesión.
                        </li>
                        <li>
                            <strong><code>__cf_bm</code></strong> — cookie técnica anti-bot de Cloudflare, la establece el
                            CDN que sirve las imágenes alojadas en nuestro proveedor de almacenamiento (Supabase Storage).
                            No identifica personalmente al usuario ni se usa con fines publicitarios. Duración: ~30 minutos.
                        </li>
                        <li>
                            <strong>Service Worker y caché PWA</strong> — almacenan recursos del sitio (imágenes, páginas)
                            para que funcione offline; no contienen datos personales.
                        </li>
                        <li>
                            <strong><code>tjm_maps_ok</code> (localStorage, opcional).</strong> Solo se crea si decides
                            cargar un mapa de Google Maps embebido, para no volver a preguntarte. Al cargarlo, Google puede
                            establecer sus propias cookies según su política de privacidad, ajena a nosotros.
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
                        {' '}— vuelve a abrir el aviso cuando quieras.
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
