# OpenBrain

Your AI tools forget everything. OpenBrain remembers.

## The Problem

Every AI conversation starts from zero. You told ChatGPT about your project architecture last week. You explained your preferences to Claude yesterday. You gave Gemini context about your team this morning. None of them remember. None of them talk to each other.

Your context is trapped in silos.

## The Solution

OpenBrain is a shared memory layer for all your AI tools. One brain, accessible from anywhere.

```
ChatGPT  ──store──►  ┌──────────┐  ◄──search──  Claude
                      │ OpenBrain │
Gemini   ──store──►  │ (Supabase)│  ◄──search──  Cursor
                      └──────────┘
                           ▲
                     Chrome Extension
                     CLI / REST API
```

Store a memory from ChatGPT. Retrieve it in Claude. Use it in Cursor. Your AI tools finally share one brain.

## Quick Start

**1. Create a Supabase project** at [supabase.com](https://supabase.com) (free tier works).

**2. Run the migration** in your Supabase SQL Editor:

Copy the contents of `supabase/migrations/001_init.sql` and run it.

**3. Get a Gemini API key** (free) at [aistudio.google.com](https://aistudio.google.com).

**4. Install and configure:**

```bash
npx openbrain-ai setup
```

The setup wizard will prompt for your Supabase URL, key, and embedding API key, then test the connection.

**5. Store your first memory:**

```bash
npx openbrain-ai store "I prefer TypeScript over JavaScript for all new projects" --category preference
```

## Features

- **Semantic search** across all stored memories using vector embeddings
- **Multi-provider embeddings** with Gemini (free) or OpenAI
- **Categories and tags** for organized memory retrieval
- **MCP server** for direct integration with Claude Desktop, Cursor, and other MCP clients
- **REST API** via Supabase Edge Functions for any HTTP client
- **Chrome extension** support for capturing context from ChatGPT, Gemini, and other web UIs
- **Hybrid search** combining semantic similarity with full-text matching
- **Self-hosted** on your own Supabase instance. Your data stays yours.

## Integration Channels

### MCP Server (Claude Desktop, Cursor, OpenClaw)

The MCP server gives any MCP-compatible AI tool direct access to your memories.

```bash
npm install -g openbrain-mcp
```

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "openbrain": {
      "command": "openbrain-mcp"
    }
  }
}
```

See [docs/mcp-setup.md](docs/mcp-setup.md) for detailed configuration.

### CLI

```bash
# Store memories
openbrain store "Our API uses REST with JSON responses" --category decision --tags "api,architecture"

# Search by meaning
openbrain search "what did we decide about the API"

# List recent memories
openbrain list --limit 10 --source chatgpt

# Brain statistics
openbrain stats
```

### REST API (Edge Function)

Deploy the edge function to your Supabase project for HTTP access from any client.

```bash
# Store
curl -X POST "https://your-project.supabase.co/functions/v1/brain-api?action=store" \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"content": "Important decision about architecture", "category": "decision"}'

# Search
curl -X POST "https://your-project.supabase.co/functions/v1/brain-api?action=search" \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"query": "architecture decisions"}'
```

See [docs/api-reference.md](docs/api-reference.md) for the full API.

### Chrome Extension

A companion Chrome extension (separate install) lets you capture context directly from ChatGPT, Gemini, Perplexity, and other AI web interfaces with one click.

**Supported AI tools via extension:** ChatGPT, Claude, Gemini, Perplexity, Grok, DeepSeek, Mistral, Copilot, Poe.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Your AI Tools                     │
│  ChatGPT  Claude  Gemini  Cursor  Perplexity  Grok │
└──────┬────────┬──────┬───────┬──────────────────────┘
       │        │      │       │
       ▼        ▼      ▼       ▼
┌──────────┐ ┌─────┐ ┌──────────────┐
│  Chrome  │ │ MCP │ │  REST API    │
│Extension │ │Server│ │(Edge Function)│
└────┬─────┘ └──┬──┘ └──────┬───────┘
     │          │            │
     ▼          ▼            ▼
┌─────────────────────────────────────┐
│           Supabase                   │
│  ┌──────────┐  ┌─────────────────┐  │
│  │ Postgres  │  │    pgvector     │  │
│  │ (memories)│  │  (embeddings)   │  │
│  └──────────┘  └─────────────────┘  │
└─────────────────────────────────────┘
```

**Backend:** Supabase (Postgres + pgvector) handles storage, vector similarity search, and row-level security. Free tier is more than enough for personal use.

**Embeddings:** Gemini Embedding API (free tier, 1536 dimensions) by default. OpenAI text-embedding-3-small as an alternative. The embedding provider is abstracted behind a simple interface, so adding new providers is straightforward.

**Search:** Semantic search via pgvector cosine similarity, with optional hybrid search combining vector similarity and full-text matching for better recall.

## Memory Categories

Memories are organized into categories for better retrieval:

| Category | Use for |
|----------|---------|
| `company` | Company research, intel, org structure |
| `contact` | People, roles, relationships |
| `interaction` | Meetings, conversations, events |
| `decision` | Choices made, reasoning, trade-offs |
| `insight` | Observations, learnings, patterns |
| `task` | Action items, to-dos, follow-ups |
| `preference` | Personal preferences, settings, style |
| `project` | Project details, status, goals |

## Project Structure

```
openbrain/
├── packages/
│   ├── mcp-server/          MCP server (openbrain-mcp on npm)
│   └── cli/                 CLI tool (openbrain-ai on npm)
├── supabase/
│   ├── migrations/          Database schema
│   └── functions/           Edge functions (REST API)
└── docs/                    Setup guides and API reference
```

## Documentation

- [Setup Guide](docs/setup-guide.md) - Detailed installation and configuration
- [MCP Setup](docs/mcp-setup.md) - Claude Desktop, Cursor, and OpenClaw integration
- [API Reference](docs/api-reference.md) - Edge function endpoints

## Contributing

Contributions are welcome. Open an issue first for anything non-trivial.

This project follows a few principles:
- Keep it simple. This is a memory layer, not a framework.
- Self-hosted first. Users own their data.
- Provider-agnostic. Works with any AI tool that can make HTTP calls or speak MCP.

## License

MIT
