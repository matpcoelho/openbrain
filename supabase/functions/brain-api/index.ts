// OpenBrain REST API - Supabase Edge Function
//
// Endpoints:
//   POST ?action=store    { content, source?, category?, tags?, summary? }
//   POST ?action=search   { query, limit?, source?, category?, threshold? }
//   GET  ?action=list     &limit=20&source=chatgpt
//   GET  ?action=stats
//
// Auth: Bearer token via BRAIN_API_SECRET env var.
// If BRAIN_API_SECRET is not set, auth is disabled (dev mode).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const API_SECRET = Deno.env.get("BRAIN_API_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// -- Valid categories (enforced) --

const VALID_CATEGORIES = [
  "company",
  "contact",
  "interaction",
  "decision",
  "insight",
  "task",
  "preference",
  "project",
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

const CATEGORY_MAP: Record<string, ValidCategory> = {
  person: "contact",
  conversation: "interaction",
  event: "interaction",
  general: "insight",
  company: "company",
  contact: "contact",
  interaction: "interaction",
  decision: "decision",
  insight: "insight",
  task: "task",
  preference: "preference",
  project: "project",
};

function normalizeCategory(raw: string): ValidCategory {
  const lower = (raw || "").toLowerCase().trim();
  return CATEGORY_MAP[lower] || "insight";
}

function normalizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 0)
    .filter((t) => !/^\d{4}-\d{2}-\d{2}$/.test(t));
}

async function getEmbedding(text: string): Promise<number[]> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: 1536,
      }),
    }
  );
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data.embedding.values;
}

function checkAuth(req: Request): boolean {
  if (!API_SECRET) return true;
  const auth = req.headers.get("Authorization");
  return auth === `Bearer ${API_SECRET}`;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (!checkAuth(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // STORE
    if (action === "store" && req.method === "POST") {
      const body = await req.json();
      const { content, source = "api" } = body;
      if (!content) {
        return Response.json(
          { error: "content required" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const category = normalizeCategory(body.category || "insight");
      const tags = normalizeTags(body.tags || []);
      const summary = body.summary || null;
      const embedding = await getEmbedding(content);

      const record = { content, source, category, tags, embedding, summary, metadata: {} };
      const { data, error } = await supabase
        .from("memories")
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return Response.json(
        { ok: true, id: data.id, normalized: { category, tags } },
        { headers: CORS_HEADERS }
      );
    }

    // SEARCH
    if (action === "search" && req.method === "POST") {
      const body = await req.json();
      const { query, limit = 5, source, category, threshold = 0.5 } = body;
      if (!query) {
        return Response.json(
          { error: "query required" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const embedding = await getEmbedding(query);
      const params: Record<string, unknown> = {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
      };
      if (source) params.filter_source = source;
      if (category) params.filter_category = category;

      const { data, error } = await supabase.rpc("match_memories", params);
      if (error) throw error;
      return Response.json(
        { ok: true, results: data },
        { headers: CORS_HEADERS }
      );
    }

    // LIST
    if (action === "list") {
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const source = url.searchParams.get("source");

      let q = supabase
        .from("memories")
        .select("id, content, summary, source, category, tags, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (source) q = q.eq("source", source);

      const { data, error } = await q;
      if (error) throw error;
      return Response.json(
        { ok: true, memories: data },
        { headers: CORS_HEADERS }
      );
    }

    // STATS
    if (action === "stats") {
      const { data, error } = await supabase
        .from("memories")
        .select("source, category");
      if (error) throw error;

      const sources: Record<string, number> = {};
      const categories: Record<string, number> = {};
      for (const m of data) {
        sources[m.source] = (sources[m.source] || 0) + 1;
        categories[m.category] = (categories[m.category] || 0) + 1;
      }
      return Response.json(
        { ok: true, total: data.length, by_source: sources, by_category: categories },
        { headers: CORS_HEADERS }
      );
    }

    return Response.json(
      { error: "Unknown action. Use: store, search, list, stats" },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
