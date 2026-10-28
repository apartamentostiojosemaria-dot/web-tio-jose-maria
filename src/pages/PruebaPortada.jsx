import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHead from '../components/seo/PageHead';
import { whatsappLink } from '../constants/urls';
import { imgAttrs } from '../utils/supabaseImage';

// Trial homepage (27-oct-2026): the canvas design «La casa» with motion, for Jesús to see on his phone.
// Not linked anywhere and noindex. Source of truth for copy and routes:
// OS · clients/tio-jose-maria/projects/web-portada/2026-10-27-auditoria/ (textos-portada.md, estudio de entorno).

const S = 'https://nmtukksbzbnuzqsksdmw.supabase.co/storage/v1/object/public/apartments/website';

const APARTMENTS = [
    { slug: 'lavanda', name: 'Lavanda', line: '4 plazas · el más amplio · balcones al valle', price: 110, big: true,
        a: `${S}/lavanda/c02129c8-a3c1-4cd1-8f5b-2552347c8f85-1024x768.webp`, b: `${S}/lavanda/658e1f2f-36fa-4155-a8a4-ed8666494d0f-1024x768.webp` },
    { slug: 'albahaca', name: 'Albahaca', line: '2 plazas · balcón de forja', price: 60,
        a: `${S}/albahaca/00f8fcdf-a6ef-45bb-aafb-408b8679a750-1024x768.webp`, b: `${S}/albahaca/ed7f646a-5023-49d4-b15a-d6bcccf2d90e-1024x768.jpeg` },
    { slug: 'tomillo', name: 'Tomillo', line: '2 plazas · abuhardillado, altillo con escalera', price: 60,
        a: `${S}/general/TOMILLOHOME1.jpg`, b: `${S}/tomillo/tomi2-1024x683.webp` },
    { slug: 'romero', name: 'Romero', line: '4 plazas · dos baños · vistas al Guadiana Menor', price: 110, wide: true,
        a: `${S}/romero/d06afd5b-9f3c-49df-9722-ee9b6c5ae4a6-1110x500.webp`, b: `${S}/romero/10e6d58a-78ef-4923-8ebf-b4558b8302a6-1110x500.jpeg` },
];

const ROUTES = [
    { tag: 'A pie desde casa', meta: 'SL-A 199 · 6,7 km · +244 m', name: 'Salinas del Mesto', text: 'Sale del mismo pueblo entre cárcavas, olivos y almendros, hasta unas salinas del siglo XIX.' },
    { tag: '21 min en coche', meta: 'Paseo corto · 15 min', name: 'Santuario de Tíscar y Cueva del Agua', text: 'Una cascada dentro de una cueva, junto al santuario. Para la tarde que llegáis.' },
    { tag: '32 min en coche', meta: 'SL-A 314 · 7,5 km circular · +325 m', name: 'Chimeneas del Negratín', text: 'Cárcavas rojas sobre el agua turquesa del embalse. Al acabar, una poza de agua termal junto al Negratín.' },
    { tag: '38 min en coche', meta: '2,2 km circular · 1 h · entrada 2,30 €', name: 'Cerrada del Río Castril', text: 'Pasarelas colgadas sobre el cañón, de 9:00 a 20:00.' },
];

const REVIEWS = [
    { text: '«Al llegar te dan un libro con las cosas de interés, mapas de rutas…»', who: 'Cristina · Booking' },
    { text: '«Limpísimo todo y tranquilo para relajarte después de una buena ruta de senderismo.»', who: 'Antonio · Booking' },
    { text: '«Limpieza 100 % y el trato de los dueños. Pueblo precioso para desconectar.»', who: 'Helena · Booking' },
];

const FACHADA = `${S}/albahaca/272238d4-d730-4f4c-b63a-756bf83b43cc-683x1024.jpg`;
const CASCADA = `${S}/albahaca/33735e3a-bc58-4a40-938f-caf66b1833b0-768x1024.jpg`;
const POZA = `${S}/albahaca/ffa21a8d-9e1e-4f8f-aedb-b6362c64c523-1024x768.jpg`;
const CARCAVAS = `${S}/lavanda/cb5de987-881a-4399-a194-b3d959d42202-1110x500.jpg`;

const toISO = (d) => d.toISOString().slice(0, 10);
const nextFriday = () => {
    const d = new Date();
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
    return d;
};

const css = `
.pp{--olive:#556B2F;--ink:#2C3319;--cream:#FCFBF9;--sand:#EDE8DA;--muted:#5C5640;background:var(--cream);color:var(--ink)}
.pp .serif{font-family:'Playfair Display',serif}
.pp-kb{animation:pp-kb 24s cubic-bezier(.37,0,.63,1) infinite alternate;transform-origin:40% 60%}
@keyframes pp-kb{from{transform:scale(1)}to{transform:scale(1.07)}}
.pp-ventana{animation:pp-abre 1.6s cubic-bezier(.16,1,.3,1) .2s both}
@keyframes pp-abre{from{clip-path:inset(12% 30% 0% 30% round 360px 360px 0 0)}to{clip-path:inset(0% 0% 0% 0% round 18px)}}
.pp-entra{animation:pp-entra .9s cubic-bezier(.16,1,.3,1) both}
@keyframes pp-entra{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
.pp-l1{display:block;animation:pp-entra .9s cubic-bezier(.16,1,.3,1) .35s both}
.pp-l2{display:block;animation:pp-entra .9s cubic-bezier(.16,1,.3,1) .5s both}
.pp-d1{animation-delay:.75s}.pp-d2{animation-delay:.9s}.pp-d3{animation-delay:1.05s}.pp-d4{animation-delay:1.3s}
.pp-rama path{stroke-dasharray:240;stroke-dashoffset:240;animation:pp-draw 1.6s cubic-bezier(.65,0,.35,1) .3s forwards}
.pp-rama path+path{animation-delay:.9s}
@keyframes pp-draw{to{stroke-dashoffset:0}}
.pp-ruta{stroke-dasharray:900;stroke-dashoffset:900;animation:pp-draw 2.4s cubic-bezier(.16,1,.3,1) .6s forwards}
.pp-ap img{transition:opacity 260ms cubic-bezier(.23,1,.32,1)}
.pp-ap .pp-b{opacity:0}
@media (hover:hover) and (pointer:fine){.pp-ap:hover .pp-b{opacity:1}}
.pp-btn{transition:transform 120ms ease-out}.pp-btn:active{transform:scale(.97)}
@supports (animation-timeline: view()){
  .pp-revela{animation:pp-revela linear both;animation-timeline:view();animation-range:entry 0% cover 35%}
  @keyframes pp-revela{from{clip-path:inset(35% 0 0 0);transform:scale(1.05)}to{clip-path:inset(0 0 0 0);transform:none}}
  .pp-lento{animation:pp-lento linear both;animation-timeline:view()}
  @keyframes pp-lento{from{transform:translateY(50px)}to{transform:translateY(-50px)}}
  .pp-ruta{animation:pp-draw linear forwards;animation-timeline:view();animation-range:entry 10% cover 55%}
}
@media (prefers-reduced-motion:reduce){
  .pp-kb,.pp-ventana,.pp-entra,.pp-l1,.pp-l2,.pp-revela,.pp-lento{animation:none}
  .pp-ruta,.pp-rama path{animation:none;stroke-dashoffset:0}
}
`;

const Rama = ({ className = '' }) => (
    <svg className={`pp-rama ${className}`} aria-hidden="true" width="150" height="54" viewBox="0 0 150 54" fill="none" stroke="#556B2F" strokeWidth="1.6" strokeLinecap="round">
        <path d="M4 46 C40 40 80 26 146 8" />
        <path d="M38 40 C34 28 40 20 52 16 C54 28 50 36 38 40Z M70 31 C80 22 94 22 102 30 C92 36 80 37 70 31Z M98 22 C94 10 100 2 112 0 C114 12 108 19 98 22Z M122 15 C132 9 142 11 146 19 C136 22 128 20 122 15Z" />
    </svg>
);

const PruebaPortada = () => {
    const navigate = useNavigate();
    const fri = nextFriday();
    const sun = new Date(fri); sun.setDate(fri.getDate() + 2);
    const [entrada, setEntrada] = useState(toISO(fri));
    const [salida, setSalida] = useState(toISO(sun));
    const [personas, setPersonas] = useState(2);
    const wa = whatsappLink('Hola, os escribo desde la web. Quería preguntaros por unas fechas.');

    const buscar = (e) => {
        e.preventDefault();
        navigate(`/reservar?entrada=${entrada}&salida=${salida}&personas=${personas}`);
    };

    return (
        <div className="pp min-h-screen pb-24 md:pb-0" style={{ fontFamily: "'Lato', sans-serif" }}>
            <PageHead title="Prueba de portada" description="Página de prueba." path="/prueba/portada" noindex />
            <style>{css}</style>

            <nav className="max-w-[1440px] mx-auto flex items-center justify-between px-5 md:px-20 py-4 md:py-6">
                <Link to="/prueba/portada" className="flex flex-col leading-none no-underline">
                    <span className="serif text-[21px] md:text-[26px] font-semibold" style={{ color: 'var(--olive)' }}>Tío José María</span>
                    <span className="hidden md:block text-[12px] tracking-[0.16em] mt-1" style={{ color: 'var(--muted)' }}>APARTAMENTOS RURALES · HINOJARES</span>
                </Link>
                <div className="flex items-center gap-8 text-[15px]">
                    <a href="#apartamentos" className="hidden md:inline no-underline" style={{ color: 'var(--ink)' }}>Apartamentos</a>
                    <a href="#rutas" className="hidden md:inline no-underline" style={{ color: 'var(--ink)' }}>Rutas</a>
                    <a href="#llegar" className="hidden md:inline no-underline" style={{ color: 'var(--ink)' }}>Cómo llegar</a>
                    <a href="#buscar" className="pp-btn no-underline text-white font-bold rounded-full px-5 py-3" style={{ background: 'var(--olive)' }}>Reservar</a>
                </div>
            </nav>

            <header className="max-w-[1440px] mx-auto px-5 md:px-20 pt-2 md:pt-6 grid md:grid-cols-12 gap-8 md:gap-8 items-end">
                <div className="md:col-span-6 flex flex-col gap-5 md:gap-6 md:pb-10">
                    <Rama />
                    <h1 className="serif m-0 text-[38px] md:text-[68px] leading-[1.06] font-semibold tracking-[-0.01em]">
                        <span className="pp-l1">Apartamentos Rurales Tío José María</span>
                        <span className="pp-l2 italic font-medium" style={{ color: 'var(--olive)' }}>en la Sierra de Cazorla</span>
                    </h1>
                    <p className="pp-entra pp-d1 m-0 text-[17px] md:text-[22px] leading-[1.55] max-w-[540px]">
                        Cuatro apartamentos en la casa de la familia, del siglo XVIII, en el centro de Hinojares. Mari Carmen y Jesús os abren la puerta y os dan su libro de rutas.
                    </p>
                    <p className="pp-entra pp-d2 m-0 text-[15px] md:text-[17px]"><strong>Para dos, desde 60 € la noche</strong> · para cuatro, desde 110 €</p>
                    <div className="pp-entra pp-d3 flex gap-3 items-center text-[15px]" style={{ color: 'var(--muted)' }}>
                        <span className="serif text-[30px] font-bold" style={{ color: 'var(--ink)' }}>9,5</span>
                        <span>sobre 10 en Booking<br />más de 45 opiniones</span>
                    </div>
                </div>
                <div className="md:col-span-6 relative h-[230px] md:h-[600px] mt-4 md:mt-0 order-first md:order-none">
                    <div className="pp-ventana absolute top-0 right-0 w-full h-[220px] md:h-[560px] overflow-hidden">
                        <img className="pp-kb w-full h-full object-cover block" src="/assets/prueba/hinojares-panoramica.webp"
                            srcSet="/assets/prueba/hinojares-panoramica-900.webp 900w, /assets/prueba/hinojares-panoramica.webp 1920w"
                            sizes="(min-width: 768px) 50vw, 100vw" alt="Hinojares entre olivos, con la sierra detrás" fetchPriority="high" />
                    </div>
                    <img {...imgAttrs(FACHADA, { width: 460 })} alt="Fachada de la casa con el balcón de forja"
                        className="pp-entra pp-d4 absolute right-3 -top-4 md:right-6 md:-top-8 w-[72px] h-[94px] md:w-[160px] md:h-[210px] object-cover rounded-[12px]"
                        style={{ border: '6px solid var(--cream)', boxShadow: '0 18px 44px rgba(44,51,25,0.20)' }} />
                </div>
            </header>

            <form id="buscar" onSubmit={buscar}
                className="pp-entra pp-d4 max-w-[1280px] mx-5 md:mx-auto md:w-[calc(100%-80px)] mt-6 md:mt-12 p-4 md:py-4 md:pl-8 md:pr-4 bg-white border rounded-[20px] md:rounded-full flex flex-col md:flex-row md:items-center gap-3 md:gap-6"
                style={{ borderColor: '#E6DFCC', boxShadow: '0 18px 40px rgba(44,51,25,0.08)' }}>
                <div className="grid grid-cols-2 md:contents gap-3">
                    <label className="md:flex-1 min-w-0 flex flex-col gap-1 text-[13px] font-bold" style={{ color: 'var(--muted)' }}>Llegada
                        <input type="date" required value={entrada} min={toISO(new Date())} onChange={(e) => setEntrada(e.target.value)}
                            className="w-full min-w-0 border md:border-0 rounded-[10px] p-3 md:p-0 text-[16px] font-normal bg-transparent" style={{ color: 'var(--ink)', borderColor: '#E6DFCC' }} />
                    </label>
                    <label className="md:flex-1 min-w-0 flex flex-col gap-1 text-[13px] font-bold" style={{ color: 'var(--muted)' }}>Salida
                        <input type="date" required value={salida} min={entrada} onChange={(e) => setSalida(e.target.value)}
                            className="w-full min-w-0 border md:border-0 rounded-[10px] p-3 md:p-0 text-[16px] font-normal bg-transparent" style={{ color: 'var(--ink)', borderColor: '#E6DFCC' }} />
                    </label>
                </div>
                <label className="md:flex-1 min-w-0 flex flex-col gap-1 text-[13px] font-bold" style={{ color: 'var(--muted)' }}>Personas
                    <select value={personas} onChange={(e) => setPersonas(Number(e.target.value))}
                        className="w-full min-w-0 border md:border-0 rounded-[10px] p-3 md:p-0 text-[16px] font-normal bg-transparent" style={{ color: 'var(--ink)', borderColor: '#E6DFCC' }}>
                        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'persona' : 'personas'}</option>)}
                    </select>
                </label>
                <button type="submit" className="pp-btn shrink-0 text-white font-bold text-[16px] rounded-full px-8 py-4 border-0" style={{ background: 'var(--olive)' }}>
                    Ver apartamentos libres
                </button>
            </form>
            <p className="max-w-[1280px] mx-5 md:mx-auto md:w-[calc(100%-80px)] mt-3 text-[14px] text-center md:text-left" style={{ color: 'var(--muted)' }}>
                Reservad aquí y pagad con tarjeta. Si encontráis el mismo apartamento más barato en otra web, os igualamos el precio. Cancelación gratis hasta 7 días antes.
            </p>

            <section className="max-w-[1440px] mx-auto px-5 md:px-20 pt-20 md:pt-36 grid md:grid-cols-12 gap-10 md:gap-8 items-center">
                <div className="md:col-span-5 relative h-[360px] md:h-[600px]">
                    <div className="absolute top-0 left-0 w-[78%] md:w-[360px] h-[300px] md:h-[460px] rounded-[14px] flex items-center justify-center text-center text-[13px] tracking-[0.12em] font-bold"
                        style={{ background: 'repeating-linear-gradient(135deg,#EDE8DA 0 14px,#E4DDCA 14px 28px)', color: 'var(--muted)' }}>
                        FOTO DE MARI CARMEN Y JESÚS<br />en la puerta · pendiente
                    </div>
                    <img {...imgAttrs(APARTMENTS[1].a, { width: 600 })} alt="Salón de Albahaca"
                        className="pp-lento absolute right-0 bottom-0 w-[55%] md:w-[300px] h-[160px] md:h-[220px] object-cover rounded-[14px]"
                        style={{ border: '8px solid var(--cream)' }} />
                </div>
                <div className="md:col-span-6 md:col-start-7 flex flex-col gap-5">
                    <h2 className="serif m-0 text-[31px] md:text-[50px] leading-[1.12] font-semibold">
                        Os abren la puerta <span className="italic" style={{ color: 'var(--olive)' }}>Mari Carmen y Jesús</span>
                    </h2>
                    <p className="m-0 text-[16px] md:text-[19px] leading-[1.7] max-w-[600px]">
                        Os esperamos en la casa entre las 16:00 y las 20:00. Os enseñamos el apartamento, os damos el libro con las rutas y los sitios para comer, y os decimos cuál haríamos mañana con el tiempo que vaya a hacer. La casa lleva el nombre de José María, el primero de la familia que vivió en ella. Si algo falta, nos llamáis y vamos.
                    </p>
                    <blockquote className="m-0 mt-1 flex flex-col gap-2">
                        <p className="serif m-0 text-[19px] md:text-[24px] leading-[1.45] italic">«Mari Carmen es encantadora y su marido también y la casa súper bonita. Nos encantó.»</p>
                        <p className="m-0 text-[15px]" style={{ color: 'var(--muted)' }}>Begoña · opinión en Booking</p>
                    </blockquote>
                </div>
            </section>

            <section id="apartamentos" className="max-w-[1440px] mx-auto px-5 md:px-20 pt-20 md:pt-40 flex flex-col gap-8 md:gap-11">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 md:gap-10">
                    <h2 className="serif m-0 text-[31px] md:text-[50px] leading-[1.12] font-semibold">
                        Cuatro apartamentos <span className="italic" style={{ color: 'var(--olive)' }}>en una casa de pueblo del siglo XVIII</span>
                    </h2>
                    <p className="m-0 text-[16px] md:text-[17px] leading-[1.6] max-w-[420px]">
                        Muros de piedra, vigas de madera, calefacción y aire acondicionado en cada uno. Un 10 en limpieza en Booking. «No hemos echado nada en falta», escribió Antonio.
                    </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-12 md:grid-rows-[300px_300px_260px] gap-3 md:gap-7">
                    {APARTMENTS.map((ap) => (
                        <Link key={ap.slug} to={`/apartamento/${ap.slug}`}
                            className={`pp-ap pp-revela relative block overflow-hidden rounded-[14px] no-underline text-white ${ap.big ? 'col-span-2 md:col-span-7 md:row-span-2 h-[300px] md:h-auto' : ap.wide ? 'col-span-2 md:col-span-12 h-[220px] md:h-auto' : 'col-span-1 md:col-span-5 h-[220px] md:h-auto'}`}>
                            <img {...imgAttrs(ap.a, { width: 1100 })} alt={ap.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                            <img {...imgAttrs(ap.b, { width: 1100 })} alt="" className="pp-b absolute inset-0 w-full h-full object-cover" loading="lazy" />
                            <div className="absolute left-0 right-0 bottom-0 px-4 md:px-7 pt-16 md:pt-20 pb-4 md:pb-6 flex justify-between items-end gap-3"
                                style={{ background: 'linear-gradient(0deg, rgba(28,32,16,0.8), rgba(28,32,16,0))' }}>
                                <div>
                                    <div className="serif text-[20px] md:text-[32px] font-semibold">{ap.name}</div>
                                    <div className="text-[13px] md:text-[15px]">{ap.line}</div>
                                </div>
                                <div className="text-[13px] md:text-[15px] text-right whitespace-nowrap">desde <strong className="text-[17px] md:text-[21px]">{ap.price} €</strong></div>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <section id="rutas" className="mt-20 md:mt-40 relative overflow-hidden" style={{ background: 'var(--ink)', color: 'var(--cream)' }}>
                <svg aria-hidden="true" width="520" height="520" viewBox="0 0 200 200" className="absolute -right-24 -top-10 opacity-[0.16]" fill="none" stroke="#D6CEB8" strokeWidth="1.2" strokeLinecap="round">
                    <path d="M20 180 C70 140 110 100 185 20" /><path d="M60 148 C50 128 58 112 76 104 C80 122 74 138 60 148Z" /><path d="M92 120 C110 112 128 118 136 132 C118 138 102 134 92 120Z" /><path d="M110 98 C102 80 108 64 124 56 C130 74 124 90 110 98Z" /><path d="M140 70 C156 64 172 70 178 84 C162 88 148 82 140 70Z" />
                </svg>
                <div className="max-w-[1440px] mx-auto px-5 md:px-20 py-16 md:py-28 grid md:grid-cols-12 gap-x-8 gap-y-10 md:gap-y-14 relative">
                    <div className="md:col-span-6 flex flex-col gap-5">
                        <h2 className="serif m-0 text-[31px] md:text-[50px] leading-[1.12] font-semibold" style={{ color: 'var(--cream)' }}>
                            El libro de rutas <span className="italic" style={{ color: '#D6CEB8' }}>que os damos al llegar</span>
                        </h2>
                        <p className="m-0 text-[16px] md:text-[19px] leading-[1.7] max-w-[560px]" style={{ color: '#E9E3D3' }}>
                            Son las que hacemos nosotros por el sur del parque y el Geoparque, con lo que se tarda en coche desde casa, dónde aparcar y dónde comer después. Una sale de nuestra misma calle.
                        </p>
                    </div>
                    <div className="md:col-span-5 md:col-start-8 h-[200px] md:h-[300px] rounded-[16px]" style={{ background: 'rgba(252,251,249,0.06)', border: '1px solid rgba(214,206,184,0.25)' }}>
                        <svg role="img" aria-label="Esquema de rutas desde la casa" width="100%" height="100%" viewBox="0 0 460 300">
                            <path className="pp-ruta" d="M90 220 C140 200 170 150 230 140 C290 130 330 90 390 60" fill="none" stroke="#D6CEB8" strokeWidth="3" strokeLinecap="round" />
                            <path className="pp-ruta" d="M90 220 C150 240 220 250 300 230 C340 220 380 230 410 250" fill="none" stroke="#A9B98A" strokeWidth="3" strokeLinecap="round" />
                            <path className="pp-ruta" d="M90 220 C110 170 100 120 140 80 C160 60 170 40 200 30" fill="none" stroke="#E6C98A" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="90" cy="220" r="10" fill="#FCFBF9" />
                            <text x="90" y="252" textAnchor="middle" fontFamily="Lato" fontSize="14" fontWeight="700" fill="#FCFBF9">La casa</text>
                            <text x="440" y="290" textAnchor="end" fontFamily="Lato" fontSize="12" fill="#CFC6AE">Esquema, no a escala</text>
                        </svg>
                    </div>
                    <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-12 gap-3 md:gap-6 h-[160px] md:h-[300px]">
                        <img {...imgAttrs(CASCADA, { width: 500 })} alt="Cascada en la sierra" className="pp-lento md:col-span-3 w-full h-full object-cover rounded-[14px]" loading="lazy" />
                        <img {...imgAttrs(CARCAVAS, { width: 1100 })} alt="Hinojares y las cárcavas" className="pp-revela hidden md:block md:col-span-6 w-full h-full object-cover rounded-[14px]" loading="lazy" />
                        <img {...imgAttrs(POZA, { width: 500 })} alt="Poza de agua verde entre rocas" className="pp-lento md:col-span-3 w-full h-full object-cover rounded-[14px]" loading="lazy" />
                    </div>
                    {ROUTES.map((r) => (
                        <article key={r.name} className="md:col-span-3 flex flex-col gap-2 md:gap-3 pt-4 md:pt-5" style={{ borderTop: '1px solid rgba(214,206,184,0.35)' }}>
                            <div className="text-[13px] md:text-[14px] font-bold" style={{ color: '#D6CEB8' }}>{r.tag}</div>
                            <h3 className="serif m-0 text-[22px] md:text-[24px] leading-[1.2] font-semibold" style={{ color: 'var(--cream)' }}>{r.name}</h3>
                            <div className="text-[14px]" style={{ color: '#CFC6AE' }}>{r.meta}</div>
                            <p className="m-0 text-[15px] md:text-[16px] leading-[1.6]" style={{ color: '#E9E3D3' }}>{r.text}</p>
                        </article>
                    ))}
                    <Link to="/rutas" className="md:col-span-12 text-[16px] font-bold" style={{ color: '#D6CEB8' }}>Ver todas las rutas y el mapa →</Link>
                </div>
            </section>

            <section id="llegar" className="max-w-[1440px] mx-auto px-5 md:px-20 pt-20 md:pt-36 grid md:grid-cols-12 gap-8 items-center">
                <div className="md:col-span-5 flex flex-col gap-5">
                    <h2 className="serif m-0 text-[31px] md:text-[46px] leading-[1.12] font-semibold">Cómo llegar <span className="italic" style={{ color: 'var(--olive)' }}>sin perderse</span></h2>
                    <p className="m-0 text-[16px] md:text-[18px] leading-[1.7]">Vengáis de Granada, Murcia o Jaén, todas las llegadas se juntan en el mismo cruce de la A-315, a 1,2 km de la puerta. Aparcamiento gratis enfrente.</p>
                    <table className="w-full text-[16px] md:text-[17px] border-collapse">
                        <tbody>
                            {[['Granada', '121 km · 1 h 54'], ['Jaén', '126 km · 1 h 54'], ['Murcia', '230 km · 2 h 52']].map(([c, t], i, arr) => (
                                <tr key={c} style={{ borderBottom: i < arr.length - 1 ? '1px solid #E6DFCC' : 'none' }}>
                                    <td className="py-3">{c}</td><td className="py-3 text-right font-bold">{t}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="md:col-span-6 md:col-start-7 h-[220px] md:h-[400px] rounded-[16px] overflow-hidden relative pp-revela" style={{ background: 'var(--ink)' }}>
                    <img src="/assets/prueba/hinojares-panoramica-900.webp" alt="" className="w-full h-full object-cover opacity-55" loading="lazy" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6" style={{ color: 'var(--cream)' }}>
                        <div className="serif text-[18px] md:text-[24px] font-semibold">El camino hasta la puerta, en 3D</div>
                        <div className="text-[13px] md:text-[14px]">Próximamente, con el relieve y las casas del pueblo</div>
                    </div>
                </div>
            </section>

            <section className="max-w-[1440px] mx-auto px-5 md:px-20 pt-20 md:pt-36 flex flex-col gap-8">
                <h2 className="serif m-0 text-[31px] md:text-[46px] font-semibold">Lo que dicen <span className="italic" style={{ color: 'var(--olive)' }}>quienes han venido</span></h2>
                <div className="grid md:grid-cols-3 gap-6 md:gap-11">
                    {REVIEWS.map((r) => (
                        <figure key={r.who} className="m-0 flex flex-col gap-3 pt-5" style={{ borderTop: '2px solid var(--olive)' }}>
                            <p className="serif m-0 text-[18px] md:text-[20px] leading-[1.55] italic">{r.text}</p>
                            <figcaption className="text-[14px] md:text-[15px]" style={{ color: 'var(--muted)' }}>{r.who}</figcaption>
                        </figure>
                    ))}
                </div>
            </section>

            <section className="max-w-[1280px] mx-4 md:mx-auto md:w-[calc(100%-80px)] mt-20 md:mt-36 p-7 md:p-16 rounded-[22px] grid md:grid-cols-12 gap-6 md:gap-8 items-center" style={{ background: 'var(--sand)' }}>
                <div className="md:col-span-5 flex flex-col gap-4">
                    <h2 className="serif m-0 text-[28px] md:text-[44px] leading-[1.12] font-semibold">Reservad <span className="italic" style={{ color: 'var(--olive)' }}>con nosotros</span></h2>
                    <p className="m-0 text-[16px] md:text-[18px] leading-[1.7]">Pagáis con tarjeta aquí mismo y habláis con nosotros desde el primer mensaje. Si encontráis el mismo apartamento más barato en otra web, os igualamos el precio.</p>
                    <div className="flex flex-wrap gap-3 mt-1">
                        <a href="#buscar" className="pp-btn no-underline text-white font-bold rounded-full px-7 py-4" style={{ background: 'var(--olive)' }}>Ver apartamentos libres</a>
                        <a href={wa} target="_blank" rel="noopener noreferrer" className="pp-btn no-underline font-bold rounded-full px-6 py-4" style={{ color: 'var(--ink)', border: '1.5px solid var(--olive)' }}>Escribidnos por WhatsApp</a>
                    </div>
                </div>
                <div className="md:col-span-6 md:col-start-7 flex flex-col gap-3">
                    <table className="w-full text-[15px] md:text-[17px] border-collapse">
                        <thead><tr style={{ borderBottom: '1px solid #D6CEB8', color: 'var(--muted)' }}><th className="text-left py-3 font-normal">Por noche</th><th className="text-right py-3 font-normal">Temporada baja</th><th className="text-right py-3 font-normal">Alta</th></tr></thead>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid #D6CEB8' }}><td className="py-4">Albahaca y Tomillo · 2 personas</td><td className="text-right font-bold">60 €</td><td className="text-right font-bold">75 €</td></tr>
                            <tr><td className="py-4">Lavanda y Romero · 4 personas</td><td className="text-right font-bold">110 €</td><td className="text-right font-bold">130 €</td></tr>
                        </tbody>
                    </table>
                    <p className="m-0 text-[14px] md:text-[15px]" style={{ color: 'var(--muted)' }}>Cancelación gratis hasta 7 días antes de la llegada.</p>
                </div>
            </section>

            <footer className="max-w-[1440px] mx-auto mt-20 md:mt-28 px-5 md:px-20 py-10 md:py-14 flex flex-col md:flex-row md:justify-between gap-4 text-[14px] md:text-[15px] leading-[1.8]" style={{ borderTop: '1px solid #E6DFCC' }}>
                <div><div className="serif text-[20px] md:text-[22px] font-semibold" style={{ color: 'var(--olive)' }}>Tío José María</div>Calle Baja 1, 23486 Hinojares, Jaén · 676 34 46 75</div>
                <div className="md:text-right">Registro de Turismo de Andalucía A/JA/00060<br />
                    <Link to="/aviso-legal">Aviso legal</Link> · <Link to="/privacidad">Privacidad</Link> · <Link to="/condiciones">Condiciones</Link></div>
            </footer>

            <div className="md:hidden fixed left-0 right-0 bottom-0 z-40 flex items-center gap-3 px-4 py-3" style={{ background: 'rgba(252,251,249,0.97)', borderTop: '1px solid #E6DFCC' }}>
                <div className="flex-1 text-[13px] leading-tight">desde <strong className="text-[17px]">60 €</strong> la noche<br /><span style={{ color: 'var(--muted)' }}>sin comisiones</span></div>
                <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Escribidnos por WhatsApp" className="w-12 h-12 rounded-full flex items-center justify-center" style={{ border: '1.5px solid var(--olive)' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#556B2F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" /></svg>
                </a>
                <a href="#buscar" className="pp-btn no-underline text-white font-bold rounded-full px-6 py-3.5 text-[15px]" style={{ background: 'var(--olive)' }}>Reservar</a>
            </div>
        </div>
    );
};

export default PruebaPortada;
