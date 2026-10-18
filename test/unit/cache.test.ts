import { describe, expect, it } from "vitest";
import { TtlCache } from "../../src/infra/cache.js";

describe("TtlCache", () => {
  it("expires entries after the TTL", () => {
    let t = 0;
    const cache = new TtlCache<string>({ ttlMs: 100, maxEntries: 10, now: () => t });
    cache.set("a", "1");
    t = 99;
    expect(cache.get("a")).toBe("1");
    t = 100;
    expect(cache.get("a")).toBeUndefined();
  });

  it("evicts the oldest write past maxEntries", () => {
    const cache = new TtlCache<number>({ ttlMs: 1000, maxEntries: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 3);
    cache.set("c", 4);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(3);
    expect(cache.get("c")).toBe(4);
  });

  it("does not cache a failed load", async () => {
    const cache = new TtlCache<number>({ ttlMs: 1000, maxEntries: 10 });
    await expect(cache.getOrLoad("k", () => Promise.reject(new Error("x")))).rejects.toThrow();
    await expect(cache.getOrLoad("k", async () => 7)).resolves.toBe(7);
  });
});
