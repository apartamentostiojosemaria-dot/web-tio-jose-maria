// ZIP mínimo (una sola entrada, método deflate)
// =============================================
// El servicio del Ministerio exige que el XML del parte viaje «comprimido
// (zip) y codificado en Base64» — y es un ZIP de verdad, no un gzip ni un
// deflate suelto: si no lo es, contesta el error 10111.
//
// Se escribe aquí a mano, con el `CompressionStream('deflate-raw')` que ya
// trae el runtime, para no depender de ninguna librería de fuera: una edge
// function que se cae porque un CDN no responde es una función que no sirve.

/** Tabla CRC-32 (polinomio 0xEDB88320), la que usa el formato ZIP. */
const TABLA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[i] = c >>> 0;
    }
    return t;
})();

export function crc32(datos: Uint8Array): number {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < datos.length; i++) {
        c = TABLA_CRC[(c ^ datos[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
}

async function desinflar(datos: Uint8Array): Promise<Uint8Array> {
    const cs = new CompressionStream("deflate-raw");
    const escritor = cs.writable.getWriter();
    escritor.write(datos);
    escritor.close();
    const trozos: Uint8Array[] = [];
    const lector = cs.readable.getReader();
    for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        if (value) trozos.push(value);
    }
    const total = trozos.reduce((n, t) => n + t.length, 0);
    const salida = new Uint8Array(total);
    let off = 0;
    for (const t of trozos) { salida.set(t, off); off += t.length; }
    return salida;
}

/** Fecha y hora en el formato MS-DOS que guarda el ZIP. */
function fechaDos(d: Date): { hora: number; fecha: number } {
    const hora = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
    const fecha = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { hora, fecha };
}

/**
 * Mete un único fichero en un ZIP.
 * @param nombre   nombre de la entrada dentro del zip (ASCII, sin rutas)
 * @param contenido bytes del fichero
 */
export async function zipDeUnFichero(nombre: string, contenido: Uint8Array): Promise<Uint8Array> {
    const nombreBytes = new TextEncoder().encode(nombre);
    const comprimido = await desinflar(contenido);
    const crc = crc32(contenido);
    const { hora, fecha } = fechaDos(new Date());

    const cabeceraLocal = new Uint8Array(30 + nombreBytes.length);
    const vL = new DataView(cabeceraLocal.buffer);
    vL.setUint32(0, 0x04034b50, true);      // firma de cabecera local
    vL.setUint16(4, 20, true);              // versión necesaria (2.0)
    vL.setUint16(6, 0x0800, true);          // bandera: nombre en UTF-8
    vL.setUint16(8, 8, true);               // método: deflate
    vL.setUint16(10, hora, true);
    vL.setUint16(12, fecha, true);
    vL.setUint32(14, crc, true);
    vL.setUint32(18, comprimido.length, true);
    vL.setUint32(22, contenido.length, true);
    vL.setUint16(26, nombreBytes.length, true);
    vL.setUint16(28, 0, true);              // sin campo extra
    cabeceraLocal.set(nombreBytes, 30);

    const central = new Uint8Array(46 + nombreBytes.length);
    const vC = new DataView(central.buffer);
    vC.setUint32(0, 0x02014b50, true);      // firma de directorio central
    vC.setUint16(4, 20, true);              // versión con la que se creó
    vC.setUint16(6, 20, true);              // versión necesaria
    vC.setUint16(8, 0x0800, true);
    vC.setUint16(10, 8, true);
    vC.setUint16(12, hora, true);
    vC.setUint16(14, fecha, true);
    vC.setUint32(16, crc, true);
    vC.setUint32(20, comprimido.length, true);
    vC.setUint32(24, contenido.length, true);
    vC.setUint16(28, nombreBytes.length, true);
    vC.setUint16(30, 0, true);              // extra
    vC.setUint16(32, 0, true);              // comentario
    vC.setUint16(34, 0, true);              // disco
    vC.setUint16(36, 0, true);              // atributos internos
    vC.setUint32(38, 0, true);              // atributos externos
    vC.setUint32(42, 0, true);              // desplazamiento de la cabecera local
    central.set(nombreBytes, 46);

    const desplazamientoCentral = cabeceraLocal.length + comprimido.length;

    const fin = new Uint8Array(22);
    const vF = new DataView(fin.buffer);
    vF.setUint32(0, 0x06054b50, true);      // firma de fin de directorio
    vF.setUint16(4, 0, true);
    vF.setUint16(6, 0, true);
    vF.setUint16(8, 1, true);               // entradas en este disco
    vF.setUint16(10, 1, true);              // entradas totales
    vF.setUint32(12, central.length, true);
    vF.setUint32(16, desplazamientoCentral, true);
    vF.setUint16(20, 0, true);              // sin comentario

    const total = cabeceraLocal.length + comprimido.length + central.length + fin.length;
    const salida = new Uint8Array(total);
    let off = 0;
    salida.set(cabeceraLocal, off); off += cabeceraLocal.length;
    salida.set(comprimido, off); off += comprimido.length;
    salida.set(central, off); off += central.length;
    salida.set(fin, off);
    return salida;
}

/** Bytes → Base64, sin reventar la pila con ficheros grandes. */
export function aBase64(bytes: Uint8Array): string {
    let binario = "";
    const trozo = 0x8000;
    for (let i = 0; i < bytes.length; i += trozo) {
        binario += String.fromCharCode(...bytes.subarray(i, i + trozo));
    }
    return btoa(binario);
}
