import React from 'react';
import { Check, PenLine, ShieldQuestion, Baby } from 'lucide-react';
import { Boton, Chip } from '../ui';
import { edadEn, nombreCompleto, nombreDocumento, EDAD_FIRMA, EDAD_DOCUMENTO } from './datos';

// ============================================================
// Persona — una tarjeta por cada uno de los que se alojan
// ============================================================
// Lo único que ella tiene que hacer con esta tarjeta: leer el nombre y el
// número, mirarlos en el documento que tiene delante, y tocar «Coincide».
// Eso es todo lo que el art. 4.3 del RD 933/2021 le pide al alojamiento:
// que los datos coincidan con el documento que el huésped EXHIBE.
//
// Lo que NUNCA hay aquí: un botón de hacer foto, de subir un documento ni un
// hueco para teclear el número de otro. Guardar copias del DNI está
// prohibido y sancionado (AEPD, junio de 2025).
// ============================================================

const Persona = ({ persona: p, fechaEntrada, comprobado, onCoincide, onNoCoincide, ocupado }) => {
    const edad = edadEn(p.fecha_nacimiento, fechaEntrada);
    const menorDe14 = edad !== null && edad < EDAD_FIRMA;
    const menorDeEdad = edad !== null && edad < EDAD_DOCUMENTO;
    const tieneFirma = !!p.firma_base64;
    const nombre = nombreCompleto(p) || 'Sin nombre';

    return (
        <div className={`bg-white rounded-3xl border p-5 shadow-sm ${
            comprobado ? 'border-rural-300 bg-rural-50/40' : 'border-gray-200'
        }`}>
            <div className="flex items-start gap-3">
                <span
                    className={`mt-1 shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                        comprobado ? 'bg-rural-600 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                    aria-hidden="true"
                >
                    {comprobado ? <Check size={20} /> : menorDe14 ? <Baby size={18} /> : <ShieldQuestion size={18} />}
                </span>

                <div className="min-w-0 flex-1">
                    <p className="font-bold text-lg text-text-primary leading-snug break-words">
                        {nombre}
                    </p>

                    {/* Lo que hay que comparar con el documento, en grande */}
                    {p.numero_documento ? (
                        <p className="mt-1 text-lg font-mono font-bold tracking-wide text-text-primary break-all">
                            {nombreDocumento(p.tipo_documento)} {p.numero_documento}
                        </p>
                    ) : (
                        <p className="mt-1 text-base text-gray-600">
                            {menorDeEdad ? 'Menor de edad: no hace falta documento propio' : 'Sin documento'}
                        </p>
                    )}
                    {p.soporte_documento && (
                        <p className="text-sm text-gray-600 font-mono">
                            Soporte {p.soporte_documento}
                        </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-2">
                        {p.is_titular && <Chip tono="azul">Quien reserva</Chip>}
                        {edad !== null && <Chip tono="neutro">{edad} años</Chip>}
                        {menorDe14 ? (
                            <Chip tono="neutro" icono={Baby}>No firma, es pequeño</Chip>
                        ) : tieneFirma ? (
                            <Chip tono="verde" icono={PenLine}>Ya ha firmado</Chip>
                        ) : (
                            <Chip tono="ambar" icono={PenLine}>Le falta firmar</Chip>
                        )}
                        {p.parentesco && <Chip tono="neutro">Va con un menor a su cargo</Chip>}
                    </div>
                </div>
            </div>

            <div className="mt-4">
                {comprobado ? (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-base font-bold text-rural-700 flex items-center gap-1.5">
                            <Check size={18} aria-hidden="true" /> Comprobado
                        </p>
                        <button
                            type="button"
                            onClick={() => onNoCoincide(p)}
                            className="min-h-[44px] px-3 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30"
                        >
                            Me he equivocado
                        </button>
                    </div>
                ) : (
                    <Boton
                        icono={Check}
                        onClick={() => onCoincide(p)}
                        cargando={ocupado}
                        ancho
                        tamano="grande"
                    >
                        Coincide
                    </Boton>
                )}
            </div>
        </div>
    );
};

export default Persona;
