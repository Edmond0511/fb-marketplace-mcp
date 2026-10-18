export interface TtlCacheOptions {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}

// In-memory only: the process lives as long as one client session, so nothing is persisted.
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor({ ttlMs, maxEntries, now = Date.now }: TtlCacheOptions) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    // Map keeps insertion order, so the first key is the oldest write.
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  async getOrLoad(key: string, load: () => Promise<V>): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await load();
    this.set(key, value);
    return value;
  }
}
