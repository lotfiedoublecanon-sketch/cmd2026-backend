// ============================================
// Shared in-memory server cache with stale fallback
// ============================================

export type CacheStatus = 'hit' | 'miss' | 'stale';

export interface CacheInfo {
  status: CacheStatus;
  key: string;
  updatedAt?: string;
  expiresAt?: string;
}

interface CacheEntry<T> {
  value: T;
  updatedAt: number;
  expiresAt: number;
}

class ServerCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private lastErrors = new Map<string, { message: string; at: string }>();

  get<T>(key: string): { value: T; info: CacheInfo } | null {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) return null;
    return { value: entry.value, info: this.info(key, entry, 'hit') };
  }

  getStale<T>(key: string): { value: T; info: CacheInfo } | null {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    return { value: entry.value, info: this.info(key, entry, 'stale') };
  }

  set<T>(key: string, value: T, ttlMs: number): CacheInfo {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      updatedAt: now,
      expiresAt: now + ttlMs,
    };
    this.entries.set(key, entry);
    return this.info(key, entry, 'miss');
  }

  async getOrFetch<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>
  ): Promise<{ value: T; info: CacheInfo }> {
    const cached = this.get<T>(key);
    if (cached) return cached;

    try {
      const value = await fetcher();
      const info = this.set(key, value, ttlMs);
      return { value, info };
    } catch (error) {
      const message = this.sanitizeMessage(error instanceof Error ? error.message : String(error));
      this.lastErrors.set(key, { message, at: new Date().toISOString() });
      const stale = this.getStale<T>(key);
      if (stale) return stale;
      throw error;
    }
  }

  snapshot() {
    const now = Date.now();
    return {
      size: this.entries.size,
      entries: Array.from(this.entries.entries()).map(([key, entry]) => ({
        key,
        itemCount: this.itemCount(entry.value),
        updatedAt: new Date(entry.updatedAt).toISOString(),
        expiresAt: new Date(entry.expiresAt).toISOString(),
        expired: entry.expiresAt < now,
        lastError: this.lastErrors.get(key) || null,
      })),
    };
  }

  getLastErrors() {
    return Array.from(this.lastErrors.entries()).map(([key, value]) => ({
      key,
      ...value,
    }));
  }

  private info<T>(key: string, entry: CacheEntry<T>, status: CacheStatus): CacheInfo {
    return {
      status,
      key,
      updatedAt: new Date(entry.updatedAt).toISOString(),
      expiresAt: new Date(entry.expiresAt).toISOString(),
    };
  }

  private sanitizeMessage(message: string): string {
    return message
      .replace(/([?&](?:key|api_key|token|access_token)=)[^&\s]+/gi, '$1[redacted]')
      .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[redacted]')
      .replace(/(x-api-key["']?\s*[:=]\s*["']?)[A-Za-z0-9._-]+/gi, '$1[redacted]');
  }

  private itemCount(value: unknown): number | null {
    if (Array.isArray(value)) return value.length;
    const data = (value as any)?.data;
    if (Array.isArray(data)) return data.length;
    if (Array.isArray(data?.groups)) return data.groups.length;
    if (Array.isArray((value as any)?.items)) return (value as any).items.length;
    return null;
  }
}

export const serverCache = new ServerCache();
export default ServerCache;
