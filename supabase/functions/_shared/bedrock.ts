// AWS Bedrock client minimalista para Deno (Supabase Edge Functions).
// Firma SigV4 manual — no usamos el SDK de AWS porque añade ~2 MB y aquí solo
// necesitamos Invoke{Model} y los embeddings de Titan.
//
// Región forzada eu-central-1 (Frankfurt) — Schrems II limpio.
// Modelos: Claude (chat) + Amazon Titan Text Embeddings v2 (embeddings 1024 dim).

import { hmac, sha256Hex } from "./sigv4.ts";

const REGION = "eu-central-1";
const SERVICE = "bedrock";

interface InvokeOpts {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    modelId: string;
    body: unknown;
}

async function invoke({ accessKeyId, secretAccessKey, sessionToken, modelId, body }: InvokeOpts): Promise<Response> {
    const host = `bedrock-runtime.${REGION}.amazonaws.com`;
    const path = `/model/${encodeURIComponent(modelId)}/invoke`;
    const url = `https://${host}${path}`;
    const payload = JSON.stringify(body);

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    const payloadHash = await sha256Hex(payload);

    const headers: Record<string, string> = {
        "host": host,
        "content-type": "application/json",
        "accept": "application/json",
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
    };
    if (sessionToken) headers["x-amz-security-token"] = sessionToken;

    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames.map(h => `${h}:${headers[h]}\n`).join("");
    const signedHeaders = signedHeaderNames.join(";");

    const canonicalRequest = [
        "POST",
        path,
        "",
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join("\n");

    const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
    const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        await sha256Hex(canonicalRequest),
    ].join("\n");

    const kDate = await hmac(`AWS4${secretAccessKey}`, dateStamp);
    const kRegion = await hmac(kDate, REGION);
    const kService = await hmac(kRegion, SERVICE);
    const kSigning = await hmac(kService, "aws4_request");
    const signature = await hmac(kSigning, stringToSign, "hex");

    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return fetch(url, {
        method: "POST",
        headers: { ...headers, Authorization: authHeader },
        body: payload,
    });
}

export interface EmbedResult {
    embedding: number[];
    inputTokenCount: number;
}

export async function embedText(text: string, creds: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }): Promise<EmbedResult> {
    const res = await invoke({
        ...creds,
        modelId: "amazon.titan-embed-text-v2:0",
        body: { inputText: text, dimensions: 1024, normalize: true },
    });
    if (!res.ok) throw new Error(`Bedrock embed failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as { embedding: number[]; inputTextTokenCount: number };
    return { embedding: data.embedding, inputTokenCount: data.inputTextTokenCount };
}

export interface ChatTurn {
    role: "user" | "assistant";
    content: string;
}

export interface ChatResult {
    text: string;
    tokensIn: number;
    tokensOut: number;
    stopReason: string;
}

export async function chat(opts: {
    creds: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
    modelId?: string;
    system: string;
    messages: ChatTurn[];
    maxTokens?: number;
    temperature?: number;
}): Promise<ChatResult> {
    const modelId = opts.modelId || "eu.anthropic.claude-sonnet-4-5-20250929-v1:0";
    const res = await invoke({
        ...opts.creds,
        modelId,
        body: {
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: opts.maxTokens ?? 512,
            temperature: opts.temperature ?? 0.4,
            system: opts.system,
            messages: opts.messages.map(m => ({
                role: m.role,
                content: [{ type: "text", text: m.content }],
            })),
        },
    });
    if (!res.ok) throw new Error(`Bedrock chat failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as {
        content: Array<{ type: string; text: string }>;
        stop_reason: string;
        usage: { input_tokens: number; output_tokens: number };
    };
    const text = data.content.filter(c => c.type === "text").map(c => c.text).join("");
    return {
        text,
        tokensIn: data.usage.input_tokens,
        tokensOut: data.usage.output_tokens,
        stopReason: data.stop_reason,
    };
}
