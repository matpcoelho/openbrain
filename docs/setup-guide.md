# Setup Guide

This guide walks through setting up OpenBrain from scratch.

## Prerequisites

- Node.js 18+ (for the CLI and MCP server)
- A Supabase account (free tier works)
- A Gemini API key (free) or OpenAI API key

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** (looks like `https://abcdefgh.supabase.co`).
3. Go to **Settings > API** and copy your **service_role key** (not the anon key).

The service role key bypasses Row Level Security, which is needed for write operations. Keep it secret.

## Step 2: Run the Migration

1. In your Supabase dashboard, go to **SQL Editor > New Query**.
2. Copy the contents of `supabase/migrations/001_init.sql` and paste it in.
3. Click **Run**.

This creates:
- The `memories` table with vector embedding support
- Indexes for fast similarity search, filtering, and full-text search
- The `match_memories` RPC function for semantic search
- The `hybrid_search` RPC function for combined semantic + text search
- Row Level Security policies
- An auto-update trigger for the `updated_at` column

If you see an error about the `vector` extension, make sure pgvector is enabled in your Supabase project (it's enabled by default on new projects).

## Step 3: Get an Embedding API Key

OpenBrain supports two embedding providers:

### Gemini (recommended, free)

1. Go to [aistudio.google.com](https://aistudio.google.com).
2. Click "Get API Key" and create one.
3. The free tier includes generous embedding limits.

### OpenAI (alternative)

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Create a new API key.
3. The `text-embedding-3-small` model is used (affordable, 1536 dimensions).

Both providers produce 1536-dimensional embeddings, so you can switch between them without re-embedding your data (though similarity scores may differ slightly between providers).

## Step 4: Install and Configure

### Using the Setup Wizard

```bash
npx openbrain-ai setup
```

The wizard will:
1. Ask for your Supabase URL and service role key
2. Test the database connection
3. Ask which embedding provider you want (Gemini or OpenAI)
4. Ask for the corresponding API key
5. Test the embedding API
6. Save everything to `~/.openbrain/config.json`

### Manual Configuration

If you prefer, create `~/.openbrain/config.json` manually:

```json
{
  "supabaseUrl": "https://your-project.supabase.co",
  "supabaseKey": "your-service-role-key",
  "embeddingProvider": "gemini",
  "geminiApiKey": "your-gemini-key",
  "openaiApiKey": ""
}
```

Set file permissions to restrict access:

```bash
chmod 600 ~/.openbrain/config.json
```

### Environment Variables

The MCP server also reads environment variables as a fallback:

| Variable | Description |
|----------|-------------|
| `OPENBRAIN_SUPABASE_URL` | Supabase project URL |
| `OPENBRAIN_SUPABASE_KEY` | Supabase service role key |
| `OPENBRAIN_EMBEDDING_PROVIDER` | `gemini` or `openai` |
| `GEMINI_API_KEY` | Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |

## Step 5: Verify

```bash
# Store a test memory
npx openbrain-ai store "This is a test memory to verify OpenBrain is working" --category insight

# Search for it
npx openbrain-ai search "test memory"

# Check stats
npx openbrain-ai stats
```

If all three commands work, you're good to go.

## Deploying the Edge Function (Optional)

The edge function provides a REST API for HTTP access. This is needed for the Chrome extension and any non-MCP integrations.

1. Install the Supabase CLI: `npm install -g supabase`
2. Link your project: `supabase link --project-ref your-project-ref`
3. Set secrets:
   ```bash
   supabase secrets set GEMINI_API_KEY=your-gemini-key
   supabase secrets set BRAIN_API_SECRET=your-chosen-secret
   ```
4. Deploy:
   ```bash
   supabase functions deploy brain-api
   ```

The function URL will be: `https://your-project.supabase.co/functions/v1/brain-api`

## Troubleshooting

**"Config not found" error:** Run `npx openbrain-ai setup` to create the config file.

**"Could not connect to Supabase" during setup:** Check that your URL starts with `https://` and ends with `.supabase.co`. Make sure you're using the service role key, not the anon key.

**"Embedding API test failed":** Verify your API key is correct. For Gemini, make sure the Generative Language API is enabled in your Google Cloud project (it usually is by default when you create a key through AI Studio).

**Empty search results:** Check that your memories have embeddings. If you stored memories before setting up embeddings, they won't have vectors and won't appear in semantic search.
