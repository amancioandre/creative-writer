/** Minimal JSON POST. Obsidian implements it with `requestUrl` (Node-side, no CORS); tests fake it. */
export interface HttpClient {
  postJson(url: string, body: unknown, headers: Record<string, string>, signal: AbortSignal): Promise<{ status: number; json: unknown }>;
}
