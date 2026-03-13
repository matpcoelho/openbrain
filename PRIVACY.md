# Privacy Policy - Open Brain

**Last updated:** March 13, 2026

## What Open Brain Does

Open Brain is a Chrome extension that lets you save and retrieve memories across AI chat platforms. It connects to your own self-hosted Supabase database.

## Data Collection

Open Brain collects the following data, **stored only in your own Supabase instance**:

- **AI conversation text** you choose to save (via the "Save Chat" button)
- **Memories** you manually store
- **Search queries** used to retrieve memories

## Data Storage

- **API credentials** (Supabase URL, API key, embedding API key) are stored locally in your browser using `chrome.storage.local`. They never leave your device except to authenticate with your own Supabase instance.
- **Memory content** is sent to your self-hosted Supabase database. You control this database entirely.
- **Embedding generation** uses the Gemini API (or OpenAI API, depending on your configuration) to generate vector embeddings for semantic search. The text content is sent to the chosen embedding provider for this purpose only.

## What We Don't Do

- We don't collect analytics or telemetry
- We don't track browsing activity
- We don't sell or share any data with third parties
- We don't store any data on our own servers
- We don't access any data beyond the AI chat pages you interact with

## Permissions

- **`clipboardWrite`**: Used to paste memory context into AI chat input fields
- **Host permissions** (chatgpt.com, claude.ai, gemini.google.com, etc.): Required to inject the Save/Search/Store UI buttons into supported AI platforms
- **`storage`**: Used to save your connection settings locally

## Third-Party Services

- **Supabase**: Your self-hosted database. Subject to [Supabase's privacy policy](https://supabase.com/privacy).
- **Google Gemini API** (optional): Used for generating embeddings. Subject to [Google's privacy policy](https://policies.google.com/privacy).
- **OpenAI API** (optional): Alternative embedding provider. Subject to [OpenAI's privacy policy](https://openai.com/privacy).

## Contact

For questions about this privacy policy, open an issue at [github.com/matpcoelho/openbrain](https://github.com/matpcoelho/openbrain).
