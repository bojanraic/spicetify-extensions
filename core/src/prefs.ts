export interface Store<T> {
  load(): T;
  save(value: T): void;
}

/**
 * Typed localStorage wrapper. Object defaults are shallow-merged with the
 * stored value (so new keys get their defaults); scalar defaults are returned
 * as-is when nothing is stored. Corrupt/missing data falls back to defaults.
 */
export function defineStore<T>(key: string, defaults: T): Store<T> {
  const isObject =
    defaults !== null && typeof defaults === 'object' && !Array.isArray(defaults);

  const cloneDefaults = (): T =>
    typeof structuredClone === 'function'
      ? structuredClone(defaults)
      : (JSON.parse(JSON.stringify(defaults)) as T);

  return {
    load(): T {
      try {
        const raw = localStorage.getItem(key);
        if (raw == null) return cloneDefaults();
        const parsed = JSON.parse(raw) as T;
        return isObject
          ? ({ ...(defaults as object), ...(parsed as object) } as T)
          : parsed;
      } catch {
        return cloneDefaults();
      }
    },
    save(value: T): void {
      localStorage.setItem(key, JSON.stringify(value));
    },
  };
}
