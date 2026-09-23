// ============================================================
// clienteClave — quién es el mismo cliente, en un solo sitio
// ============================================================
// La lista de Clientes y la ficha de una reserva tienen que llegar al MISMO
// cliente. Si cada una calculara la clave a su manera, el botón «Ver su
// ficha de cliente» de la reserva abriría a otro o a nadie.
//
// La clave es el correo; si la reserva no trae correo que sirva, el
// teléfono (los 9 últimos dígitos); y si tampoco, el nombre.
//
// Dos clases de correo de relleno (los ponen los importadores cuando el
// portal no da uno, o se apunta a mano sin correo):
//   - `sin-correo@example.invalid` es el MISMO para todos: como clave juntaría
//     a desconocidos en un solo cliente (pasó con Emilia y Javier, 23-sep).
//   - `sin-email+<sello>@tiojosemaria.local` es uno por persona: sirve de
//     clave (su ficha de `customers` guarda el teléfono), pero no es un
//     correo al que escribir, así que no se enseña.
// ============================================================

const RELLENO_COMPARTIDO = '@example.invalid';
const RELLENO_PROPIO = '@tiojosemaria.local';

export const sinAcentos = (t) =>
    String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const soloDigitos = (t) => String(t || '').replace(/\D/g, '');

/** Los 9 últimos dígitos: así "+34 676 34 46 75", "0034676344675" y "676344675" son el mismo. */
export const claveTelefono = (t) => {
    const d = soloDigitos(t);
    return d.length > 9 ? d.slice(-9) : d;
};

const minusculas = (e) => String(e || '').trim().toLowerCase();

/** El correo al que se puede escribir, o '' si no hay o es de relleno. */
export const correoReal = (e) => {
    const x = minusculas(e);
    if (!x || x.endsWith(RELLENO_COMPARTIDO) || x.endsWith(RELLENO_PROPIO)) return '';
    return x;
};

/** El correo que sirve para reconocer a la persona ('' si no hay o es el compartido). */
export const correoClave = (e) => {
    const x = minusculas(e);
    if (!x || x.endsWith(RELLENO_COMPARTIDO)) return '';
    return x;
};

/** La clave del cliente de una reserva (`guest_email`, `guest_phone`, `guest_name`). */
export const claveDeCliente = (r) => {
    const email = correoClave(r?.guest_email);
    if (email) return email;
    const tel = claveTelefono(r?.guest_phone);
    if (tel) return `tel:${tel}`;
    return `nombre:${sinAcentos(r?.guest_name)}`;
};
