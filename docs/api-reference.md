# API Reference

The OpenBrain REST API is a Supabase Edge Function that provides HTTP access to your memory brain. Deploy it to your Supabase project for use with the Chrome extension, custom scripts, or any HTTP client.

## Base URL

```
https://your-project.supabase.co/functions/v1/brain-api
```

## Authentication

All requests require a Bearer token in the `Authorization` header. The token must match the `BRAIN_API_SECRET` environment variable set on your edge function.

```
Authorization: Bearer YOUR_API_SECRET
```

If `BRAIN_API_SECRET` is not set, authentication is disabled (useful for local development, not recommended for production).

## Endpoints

All endpoints use query parameters for the action: `?action=store`, `?action=search`, etc.

---

### POST ?action=store

Store a new memory.

**Request body:**

```json
{
  "content": "The API uses REST with JSON responses",
  "source": "chatgpt",
  "category": "decision",
  "tags": ["api", "architecture"],
  "summary": "API format decision"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `content` | string | yes | | Memory content |
| `source` | string | no | `api` | Source identifier |
| `category` | string | no | `insight` | Category (see below) |
| `tags` | string[] | no | `[]` | Tags for filtering |
| `summary` | string | no | | Short summary |

**Valid categories:** `company`, `contact`, `interaction`, `decision`, `insight`, `task`, `preference`, `project`

Legacy categories are automatically mapped: `person` becomes `contact`, `event` and `conversation` become `interaction`, `general` becomes `insight`.

**Response:**

```json
{
  "ok": true,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "normalized": {
    "category": "decision",
    "tags": ["api", "architecture"]
  }
}
```

---

### POST ?action=search

Search memories by semantic similarity.

**Request body:**

```json
{
  "query": "what did we decide about the API",
  "limit": 5,
  "source": "chatgpt",
  "category": "decision",
  "threshold": 0.5
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | yes | | Natural language search query |
| `limit` | number | no | `5` | Max results |
| `source` | string | no | | Filter by source |
| `category` | string | no | | Filter by category |
| `threshold` | number | no | `0.5` | Minimum similarity score (0-1) |

**Response:**

```json
{
  "ok": true,
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "content": "The API uses REST with JSON responses",
      "summary": "API format decision",
      "source": "chatgpt",
      "category": "decision",
      "tags": ["api", "architecture"],
      "metadata": {},
      "similarity": 0.89,
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

Results are ordered by similarity (highest first). The `similarity` field ranges from 0 to 1, where 1 is an exact match.

---

### GET ?action=list

List recent memories.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | `20` | Max results |
| `source` | string | | Filter by source |

**Example:**

```
GET /brain-api?action=list&limit=10&source=chatgpt
```

**Response:**

```json
{
  "ok": true,
  "memories": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "content": "The API uses REST with JSON responses",
      "summary": "API format decision",
      "source": "chatgpt",
      "category": "decision",
      "tags": ["api", "architecture"],
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

Results are ordered by `created_at` descending (newest first).

---

### GET ?action=stats

Get memory statistics.

**Example:**

```
GET /brain-api?action=stats
```

**Response:**

```json
{
  "ok": true,
  "total": 142,
  "by_source": {
    "chatgpt": 45,
    "claude": 38,
    "cli": 30,
    "cursor": 29
  },
  "by_category": {
    "insight": 52,
    "decision": 28,
    "interaction": 25,
    "task": 20,
    "preference": 17
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Description of what went wrong"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (missing required field, unknown action) |
| 401 | Unauthorized (invalid or missing Bearer token) |
| 500 | Server error (database or embedding API failure) |

## CORS

The API includes permissive CORS headers (`Access-Control-Allow-Origin: *`) so it can be called from browser extensions and web applications.

### Security Note

The default CORS configuration allows requests from any origin. For production deployments, restrict the `Access-Control-Allow-Origin` header to your specific domain(s) in the edge function code. Leaving it as `*` means any website can make requests to your API if the endpoint URL and credentials are known.

## Deployment

See [Setup Guide](setup-guide.md) for deployment instructions.

```bash
# Set secrets
supabase secrets set GEMINI_API_KEY=your-key
supabase secrets set BRAIN_API_SECRET=your-chosen-secret

# Deploy
supabase functions deploy brain-api
```

## Rate Limits

The edge function itself has no rate limiting. Supabase free tier limits apply:
- 500,000 edge function invocations per month
- 2 million database rows
- This is more than enough for personal memory storage.
