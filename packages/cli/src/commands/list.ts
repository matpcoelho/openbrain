/**
 * List recent memories from OpenBrain.
 */

import { loadConfig } from "../config.js";

export async function list(options: {
  limit?: string;
  source?: string;
}): Promise<void> {
  const config = loadConfig();
  const limit = options.limit ? parseInt(options.limit) : 20;

  let path = `memories?order=created_at.desc&limit=${limit}&select=id,content,summary,source,category,tags,created_at`;
  if (options.source) path += `&source=eq.${options.source}`;

  const resp = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const error = await resp.text();
    console.error(`Failed to list memories: ${error}`);
    process.exit(1);
  }

  const results = await resp.json();

  if (!results.length) {
    console.log("No memories found.");
    return;
  }

  for (const r of results) {
    const date = r.created_at?.slice(0, 10) || "?";
    const summary = r.summary || r.content?.slice(0, 80);
    console.log(`[${date}] [${r.source}/${r.category}] ${summary}`);
  }
}
