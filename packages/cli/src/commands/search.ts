/**
 * Search memories in OpenBrain by semantic similarity.
 */

import { loadConfig } from "../config.js";
import { createProvider } from "../embeddings.js";

export async function search(
  query: string,
  options: { limit?: string; source?: string; category?: string; threshold?: string }
): Promise<void> {
  const config = loadConfig();
  const embedder = createProvider(config.embeddingProvider, config as unknown as Record<string, string>);

  const embedding = await embedder.embed(query);

  const params: Record<string, unknown> = {
    query_embedding: embedding,
    match_threshold: options.threshold ? parseFloat(options.threshold) : 0.5,
    match_count: options.limit ? parseInt(options.limit) : 5,
  };
  if (options.source) params.filter_source = options.source;
  if (options.category) params.filter_category = options.category;

  const resp = await fetch(`${config.supabaseUrl}/rest/v1/rpc/match_memories`, {
    method: "POST",
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    const error = await resp.text();
    console.error(`Search failed: ${error}`);
    process.exit(1);
  }

  const results = await resp.json();

  if (!results.length) {
    console.log("No matching memories found.");
    return;
  }

  for (const r of results) {
    const sim = ((r.similarity || 0) * 100).toFixed(1);
    const date = r.created_at?.slice(0, 10) || "?";
    const tags = r.tags?.join(", ") || "";
    console.log(`\n[${sim}%] [${date}] [${r.source}/${r.category}] ${tags}`);
    const content = r.content.length > 200 ? r.content.slice(0, 200) + "..." : r.content;
    console.log(`  ${content}`);
  }
}
