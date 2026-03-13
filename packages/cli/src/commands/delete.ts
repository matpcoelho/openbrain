/**
 * Delete a memory by ID.
 */

import { loadConfig } from "../config.js";

export async function deleteMemory(id: string): Promise<void> {
  const config = loadConfig();

  const resp = await fetch(
    `${config.supabaseUrl}/rest/v1/memories?id=eq.${id}`,
    {
      method: "DELETE",
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!resp.ok) {
    const error = await resp.text();
    console.error(`Failed to delete memory: ${error}`);
    process.exit(1);
  }

  console.log(`Deleted memory: ${id}`);
}
