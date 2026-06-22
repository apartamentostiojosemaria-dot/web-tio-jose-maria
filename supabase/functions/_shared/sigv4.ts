// SigV4 helpers minimalistas: HMAC-SHA256 y SHA256 sobre strings,
// devolviendo bytes o hex. Web Crypto API (disponible en Deno).

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

export async function sha256Hex(data: string): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
    return toHex(hash);
}

export async function hmac(key: ArrayBuffer | string, data: string, output: "bytes" | "hex" = "bytes"): Promise<ArrayBuffer | string> {
    const keyBytes = typeof key === "string" ? encoder.encode(key) : new Uint8Array(key);
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBytes as BufferSource,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
    return output === "hex" ? toHex(sig) : sig;
}
