// Immutable path helpers for dot-notation paths like "a.b.0.c".

export function getAt<T = any>(obj: any, path: string): T | undefined {
  if (!path) return obj as T;
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    const key = isIndex(p) ? Number(p) : p;
    cur = cur[key as any];
  }
  return cur as T | undefined;
}

export function setAt<T = any>(obj: any, path: string, value: T): any {
  const parts = path.split('.');
  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur: any = root;
  for (let i = 0; i < parts.length; i++) {
    const k = parts[i];
    const isLast = i === parts.length - 1;
    const key = isIndex(k) ? Number(k) : k;
    if (isLast) {
      cur[key as any] = value;
    } else {
      const next = cur[key as any];
      const clone = Array.isArray(next) ? [...next] : (next && typeof next === 'object' ? { ...next } : {});
      cur[key as any] = clone;
      cur = clone;
    }
  }
  return root;
}

export function updateAt(obj: any, path: string, fn: (oldValue: any) => any): any {
  const prev = getAt(obj, path);
  return setAt(obj, path, fn(prev));
}

export function deleteAt(obj: any, path: string): any {
  const parts = path.split('.');
  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur: any = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    const key = isIndex(k) ? Number(k) : k;
    const next = cur[key as any];
    const clone = Array.isArray(next) ? [...next] : (next && typeof next === 'object' ? { ...next } : {});
    cur[key as any] = clone;
    cur = clone;
  }
  const last = parts[parts.length - 1];
  const lastKey = isIndex(last) ? Number(last) : last;
  if (Array.isArray(cur)) {
    const idx = lastKey as number;
    if (idx >= 0 && idx < cur.length) cur.splice(idx, 1);
  } else if (cur && typeof cur === 'object') {
    delete cur[lastKey as any];
  }
  return root;
}

function isIndex(s: string): boolean {
  return /^\d+$/.test(s);
}
