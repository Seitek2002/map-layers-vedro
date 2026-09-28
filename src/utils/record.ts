// The only type assertions in the app live here: Object.keys widens to
// string[], but every key of a Record<K, …> is a K by construction.

export function typedKeys<K extends string>(record: Readonly<Partial<Record<K, unknown>>>): K[] {
  return Object.keys(record) as K[];
}

/** Typed `Object.fromEntries(Object.entries(r).map(...))` that keeps the key union. */
export function mapRecord<K extends string, V, R>(
  record: Readonly<Record<K, V>>,
  fn: (value: V, key: K) => R,
): Record<K, R> {
  const result = {} as Record<K, R>;
  for (const key of typedKeys(record)) result[key] = fn(record[key], key);
  return result;
}

export function omitKeys<K extends string, V>(
  record: Readonly<Partial<Record<K, V>>>,
  keys: Iterable<K>,
): Partial<Record<K, V>> {
  const next: Partial<Record<K, V>> = { ...record };
  for (const key of keys) delete next[key];
  return next;
}

export function shallowEqualArrays<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
}
