import React, { useCallback, useState } from 'react';
import { Progreso } from './nueva-reserva/piezas';
import Paso1Cuando from './nueva-reserva/Paso1Cuando';
import Paso2Quien from './nueva-reserva/Paso2Quien';
import Paso3Cobro from './nueva-reserva/Paso3Cobro';
import Guardada from './nueva-reserva/Guardada';
import { hoyISO } from './ui';
import {
    crearReserva, apuntarCobro, mandarConfirmacion, pedirEnlaceDePago, masUnDia,
} from './nueva-reserva/datos';
import { explicarError } from './nueva-reserva/textos';

// ============================================================
// NuevaReservaPanel — Apuntar reserva
// ============================================================
// Esto es lo que más va a usar la madre de Jesús: hoy lo hace en
// MisterPlan cuando la llaman o le escriben por WhatsApp.
//
// Tres pasos, uno por pantalla, con "Paso N de 3" arriba y el botón de
// atrás siempre a mano:
//   1. Cuándo y dónde  → fechas, cuántos son, qué está libre y a cuánto
//   2. Quién viene     → nombre, teléfono, correo y por dónde le ha llegado
//   3. El dinero       → si ha pagado algo, cómo, y el resumen de todo
//
// Al guardar: se crea la reserva (create_manual_booking), se apunta el
// cobro si lo hay (register_payment) y se le manda el correo de
// confirmación (send-booking-email, plantilla 'confirmation'). El enlace
// para que rellene sus datos NO va ahí: va en el recordatorio de la víspera
// (plantilla 'reminder_24h'), porque la reserva solo se abre al huésped 7
// días antes de entrar (tjm_precheckin_reserva). Si el correo falla, la
// reserva NO se pierde: se guarda igual y se dice en pantalla.
//
// Props del armazón (PanelApp): ir, volver, perfil, params.
// `params` puede traer { fecha, apartamentoId } cuando se llega desde el
// calendario. Al terminar: ir('reserva', { reservaId }).
// ============================================================

const VALORES_INICIALES = {
    // paso 1
    entrada: '',
    salida: '',
    personas: 2,
    apartamentoId: null,
    apartamento: null,     // { id, nombre, plazas, total, porNoche } — lo pone el paso 1
    precio: null,          // null = el que calcula la base; un número = el que ella ha dicho
    // paso 2
    nombre: '',
    telefono: '',
    email: '',
    canal: '',
    localizador: '',
    comision: '',
    // paso 3
    yaPago: '',            // no | senal | todo
    senal: '',
    forma: '',
    fechaCobro: '',
    notas: '',
};

const NuevaReservaPanel = ({ ir, volver, params = {} }) => {
    const [paso, setPaso] = useState(1);
    const [valores, setValores] = useState(() => ({
        ...VALORES_INICIALES,
        fechaCobro: hoyISO(),
        entrada: params.fecha || '',
        salida: params.fecha ? masUnDia(params.fecha) : '',
        apartamentoId: params.apartamentoId ?? null,
    }));
    const [guardando, setGuardando] = useState(null);       // null | 'normal' | 'enlace'
    const [fallo, setFallo] = useState('');
    const [resultado, setResultado] = useState(null);       // pantalla de "ya está"

    // El apartamento elegido (con su nombre y sus plazas) lo deja el paso 1
    // dentro de `valores`; aquí solo se lee, no se vuelve a pedir a la base.
    const apartamento = valores.apartamento;

    const cambiar = useCallback((cambios) => {
        setValores((v) => ({ ...v, ...cambios }));
        setFallo('');
    }, []);

    const atras = () => {
        setFallo('');
        if (paso === 1) volver();
        else setPaso((p) => p - 1);
    };

    // ------------------------------------------------------------
    // Guardar de verdad
    // ------------------------------------------------------------
    const guardar = async ({ conEnlace }) => {
        setGuardando(conEnlace ? 'enlace' : 'normal');
        setFallo('');

        const total = Number(valores.precio) || 0;
        const cobrado =
            valores.yaPago === 'todo' ? total :
            valores.yaPago === 'senal' ? Math.min(Number(valores.senal) || 0, total) : 0;
        const correoLimpio = String(valores.email || '').trim().toLowerCase();

        // 1) La reserva
        const creada = await crearReserva({
            apartamentoId: valores.apartamentoId,
            entrada: valores.entrada,
            salida: valores.salida,
            personas: valores.personas,
            nombre: String(valores.nombre || '').trim(),
            email: correoLimpio,
            telefono: String(valores.telefono || '').trim(),
            canal: valores.canal,
            precio: total,
            localizador: String(valores.localizador || '').trim(),
            comision: Number(valores.comision) || 0,
            notas: String(valores.notas || '').trim(),
        });

        if (!creada?.ok) {
            setGuardando(null);
            setFallo(explicarError(creada?.error, {
                apartamento: apartamento?.nombre,
                plazas: apartamento?.plazas,
                personas: valores.personas,
            }));
            return;
        }

        // 2) El cobro, si lo hay. Si esto fallara, la reserva ya está guardada:
        //    se avisa, pero no se pierde nada.
        let cobradoDeVerdad = 0;
        if (cobrado > 0) {
            const apunte = await apuntarCobro({
                reservaId: creada.booking_id,
                importe: cobrado,
                forma: valores.forma,
                fecha: valores.fechaCobro || null,
                nota: 'Apuntado al crear la reserva',
            });
            if (apunte?.ok) cobradoDeVerdad = Number(apunte.paid_amount) || cobrado;
        }

        // 3) El correo de confirmación (el enlace de sus datos va en el de la víspera)
        let estadoCorreo = 'sin-correo';
        if (correoLimpio) {
            const enviado = await mandarConfirmacion(creada.booking_code);
            estadoCorreo = enviado.ok ? 'enviado' : 'fallo';
        }

        // 4) El enlace de pago, solo si lo ha pedido
        let enlace = null;
        const pendiente = Math.max(0, total - cobradoDeVerdad);
        if (conEnlace && pendiente > 0) {
            const pedido = await pedirEnlaceDePago({
                codigoReserva: creada.booking_code,
                reservaId: creada.booking_id,
                importe: pendiente,
            });
            enlace = pedido.ok ? { url: pedido.url } : { fallo: pedido.motivo || true };
        }

        setGuardando(null);
        setResultado({
            reservaId: creada.booking_id,
            codigo: creada.booking_code,
            nombre: String(valores.nombre || '').trim() || 'Sin nombre',
            apartamento: apartamento?.nombre || 'Apartamento',
            entrada: valores.entrada,
            salida: valores.salida,
            total,
            cobrado: cobradoDeVerdad,
            correo: estadoCorreo,
            enlace,
        });
    };

    // ------------------------------------------------------------
    // Pantalla
    // ------------------------------------------------------------
    if (resultado) {
        return (
            <Guardada
                resultado={resultado}
                alVerReserva={() => ir('reserva', { reservaId: resultado.reservaId })}
                alApuntarOtra={() => {
                    setResultado(null);
                    setPaso(1);
                    setValores({ ...VALORES_INICIALES, fechaCobro: hoyISO() });
                }}
            />
        );
    }

    return (
        <div>
            <Progreso paso={paso} onAtras={atras} />

            {paso === 1 && (
                <Paso1Cuando
                    valores={valores}
                    alCambiar={cambiar}
                    alSeguir={({ precio }) => { cambiar({ precio }); setPaso(2); }}
                />
            )}

            {paso === 2 && (
                <Paso2Quien
                    valores={valores}
                    alCambiar={cambiar}
                    alAtras={atras}
                    alSeguir={() => setPaso(3)}
                />
            )}

            {paso === 3 && (
                <Paso3Cobro
                    valores={valores}
                    apartamento={apartamento}
                    alCambiar={cambiar}
                    alAtras={atras}
                    alGuardar={guardar}
                    guardando={guardando}
                    fallo={fallo}
                />
            )}
        </div>
    );
};

export default NuevaReservaPanel;
