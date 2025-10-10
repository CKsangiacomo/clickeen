export type RouteKind = 'home' | 'showcase';

export interface RouteMatch {
  kind: RouteKind;
  slug?: string;
}

const HOME_HASHES = new Set(['', '#', '#/']);

export const parseHash = (hash: string): RouteMatch => {
  if (HOME_HASHES.has(hash)) {
    return { kind: 'home' };
  }

  if (hash.startsWith('#/dieter/')) {
    const slug = hash.replace('#/dieter/', '').trim();
    return { kind: 'showcase', slug: slug || undefined };
  }

  return { kind: 'home' };
};

export const startRouter = (listener: (match: RouteMatch) => void) => {
  const handle = () => listener(parseHash(window.location.hash));
  window.addEventListener('hashchange', handle);
  handle();
  return () => window.removeEventListener('hashchange', handle);
};

export const navigate = (hash: string) => {
  if (!hash.startsWith('#')) {
    window.location.hash = `#${hash}`;
  } else {
    window.location.hash = hash;
  }
};
