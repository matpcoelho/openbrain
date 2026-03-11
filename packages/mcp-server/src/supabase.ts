/**
 * Supabase client wrapper for OpenBrain.
 * Handles REST API calls and RPC function invocations.
 */

export class SupabaseClient {
  constructor(
    private url: string,
    private key: string
  ) {
    if (!url) throw new Error("Supabase URL required");
    if (!key) throw new Error("Supabase key required");
  }

  private get headers(): Record<string, string> {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  }

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.url}/rest/v1/${path}`;
    const opts: RequestInit = { method, headers: this.headers };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(url, opts);
    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(`Supabase ${method} ${path} failed (${resp.status}): ${error}`);
    }
    return resp.json() as Promise<T>;
  }

  async rpc<T = unknown>(fn: string, params: Record<string, unknown>): Promise<T> {
    const url = `${this.url}/rest/v1/rpc/${fn}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(params),
    });

    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(`Supabase RPC ${fn} failed (${resp.status}): ${error}`);
    }
    return resp.json() as Promise<T>;
  }
}
