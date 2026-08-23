import type { HttpClient } from "../../../src/application/ports/HttpClient";

export interface Call { url: string; body: unknown; headers: Record<string, string> }

/** Records requests and replays canned responses. */
export class FakeHttp implements HttpClient {
  calls: Call[] = [];
  constructor(private readonly responder: (call: Call, signal: AbortSignal) => Promise<{ status: number; json: unknown }> | { status: number; json: unknown }) {}
  async postJson(url: string, body: unknown, headers: Record<string, string>, signal: AbortSignal) {
    const call = { url, body, headers };
    this.calls.push(call);
    return this.responder(call, signal);
  }
}

export const OLLAMA_OK = {
  model: "qwen2.5:7b",
  message: { role: "assistant", content: JSON.stringify({ findings: [{ kind: "metaphor", quote: "silence bruised him", note: "Strained." }] }) },
  done: true,
  prompt_eval_count: 812,
  eval_count: 44,
};
