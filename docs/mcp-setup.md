# MCP Server Setup

The OpenBrain MCP server gives AI tools like Claude Desktop, Cursor, and OpenClaw direct access to your shared memory brain.

## Install

```bash
npm install -g openbrain-mcp
```

Make sure you've already run `npx openbrain-ai setup` or created `~/.openbrain/config.json` manually. The MCP server reads the same config file.

## Claude Desktop

Edit your Claude Desktop configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add OpenBrain to the `mcpServers` section:

```json
{
  "mcpServers": {
    "openbrain": {
      "command": "openbrain-mcp"
    }
  }
}
```

Restart Claude Desktop. You should see OpenBrain's tools available in the tools menu.

### With Environment Variables

If you prefer environment variables over the config file:

```json
{
  "mcpServers": {
    "openbrain": {
      "command": "openbrain-mcp",
      "env": {
        "OPENBRAIN_SUPABASE_URL": "https://your-project.supabase.co",
        "OPENBRAIN_SUPABASE_KEY": "your-service-role-key",
        "OPENBRAIN_EMBEDDING_PROVIDER": "gemini",
        "GEMINI_API_KEY": "your-gemini-key"
      }
    }
  }
}
```

## Cursor

Add to your Cursor MCP settings (Settings > MCP):

```json
{
  "openbrain": {
    "command": "openbrain-mcp"
  }
}
```

## OpenClaw

Add to your OpenClaw configuration:

```json
{
  "mcpServers": {
    "openbrain": {
      "command": "openbrain-mcp"
    }
  }
}
```

## Available Tools

Once connected, the MCP server exposes these tools:

### store_memory

Store a new memory in the brain.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `content` | string | yes | | The memory text to store |
| `source` | string | no | `mcp` | Which AI tool is storing this |
| `category` | string | no | `insight` | One of: company, contact, interaction, decision, insight, task, preference, project |
| `tags` | string[] | no | `[]` | Tags for filtering |
| `summary` | string | no | | Short summary |

### search_memories

Search for memories by meaning. Returns semantically similar results even when exact words don't match.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | yes | | Natural language search query |
| `limit` | number | no | `5` | Maximum results to return |
| `source` | string | no | | Filter by source |
| `category` | string | no | | Filter by category |
| `threshold` | number | no | `0.5` | Similarity threshold (0-1) |

### list_memories

List recent memories, optionally filtered by source.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | no | `20` | Maximum results |
| `source` | string | no | | Filter by source |

### delete_memory

Remove a memory by its UUID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | UUID of the memory to delete |

### brain_stats

Returns total memory count and breakdowns by source and category. No parameters.

## How AI Tools Use It

Once configured, you can tell Claude (or any MCP client):

- "Remember that we decided to use PostgreSQL for the new project"
- "What do you know about our API architecture?"
- "Store this: the deployment process requires approval from two team leads"
- "Search my brain for anything about the onboarding process"
- "Show me recent memories from ChatGPT"

The AI tool will automatically use the appropriate OpenBrain tool to store or retrieve memories.

## Troubleshooting

**Tools not showing up in Claude Desktop:** Make sure `openbrain-mcp` is in your PATH. Try running `which openbrain-mcp` in your terminal. If it's not found, use the full path in the config.

**"Missing config" error in MCP logs:** Create `~/.openbrain/config.json` or pass environment variables in the MCP config.

**Connection errors:** Verify your Supabase URL and key are correct. The MCP server uses the same config as the CLI, so if `openbrain stats` works, the MCP server should too.
