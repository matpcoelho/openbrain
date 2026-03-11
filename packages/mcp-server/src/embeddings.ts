/**
 * Multi-provider embedding abstraction.
 * Supports Gemini (free tier, default) and OpenAI.
 */

export interface EmbeddingProvider {
  name: string;
  dimensions: number;
  embed(text: string): Promise<number[]>;
}

export class GeminiProvider implements EmbeddingProvider {
  name = "gemini";
  dimensions = 1536;

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error("Gemini API key required");
  }

  async embed(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${this.apiKey}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: this.dimensions,
      }),
    });

    const data = await resp.json();
    if (data.error) throw new Error(`Gemini embedding error: ${data.error.message}`);
    return data.embedding.values;
  }
}

export class OpenAIProvider implements EmbeddingProvider {
  name = "openai";
  dimensions = 1536;

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error("OpenAI API key required");
  }

  async embed(text: string): Promise<number[]> {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
        dimensions: this.dimensions,
      }),
    });

    const data = await resp.json();
    if (data.error) throw new Error(`OpenAI embedding error: ${data.error.message}`);
    return data.data[0].embedding;
  }
}

export function createProvider(provider: string, config: Record<string, string>): EmbeddingProvider {
  switch (provider) {
    case "gemini":
      return new GeminiProvider(config.geminiApiKey || config.GEMINI_API_KEY || "");
    case "openai":
      return new OpenAIProvider(config.openaiApiKey || config.OPENAI_API_KEY || "");
    default:
      throw new Error(`Unknown embedding provider: ${provider}. Use "gemini" or "openai".`);
  }
}
