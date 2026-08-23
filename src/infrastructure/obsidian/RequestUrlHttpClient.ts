import { requestUrl } from "obsidian";
import type { HttpClient } from "../../application/ports/HttpClient";

/**
 * `requestUrl` runs in Electron's main process, so there is no CORS. It
 * cannot be cancelled, so abort is honoured by ignoring the result: the
 * caller sees an AbortError and the stale response is dropped.
 */
export class RequestUrlHttpClient implements HttpClient {
  async postJson(url: string, body: unknown, headers: Record<string, string>, signal: AbortSignal): Promise<{ status: number; json: unknown }> {
    if (signal.aborted) throw abortError();
    const res = requestUrl({ url, method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", ...headers }, throw: false });
    const aborted = new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(abortError()), { once: true }));
    const r = await Promise.race([res, aborted]);
    return { status: r.status, json: safeJson(r) };
  }
}

const abortError = () => new DOMException("aborted", "AbortError");

function safeJson(r: { json?: unknown; text?: string }): unknown {
  try {
    return r.json ?? (r.text ? JSON.parse(r.text) : null);
  } catch {
    return null;
  }
}
