#!/usr/bin/env node
/**
 * OpenBrain MCP Server
 * Gives any MCP-compatible AI tool access to your shared memory brain.
 *
 * Tools: store_memory, search_memories, list_memories, delete_memory, brain_stats
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { SupabaseClient } from "./supabase.js";
import { createProvider, type EmbeddingProvider } from "./embeddings.js";

// --- Config ---

interface Config {
  supabaseUrl: string;
  supabaseKey: string;
  embeddingProvider: string;
  geminiApiKey: string;
  openaiApiKey: string;
}

function loadConfig(): Config {
  const configPath = resolve(homedir(), ".openbrain", "config.json");
  try {
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    // Fall back to environment variables
    return {
      supabaseUrl: process.env.OPENBRAIN_SUPABASE_URL || "",
      supabaseKey: process.env.OPENBRAIN_SUPABASE_KEY || "",
      embeddingProvider: process.env.OPENBRAIN_EMBEDDING_PROVIDER || "gemini",
      geminiApiKey: process.env.GEMINI_API_KEY || "",
      openaiApiKey: process.env.OPENAI_API_KEY || "",
    };
  }
}

const config = loadConfig();

if (!config.supabaseUrl || !config.supabaseKey) {
  console.error(
    "OpenBrain: Missing config. Run 'npx openbrain-ai setup' or set environment variables."
  );
  console.error("  Config file: ~/.openbrain/config.json");
  console.error("  Or env vars: OPENBRAIN_SUPABASE_URL, OPENBRAIN_SUPABASE_KEY");
  process.exit(1);
}

const db = new SupabaseClient(config.supabaseUrl, config.supabaseKey);
const embedder: EmbeddingProvider = createProvider(
  config.embeddingProvider || "gemini",
  config as unknown as Record<string, string>
);

// --- Valid categories ---
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

// --- Memory types ---
interface Memory {
  id: string;
  content: string;
  summary?: string;
  source: string;
  category: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  similarity?: number;
}

// --- Tool Implementations ---

async function storeMemory(args: {
  content: string;
  source?: string;
  category?: string;
  tags?: string[];
  summary?: string;
}): Promise<Memory[]> {
  const embedding = await embedder.embed(args.content);
  const record = {
    content: args.content,
    source: args.source || "mcp",
    category: args.category || "insight",
    tags: args.tags || [],
    embedding,
    summary: args.summary || null,
    metadata: {},
  };
  return db.request<Memory[]>("POST", "memories", record);
}

async function searchMemories(args: {
  query: string;
  limit?: number;
  source?: string;
  category?: string;
  threshold?: number;
}): Promise<Memory[]> {
  const embedding = await embedder.embed(args.query);
  const params: Record<string, unknown> = {
    query_embedding: embedding,
    match_threshold: args.threshold ?? 0.5,
    match_count: args.limit ?? 5,
  };
  if (args.source) params.filter_source = args.source;
  if (args.category) params.filter_category = args.category;
  return db.rpc<Memory[]>("match_memories", params);
}

async function listMemories(args: {
  limit?: number;
  source?: string;
}): Promise<Memory[]> {
  const limit = args.limit ?? 20;
  let path = `memories?order=created_at.desc&limit=${limit}&select=id,content,summary,source,category,tags,created_at`;
  if (args.source) path += `&source=eq.${args.source}`;
  return db.request<Memory[]>("GET", path);
}

async function deleteMemory(args: { id: string }): Promise<void> {
  await db.request("DELETE", `memories?id=eq.${args.id}`);
}

async function updateMemory(args: {
  id: string;
  content?: string;
  category?: string;
  tags?: string[];
  summary?: string;
}): Promise<Memory[]> {
  const record: Record<string, unknown> = {};

  if (args.content) {
    record.content = args.content;
    record.embedding = await embedder.embed(args.content);
  }
  if (args.category) record.category = args.category;
  if (args.tags) record.tags = args.tags;
  if (args.summary) record.summary = args.summary;

  return db.request<Memory[]>("PATCH", `memories?id=eq.${args.id}`, record);
}

async function getStats(): Promise<{
  total: number;
  by_source: Record<string, number>;
  by_category: Record<string, number>;
}> {
  return db.rpc<{
    total: number;
    by_source: Record<string, number>;
    by_category: Record<string, number>;
  }>("brain_stats", {});
}

// --- MCP Server ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"));

const server = new Server(
  { name: "openbrain", version: packageJson.version },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "store_memory",
      description:
        "Store a memory in the shared brain. Use this to save important information, decisions, preferences, or insights that should be accessible across all AI tools.",
      inputSchema: {
        type: "object" as const,
        properties: {
          content: {
            type: "string",
            description: "The memory content to store",
          },
          source: {
            type: "string",
            description:
              "Which AI tool is storing this (e.g. claude, chatgpt, cursor)",
            default: "mcp",
          },
          category: {
            type: "string",
            enum: [...VALID_CATEGORIES],
            description: "Category of memory",
            default: "insight",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags for filtering",
            default: [],
          },
          summary: {
            type: "string",
            description: "Optional short summary",
          },
        },
        required: ["content"],
      },
    },
    {
      name: "search_memories",
      description:
        "Search the shared brain for memories by meaning. Returns semantically similar results even if exact words don't match.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "What to search for (natural language)",
          },
          limit: {
            type: "number",
            description: "Max results",
            default: 5,
          },
          source: {
            type: "string",
            description: "Filter by source",
          },
          category: {
            type: "string",
            description: "Filter by category",
          },
          threshold: {
            type: "number",
            description: "Similarity threshold 0-1",
            default: 0.5,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "list_memories",
      description: "List recent memories from the shared brain.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Max results",
            default: 20,
          },
          source: {
            type: "string",
            description: "Filter by source",
          },
        },
      },
    },
    {
      name: "delete_memory",
      description: "Delete a memory by its ID.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: {
            type: "string",
            description: "UUID of the memory to delete",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "brain_stats",
      description:
        "Show statistics about the shared brain: total memories, breakdown by source and category.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "update_memory",
      description:
        "Update an existing memory by ID. Re-generates embedding if content is changed.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: {
            type: "string",
            description: "UUID of the memory to update",
          },
          content: {
            type: "string",
            description: "New content (triggers embedding regeneration)",
          },
          category: {
            type: "string",
            enum: [...VALID_CATEGORIES],
            description: "New category",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "New tags",
          },
          summary: {
            type: "string",
            description: "New summary",
          },
        },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "store_memory": {
        const result = await storeMemory(args as Parameters<typeof storeMemory>[0]);
        return {
          content: [
            {
              type: "text" as const,
              text: `Memory stored. ID: ${result[0]?.id || "unknown"}`,
            },
          ],
        };
      }

      case "search_memories": {
        const results = await searchMemories(args as Parameters<typeof searchMemories>[0]);
        if (!results.length) {
          return {
            content: [{ type: "text" as const, text: "No matching memories found." }],
          };
        }
        const output = results
          .map((r) => {
            const sim = ((r.similarity || 0) * 100).toFixed(1);
            const date = r.created_at?.slice(0, 10) || "?";
            const tags = r.tags?.join(", ") || "";
            return `[${sim}%] [${date}] [${r.source}/${r.category}] ${tags}\n${r.content}`;
          })
          .join("\n\n---\n\n");
        return { content: [{ type: "text" as const, text: output }] };
      }

      case "list_memories": {
        const results = await listMemories(args as Parameters<typeof listMemories>[0]);
        const output = results
          .map((r) => {
            const date = r.created_at?.slice(0, 10) || "?";
            const summary = r.summary || r.content?.slice(0, 100);
            return `[${date}] [${r.source}/${r.category}] ${summary}`;
          })
          .join("\n");
        return {
          content: [{ type: "text" as const, text: output || "No memories found." }],
        };
      }

      case "delete_memory": {
        await deleteMemory(args as Parameters<typeof deleteMemory>[0]);
        return {
          content: [{ type: "text" as const, text: `Memory deleted: ${(args as { id: string }).id}` }],
        };
      }

      case "update_memory": {
        const updateArgs = args as Parameters<typeof updateMemory>[0];
        if (!updateArgs.content && !updateArgs.category && !updateArgs.tags && !updateArgs.summary) {
          return {
            content: [{ type: "text" as const, text: "Nothing to update. Provide at least one of: content, category, tags, summary." }],
            isError: true,
          };
        }
        await updateMemory(updateArgs);
        return {
          content: [{ type: "text" as const, text: `Memory updated: ${updateArgs.id}` }],
        };
      }

      case "brain_stats": {
        const stats = await getStats();
        let text = `Total memories: ${stats.total}\n\nBy source:\n`;
        for (const [s, c] of Object.entries(stats.by_source).sort(
          (a, b) => (b[1] as number) - (a[1] as number)
        )) {
          text += `  ${s}: ${c}\n`;
        }
        text += `\nBy category:\n`;
        for (const [s, c] of Object.entries(stats.by_category).sort(
          (a, b) => (b[1] as number) - (a[1] as number)
        )) {
          text += `  ${s}: ${c}\n`;
        }
        return { content: [{ type: "text" as const, text }] };
      }

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
