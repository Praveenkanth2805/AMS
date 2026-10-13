/**
 * Tiny in-memory TTL cache for read-heavy reference data
 * (academic years, departments, classes).
 *
 * Lifetime = one browser tab session. Reload clears it.
 * Mutations call invalidate() to force a refresh.
 */

type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;

  const value = await fetcher();
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

export function invalidate(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function clearCache(): void {
  store.clear();
}