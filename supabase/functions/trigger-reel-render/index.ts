// Edge function: trigger-reel-render
//
// Disparada por trigger Postgres cuando se inserta una review con rating=5.
// Llama a la GitHub REST API (workflow_dispatch) para renderizar el reel
// con los datos de la review. El workflow sube el MP4 a Storage y notifica
// al admin por email.
//
// Variables de entorno requeridas (Supabase Edge Function Secrets):
//   - GITHUB_TOKEN: PAT con scope `repo` (o fine-grained con permiso
//     "Actions: read/write" sobre el repo)
//   - GITHUB_REPO: "owner/repo" (ej: "apartamentostiojosemaria-dot/web-tio-jose-maria")
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-inyectados)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')!;
const GITHUB_REPO = Deno.env.get('GITHUB_REPO')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    try {
        const body = await req.json();

        // Payload puede venir directamente con review_id (manual) o como
        // payload de Database Webhook { type, table, record, old_record }
        const review_id = body.review_id || body.record?.id;
        if (!review_id) {
            return new Response(JSON.stringify({ error: 'review_id required' }), {
                status: 400,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        // Trae la review + apartamento asociado
        const { data: review, error: rErr } = await supabase
            .from('reviews')
            .select('id, rating, author_name, comment, apartment_id, apartments(name, slug, images)')
            .eq('id', review_id)
            .single();

        if (rErr || !review) {
            return new Response(JSON.stringify({ error: 'review not found', detail: rErr?.message }), {
                status: 404,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        if (review.rating < 5) {
            return new Response(JSON.stringify({ skipped: 'rating < 5' }), {
                status: 200,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        const apt = review.apartments as unknown as {
            name: string;
            slug: string;
            images: string[];
        } | null;

        const apartmentName = apt?.name || 'Tío José María';
        const apartmentImage = apt?.images?.[0] || '';

        // Trunca el comentario si es muy largo (no cabe en 12s de reel)
        const MAX_COMMENT = 180;
        const comment =
            (review.comment || '').length > MAX_COMMENT
                ? (review.comment || '').slice(0, MAX_COMMENT - 1) + '…'
                : review.comment || '';

        // Lanza workflow_dispatch
        const ghRes = await fetch(
            `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/render-review-reel.yml/dispatches`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: {
                        review_id: String(review.id),
                        rating: String(review.rating),
                        author: review.author_name || 'Huésped',
                        comment,
                        apartmentName,
                        apartmentImage,
                    },
                }),
            }
        );

        if (!ghRes.ok) {
            const txt = await ghRes.text();
            return new Response(
                JSON.stringify({ error: 'github dispatch failed', status: ghRes.status, detail: txt }),
                { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(JSON.stringify({ ok: true, review_id }), {
            status: 200,
            headers: { ...cors, 'Content-Type': 'application/json' },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { ...cors, 'Content-Type': 'application/json' },
        });
    }
});
