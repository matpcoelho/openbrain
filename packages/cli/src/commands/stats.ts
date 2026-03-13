/**
 * Show brain statistics using server-side aggregation.
 */

import { loadConfig } from "../config.js";

interface StatsResult {
  total: number;
  by_source: Record<string, number>;
  by_category: Record<string, number>;
}

export async function stats(): Promise<void> {
  const config = loadConfig();

  const resp = await fetch(
    `${config.supabaseUrl}/rest/v1/rpc/brain_stats`,
    {
      method: "POST",
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  if (!resp.ok) {
    const error = await resp.text();
    console.error(`Failed to get stats: ${error}`);
    process.exit(1);
  }

  const result: StatsResult = await resp.json();

  console.log(`Total memories: ${result.total}\n`);

  console.log("By source:");
  for (const [s, c] of Object.entries(result.by_source).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${c}`);
  }

  console.log("\nBy category:");
  for (const [s, c] of Object.entries(result.by_category).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${c}`);
  }
}
