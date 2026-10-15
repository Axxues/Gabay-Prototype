export interface CachedRagResponse {
  reply: string;
  chart?: unknown;
  sources: Array<{ label: string; detail: string }>;
  sessionId?: string;
  execution?: unknown;
  structured?: unknown;
}

export interface CacheEntry {
  response: CachedRagResponse;
  expiresAt: number;
}

export class RagCache {
  private map: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;

  constructor(options: { maxEntries?: number; defaultTtlMs?: number } = {}) {
    this.maxEntries = options.maxEntries ?? 200;
    this.defaultTtlMs = options.defaultTtlMs ?? 15 * 60 * 1000; // 15 mins
  }

  public static normalizeKey(userId: string | undefined, role: string | undefined, message: string): string {
    const u = (userId || 'anon').trim().toLowerCase();
    const r = (role || 'none').trim().toLowerCase();
    const m = (message || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return `${u}:${r}:${m}`;
  }

  public get(userId: string | undefined, role: string | undefined, message: string): CachedRagResponse | null {
    const key = RagCache.normalizeKey(userId, role, message);
    const entry = this.map.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }

    // Refresh LRU order (delete & re-insert)
    this.map.delete(key);
    this.map.set(key, entry);

    return entry.response;
  }

  public set(
    userId: string | undefined,
    role: string | undefined,
    message: string,
    response: CachedRagResponse,
    ttlMs?: number
  ): void {
    if (!message || !response || !response.reply) return;

    const key = RagCache.normalizeKey(userId, role, message);

    // Evict oldest if reaching capacity
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey) {
        this.map.delete(oldestKey);
      }
    }

    const ttl = ttlMs ?? this.defaultTtlMs;
    this.map.set(key, {
      response,
      expiresAt: Date.now() + ttl,
    });
  }

  public clear(): void {
    this.map.clear();
  }

  public size(): number {
    return this.map.size;
  }
}

export const ragCache = new RagCache();
