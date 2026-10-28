import React, { useEffect, useId, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, Check, AlertCircle } from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { supabase } from '../lib/supabase';
import { DATOS_TITULAR_CLAVE_PUBLICA } from '../constants/datosTitularClave';

// One-time form for the owner's details needed to activate Stripe (migration 0076).
// Everything is encrypted in the browser (AES-256-GCM, key wrapped with the operator's RSA-OAEP public key)
// before it leaves the computer; the server only stores ciphertext. Not linked anywhere, noindex.

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function cifrar(datos) {
    const pub = await crypto.subtle.importKey('spki', fromB64(DATOS_TITULAR_CLAVE_PUBLICA), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(datos)));
    const k = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, await crypto.subtle.exportKey('raw', aes));
    return { v: 1, k: b64(k), iv: b64(iv), c: b64(c) };
}

// Gentle checks that catch typos; they never block anything unusual for good (a NIE, a foreign IBAN).
const dniOk = (v) => {
    const s = v.toUpperCase().replace(/[\s-]/g, '');
    const m = s.match(/^([XYZ]?)(\d{7,8})([A-Z])$/);
    if (!m) return false;
    const n = Number(({ X: '0', Y: '1', Z: '2' }[m[1]] ?? '') + m[2]);
    return 'TRWAGMYFPDXBNJZSQVHLCKE'[n % 23] === m[3];
};
const ibanOk = (v) => {
    const s = v.toUpperCase().replace(/\s/g, '');
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
    const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
    let mod = 0;
    for (const d of r) mod = (mod * 10 + Number(d)) % 97;
    return mod === 1;
};

const VACIO = {
    nombre: '', apellido1: '', apellido2: '', dni: '', nacimiento: '', nacionalidad: 'Española',
    calle: '', piso: '', cp: '', localidad: 'Hinojares', provincia: 'Jaén', pais: 'España',
    movil: '', correo: '', iban: '', titularCuenta: '', notas: '',
};

const Campo = ({ label, ayuda, error, children, ancho = false }) => {
    const id = useId();
    const idNota = `${id}-nota`;
    const nota = error || ayuda;
    return (
        <div className={`flex flex-col gap-1.5 ${ancho ? 'md:col-span-2' : ''}`}>
            <label htmlFor={id} className="text-[16px] font-bold" style={{ color: '#2C3319' }}>{label}</label>
            {React.cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': nota ? idNota : undefined })}
            {error ? <span id={idNota} className="text-[15px] flex items-center gap-1.5" style={{ color: '#9B2C1F' }}><AlertCircle size={16} aria-hidden="true" />{error}</span>
                : ayuda ? <span id={idNota} className="text-[15px]" style={{ color: '#5C5640' }}>{ayuda}</span> : null}
        </div>
    );
};

const inputCls = 'w-full rounded-xl border px-4 py-3.5 text-[18px] bg-white focus:outline-none focus:ring-2';
const inputStyle = { borderColor: '#D6CEB8', color: '#2C3319' };

const DatosTitular = () => {
    const { token } = useParams();
    const [estado, setEstado] = useState('comprobando'); // comprobando | form | enviando | hecho | invalido | error
    const [d, setD] = useState(VACIO);
    const [errores, setErrores] = useState({});
    const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));

    useEffect(() => {
        let vivo = true;
        supabase.functions.invoke('recibir-datos-titular', { body: { accion: 'comprobar', token } })
            .then(({ data }) => { if (vivo) setEstado(data?.valido ? 'form' : 'invalido'); })
            .catch(() => { if (vivo) setEstado('invalido'); });
        return () => { vivo = false; };
    }, [token]);

    const validar = () => {
        const e = {};
        const req = ['nombre', 'apellido1', 'nacimiento', 'nacionalidad', 'calle', 'cp', 'localidad', 'provincia', 'movil', 'correo', 'iban', 'titularCuenta'];
        req.forEach((k) => { if (!String(d[k]).trim()) e[k] = 'Falta este dato'; });
        if (d.dni && !dniOk(d.dni)) e.dni = 'La letra no cuadra con el número. Revísalo con el DNI delante.';
        if (d.cp && !/^\d{5}$/.test(d.cp.trim())) e.cp = 'Son 5 números (el de Hinojares es 23486).';
        if (d.iban && !ibanOk(d.iban)) e.iban = 'Al número de cuenta le falta o le sobra algo. Empieza por ES y son 24 caracteres.';
        if (d.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.correo.trim())) e.correo = 'Revisa el correo: falta la @ o el final (.com, .es…).';
        if (d.movil && d.movil.replace(/\D/g, '').length < 9) e.movil = 'Son 9 números.';
        setErrores(e);
        return Object.keys(e).length === 0;
    };

    const enviar = async (ev) => {
        ev.preventDefault();
        if (!validar()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        setEstado('enviando');
        try {
            const datos = {
                ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v).trim()])),
                dni: d.dni.toUpperCase().replace(/[\s-]/g, ''),
                iban: d.iban.toUpperCase().replace(/\s/g, ''),
                enviadoEn: new Date().toISOString(),
            };
            const cifrado = await cifrar(datos);
            const { data, error } = await supabase.functions.invoke('recibir-datos-titular', { body: { accion: 'enviar', token, cifrado } });
            if (error || !data?.ok) throw new Error('envio');
            setD(VACIO);
            setEstado('hecho');
        } catch {
            setEstado('error');
        }
    };

    const marco = (contenido) => (
        <div className="min-h-screen px-5 py-10 md:py-16" style={{ background: '#FCFBF9', fontFamily: "'Lato', sans-serif", color: '#2C3319' }}>
            <PageHead title="Datos para los cobros" description="Formulario privado." path="/datos" noindex />
            <div className="max-w-[760px] mx-auto">
                <div className="text-[24px] font-semibold mb-8" style={{ fontFamily: "'Playfair Display', serif", color: '#556B2F' }}>Tío José María</div>
                {contenido}
            </div>
        </div>
    );

    if (estado === 'comprobando') return marco(<p className="text-[18px]">Un momento…</p>);
    if (estado === 'invalido') return marco(
        <div className="flex flex-col gap-3">
            <h1 className="text-[30px] font-semibold m-0" style={{ fontFamily: "'Playfair Display', serif" }}>Este enlace ya no sirve</h1>
            <p className="text-[18px] leading-relaxed m-0">Ya se ha usado o ha caducado. Pídeme uno nuevo.</p>
        </div>);
    if (estado === 'hecho') return marco(
        <div className="flex flex-col gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#EEF1E6' }}><Check size={30} color="#556B2F" /></div>
            <h1 className="text-[30px] font-semibold m-0" style={{ fontFamily: "'Playfair Display', serif" }}>Enviado. ¡Gracias!</h1>
            <p className="text-[18px] leading-relaxed m-0">Ya me ha llegado. Puedes cerrar esta página.</p>
        </div>);

    return marco(
        <form onSubmit={enviar} noValidate className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
                <h1 className="text-[32px] md:text-[38px] leading-tight font-semibold m-0" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Datos para cobrar las reservas con tarjeta en la web
                </h1>
                <p className="text-[18px] leading-relaxed m-0">
                    Mamá, son los datos de papá, que es el titular de los apartamentos, y son justo los que pide Stripe. Stripe, la empresa que cobra las tarjetas, los pide para abrir la cuenta y para saber dónde ingresar el dinero de las reservas. Yo los meto luego.
                </p>
                <div className="flex gap-3 items-start rounded-xl p-4 text-[16px] leading-relaxed" style={{ background: '#EEF1E6' }}>
                    <Lock size={20} color="#556B2F" className="shrink-0 mt-0.5" />
                    <span>Se cierran con candado en este mismo ordenador antes de enviarse: solo los puedo abrir yo. Se borran en cuanto los pase a Stripe, y si no, a los 7 días.</span>
                </div>
                {Object.keys(errores).length > 0 && (
                    <div className="rounded-xl p-4 text-[17px]" style={{ background: '#FBEAE7', color: '#9B2C1F' }}>Hay {Object.keys(errores).length} {Object.keys(errores).length === 1 ? 'dato' : 'datos'} por revisar. Están marcados en rojo.</div>
                )}
            </div>

            <fieldset className="grid md:grid-cols-2 gap-5 m-0 p-0 border-0">
                <legend className="text-[22px] font-semibold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>Papá</legend>
                <Campo label="Nombre" error={errores.nombre}><input className={inputCls} style={inputStyle} value={d.nombre} onChange={set('nombre')} autoComplete="off" /></Campo>
                <Campo label="Primer apellido" error={errores.apellido1}><input className={inputCls} style={inputStyle} value={d.apellido1} onChange={set('apellido1')} autoComplete="off" /></Campo>
                <Campo label="Segundo apellido" error={errores.apellido2}><input className={inputCls} style={inputStyle} value={d.apellido2} onChange={set('apellido2')} autoComplete="off" /></Campo>
                <Campo label="DNI (opcional)" ayuda="Solo por si Stripe lo pide luego. Con la letra, por ejemplo 12345678Z" error={errores.dni}><input className={inputCls} style={inputStyle} value={d.dni} onChange={set('dni')} autoComplete="off" /></Campo>
                <Campo label="Fecha de nacimiento" error={errores.nacimiento}><input type="date" className={inputCls} style={inputStyle} value={d.nacimiento} onChange={set('nacimiento')} /></Campo>
                <Campo label="Nacionalidad" error={errores.nacionalidad}><input className={inputCls} style={inputStyle} value={d.nacionalidad} onChange={set('nacionalidad')} autoComplete="off" /></Campo>
                <Campo label="Móvil" ayuda="Stripe puede mandarle un código por SMS" error={errores.movil}><input type="tel" className={inputCls} style={inputStyle} value={d.movil} onChange={set('movil')} autoComplete="off" /></Campo>
                <Campo label="Correo electrónico" ayuda="El que miréis, para los avisos de Stripe" error={errores.correo} ancho><input type="email" className={inputCls} style={inputStyle} value={d.correo} onChange={set('correo')} autoComplete="off" /></Campo>
            </fieldset>

            <fieldset className="grid md:grid-cols-2 gap-5 m-0 p-0 border-0">
                <legend className="text-[22px] font-semibold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>Domicilio de papá</legend>
                <Campo label="Calle y número" error={errores.calle} ancho><input className={inputCls} style={inputStyle} value={d.calle} onChange={set('calle')} autoComplete="off" /></Campo>
                <Campo label="Piso o puerta" ayuda="Si no tiene, déjalo vacío" error={errores.piso}><input className={inputCls} style={inputStyle} value={d.piso} onChange={set('piso')} autoComplete="off" /></Campo>
                <Campo label="Código postal" error={errores.cp}><input inputMode="numeric" className={inputCls} style={inputStyle} value={d.cp} onChange={set('cp')} autoComplete="off" /></Campo>
                <Campo label="Localidad" error={errores.localidad}><input className={inputCls} style={inputStyle} value={d.localidad} onChange={set('localidad')} autoComplete="off" /></Campo>
                <Campo label="Provincia" error={errores.provincia}><input className={inputCls} style={inputStyle} value={d.provincia} onChange={set('provincia')} autoComplete="off" /></Campo>
                <Campo label="País" error={errores.pais}><input className={inputCls} style={inputStyle} value={d.pais} onChange={set('pais')} autoComplete="off" /></Campo>
            </fieldset>

            <fieldset className="grid md:grid-cols-2 gap-5 m-0 p-0 border-0">
                <legend className="text-[22px] font-semibold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>Cuenta del banco donde entra el dinero</legend>
                <Campo label="Número de cuenta (IBAN)" ayuda="Empieza por ES, 24 caracteres. Está en la libreta o en la app del banco." error={errores.iban} ancho>
                    <input className={`${inputCls} tracking-wider`} style={inputStyle} value={d.iban} onChange={set('iban')} autoComplete="off" placeholder="ES00 0000 0000 0000 0000 0000" />
                </Campo>
                <Campo label="A nombre de quién está la cuenta" ayuda="Tal como sale en el banco" error={errores.titularCuenta} ancho><input className={inputCls} style={inputStyle} value={d.titularCuenta} onChange={set('titularCuenta')} autoComplete="off" /></Campo>
                <Campo label="¿Algo que deba saber?" ayuda="Opcional" ancho>
                    <textarea rows={3} className={inputCls} style={inputStyle} value={d.notas} onChange={set('notas')} />
                </Campo>
            </fieldset>

            {estado === 'error' && (
                <div className="rounded-xl p-4 text-[17px]" style={{ background: '#FBEAE7', color: '#9B2C1F' }}>No se ha podido enviar. Vuelve a pulsar el botón; si sigue sin ir, llámame.</div>
            )}

            <button type="submit" disabled={estado === 'enviando'}
                className="self-start rounded-full px-9 py-4 text-[19px] font-bold text-white border-0 disabled:opacity-60" style={{ background: '#556B2F' }}>
                {estado === 'enviando' ? 'Enviando…' : 'Enviármelo'}
            </button>
        </form>
    );
};

export default DatosTitular;
