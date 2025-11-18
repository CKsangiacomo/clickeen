// Deep merge defaults and instance data. Instance overrides defaults.
// Arrays are replaced (no deep merge). Primitives: instance wins even if falsy; only undefined falls back.

export function mergeDefaults<T extends Record<string, any>, U extends Record<string, any>>(defaults: T, instance: U): T & U {
  return deepMerge(defaults, instance) as T & U;
}

function deepMerge(a: any, b: any): any {
  if (b === undefined) return clone(a);
  if (!isObject(a) || !isObject(b)) return b;
  const out: any = Array.isArray(a) ? [...a] : { ...a };
  for (const key of Object.keys(b)) {
    const av = (a as any)[key];
    const bv = (b as any)[key];
    if (Array.isArray(av) && Array.isArray(bv)) {
      out[key] = [...bv];
    } else if (isObject(av) && isObject(bv)) {
      out[key] = deepMerge(av, bv);
    } else {
      out[key] = bv;
    }
  }
  return out;
}

function isObject(x: any): x is object {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}

function clone(x: any): any {
  if (Array.isArray(x)) return [...x];
  if (isObject(x)) return { ...x };
  return x;
}

