/**
 * Show brain statistics.
 */

import { loadConfig } from "../config.js";

export async function stats(): Promise<void> {
  const config = loadConfig();

  const resp = await fetch(
    `${config.supabaseUrl}/rest/v1/memories?select=source,category`,
    {
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!resp.ok) {
    const error = await resp.text();
    console.error(`Failed to get stats: ${error}`);
    process.exit(1);
  }

  const all = await resp.json();
  const sources: Record<string, number> = {};
  const categories: Record<string, number> = {};

  for (const m of all) {
    sources[m.source] = (sources[m.source] || 0) + 1;
    categories[m.category] = (categories[m.category] || 0) + 1;
  }

  console.log(`Total memories: ${all.length}\n`);

  console.log("By source:");
  for (const [s, c] of Object.entries(sources).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${c}`);
  }

  console.log("\nBy category:");
  for (const [s, c] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${c}`);
  }
}
