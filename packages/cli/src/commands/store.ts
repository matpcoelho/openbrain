/**
 * Store a memory in OpenBrain.
 */

import { loadConfig } from "../config.js";
import { createProvider } from "../embeddings.js";

export async function store(
  content: string,
  options: { category?: string; tags?: string; source?: string; summary?: string }
): Promise<void> {
  const config = loadConfig();
  const embedder = createProvider(config.embeddingProvider, config as unknown as Record<string, string>);

  const tags = options.tags
    ? options.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const embedding = await embedder.embed(content);

  const record = {
    content,
    source: options.source || "cli",
    category: options.category || "insight",
    tags,
    embedding,
    summary: options.summary || null,
    metadata: {},
  };

  const resp = await fetch(`${config.supabaseUrl}/rest/v1/memories`, {
    method: "POST",
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(record),
  });

  if (!resp.ok) {
    const error = await resp.text();
    console.error(`Failed to store memory: ${error}`);
    process.exit(1);
  }

  const data = await resp.json();
  const id = Array.isArray(data) ? data[0]?.id : data.id;
  console.log(`Stored. ID: ${id}`);
}
