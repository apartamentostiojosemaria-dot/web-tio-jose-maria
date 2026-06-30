import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { urls, bucket, folder } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results: any[] = [];

    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) { results.push({ url, error: `HTTP ${res.status}` }); continue; }
        const blob = await res.blob();
        const filename = url.split('/').pop()!.split('?')[0];
        const path = folder ? `${folder}/${filename}` : filename;
        const contentType = res.headers.get('content-type') || 'image/jpeg';

        const { error } = await supabase.storage.from(bucket).upload(path, blob, {
          contentType,
          upsert: true,
        });

        if (error) {
          results.push({ url, path, error: error.message });
        } else {
          const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
          results.push({ url, path, publicUrl, ok: true });
        }
      } catch (e: any) {
        results.push({ url, error: e.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
