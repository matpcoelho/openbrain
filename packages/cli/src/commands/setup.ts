/**
 * Interactive setup wizard for OpenBrain.
 * Prompts for Supabase credentials, embedding provider, and API keys.
 * Tests the connection before saving.
 */

import * as readline from "readline";
import { saveConfig, getConfigPath, configExists, type OpenBrainConfig } from "../config.js";

function ask(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

async function testConnection(url: string, key: string): Promise<boolean> {
  try {
    const resp = await fetch(`${url}/rest/v1/memories?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function testEmbedding(provider: string, apiKey: string): Promise<boolean> {
  try {
    if (provider === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: "test" }] },
          outputDimensionality: 1536,
        }),
      });
      const data = await resp.json();
      return !data.error;
    } else if (provider === "openai") {
      const resp = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: "test",
          dimensions: 1536,
        }),
      });
      const data = await resp.json();
      return !data.error;
    }
    return false;
  } catch {
    return false;
  }
}

export async function setup(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\nOpenBrain Setup");
  console.log("===============\n");

  if (configExists()) {
    const overwrite = await ask(rl, "Config already exists. Overwrite? (y/N)", "n");
    if (overwrite.toLowerCase() !== "y") {
      console.log("Setup cancelled.");
      rl.close();
      return;
    }
  }

  console.log("You'll need:\n  1. A Supabase project URL and service role key\n  2. An embedding API key (Gemini is free)\n");

  const supabaseUrl = await ask(rl, "Supabase project URL (https://xxx.supabase.co)");
  const supabaseKey = await ask(rl, "Supabase service role key");

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase URL and key are required.");
    rl.close();
    process.exit(1);
  }

  console.log("\nTesting Supabase connection...");
  const dbOk = await testConnection(supabaseUrl, supabaseKey);
  if (!dbOk) {
    console.error("Could not connect to Supabase. Check your URL and key.");
    console.error("Make sure you've run the migration SQL first.");
    rl.close();
    process.exit(1);
  }
  console.log("Connected to Supabase.\n");

  const provider = await ask(rl, "Embedding provider (gemini/openai)", "gemini");
  if (provider !== "gemini" && provider !== "openai") {
    console.error("Invalid provider. Use 'gemini' or 'openai'.");
    rl.close();
    process.exit(1);
  }

  let geminiApiKey = "";
  let openaiApiKey = "";

  if (provider === "gemini") {
    geminiApiKey = await ask(rl, "Gemini API key (free at aistudio.google.com)");
  } else {
    openaiApiKey = await ask(rl, "OpenAI API key");
  }

  const embeddingKey = provider === "gemini" ? geminiApiKey : openaiApiKey;
  console.log("\nTesting embedding API...");
  const embedOk = await testEmbedding(provider, embeddingKey);
  if (!embedOk) {
    console.error("Embedding API test failed. Check your API key.");
    rl.close();
    process.exit(1);
  }
  console.log("Embedding API working.\n");

  const config: OpenBrainConfig = {
    supabaseUrl,
    supabaseKey,
    embeddingProvider: provider as "gemini" | "openai",
    geminiApiKey,
    openaiApiKey,
  };

  saveConfig(config);
  console.log(`Config saved to ${getConfigPath()}`);
  console.log("\nOpenBrain is ready. Try: openbrain store \"My first memory\"");

  rl.close();
}
