/**
 * Minimal in-memory TTL cache suitable for server-only use.
 * Resets on process restart (acceptable for a hackathon; swap for Redis later).
 */
export interface TTLCacheEntry<T> {
  value: T;
  expiresAt: number;
}

export function createTTLCache<T>(ttlMs: number) {
  let entry: TTLCacheEntry<T> | null = null;

  function get(): T | null {
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      entry = null;
      return null;
    }
    return entry.value;
  }

  function set(value: T): void {
    entry = { value, expiresAt: Date.now() + ttlMs };
  }

  function clear(): void {
    entry = null;
  }

  return { get, set, clear } as const;
}