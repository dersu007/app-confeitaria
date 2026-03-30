
type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private ttl: number = 5 * 60 * 1000; // 5 minutes default TTL

  setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  invalidateCache(keyPrefix?: string): void {
    if (!keyPrefix) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const cacheService = new CacheService();
