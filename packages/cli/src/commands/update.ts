/**
 * Update a memory by ID.
 */

import { loadConfig } from "../config.js";
import { createProvider } from "../embeddings.js";

export async function update(
  id: string,
  options: { content?: string; category?: string; tags?: string; summary?: string }
): Promise<void> {
  const config = loadConfig();

  const record: Record<string, unknown> = {};

  if (options.content) {
    record.content = options.content;
    const embedder = createProvider(config.embeddingProvider, config as unknown as Record<string, string>);
    record.embedding = await embedder.embed(options.content);
  }
  if (options.category) record.category = options.category;
  if (options.tags) {
    record.tags = options.tags.split(",").map((t) => t.trim()).filter(Boolean);
  }
  if (options.summary) record.summary = options.summary;

  if (Object.keys(record).length === 0) {
    console.error("Nothing to update. Provide at least one of: --content, --category, --tags, --summary");
    process.exit(1);
  }

  const resp = await fetch(
    `${config.supabaseUrl}/rest/v1/memories?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(record),
    }
  );

  if (!resp.ok) {
    const error = await resp.text();
    console.error(`Failed to update memory: ${error}`);
    process.exit(1);
  }

  console.log(`Updated memory: ${id}`);
}
