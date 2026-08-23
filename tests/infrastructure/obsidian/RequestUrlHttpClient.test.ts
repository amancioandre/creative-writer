import { describe, it, expect, vi } from "vitest";
import * as obsidian from "obsidian";
import { RequestUrlHttpClient } from "../../../src/infrastructure/obsidian/RequestUrlHttpClient";

describe("RequestUrlHttpClient", () => {
  it("posts JSON via requestUrl without throwing on non-2xx", async () => {
    const spy = vi.spyOn(obsidian, "requestUrl").mockResolvedValue({ status: 404, json: { error: "x" } } as never);
    const res = await new RequestUrlHttpClient().postJson("http://h/x", { a: 1 }, { "X-Y": "z" }, new AbortController().signal);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ url: "http://h/x", method: "POST", body: JSON.stringify({ a: 1 }), throw: false, headers: expect.objectContaining({ "X-Y": "z" }) }));
    expect(res).toEqual({ status: 404, json: { error: "x" } });
  });

  it("rejects immediately if the signal is already aborted", async () => {
    const c = new AbortController(); c.abort();
    await expect(new RequestUrlHttpClient().postJson("u", {}, {}, c.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects with AbortError if aborted while in flight (the request itself cannot be cancelled)", async () => {
    vi.spyOn(obsidian, "requestUrl").mockImplementation(() => new Promise((r) => setTimeout(() => r({ status: 200, json: {} } as never), 50)));
    const c = new AbortController();
    const p = new RequestUrlHttpClient().postJson("u", {}, {}, c.signal);
    c.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});
