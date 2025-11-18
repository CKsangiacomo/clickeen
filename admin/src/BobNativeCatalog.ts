type BobPrimitive = {
  html: string;
  css: string;
  source: string;
};

export type BobNativeCatalog = Record<string, BobPrimitive>;

const htmlModules = import.meta.glob('../../bob/bob_native_ui/**/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const bobCssModulesRaw = import.meta.glob('../../bob/bob_native_ui/**/*.css', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const dietCssModulesRaw = import.meta.glob('../../dieter/**/*.css', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const normalizePath = (value: string): string => value.replace(/\\/g, '/');

const normalizeCssModules = (modules: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(modules).map(([modulePath, css]) => [normalizePath(modulePath), css.trim()]),
  );

const bobCssModules = normalizeCssModules(bobCssModulesRaw);
const dietCssModules = normalizeCssModules(dietCssModulesRaw);

const allCssModules: Record<string, string> = {
  ...dietCssModules,
  ...bobCssModules,
};

const CSS_IMPORT_REGEX = /@import\s+['"]([^'"]+)['"];\s*/g;

const resolveCssImport = (fromPath: string, importPath: string): string | null => {
  if (!importPath.startsWith('.')) return null;
  const baseSegments = fromPath.split('/').slice(0, -1);
  const importSegments = importPath.split('/');
  const stack: string[] = [];

  for (const segment of [...baseSegments, ...importSegments]) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (stack.length === 0 || stack[stack.length - 1] === '..') {
        stack.push('..');
      } else {
        stack.pop();
      }
    } else {
      stack.push(segment);
    }
  }

  return normalizePath(stack.join('/'));
};

const inlineDependencies = (
  css: string,
  sourcePath: string,
  visited = new Set<string>([normalizePath(sourcePath)]),
): string => {
  if (!css) return css;
  return css.replace(CSS_IMPORT_REGEX, (fullMatch, importPath: string) => {
    const resolvedPath = resolveCssImport(normalizePath(sourcePath), importPath);
    if (!resolvedPath) {
      return fullMatch;
    }
    const dependencyCss = allCssModules[resolvedPath];
    if (!dependencyCss || visited.has(resolvedPath)) {
      return '';
    }
    visited.add(resolvedPath);
    return inlineDependencies(dependencyCss, resolvedPath, visited);
  });
};

const metadata: Record<string, { source: string }> = {
  popover: {
    source: 'bob_native_ui/popover/',
  },
  textrename: {
    source: 'bob_native_ui/textrename/',
  },
};

const extractComponent = (path: string): string | null => {
  const marker = 'bob_native_ui/';
  const idx = path.indexOf(marker);
  if (idx === -1) return null;
  const rest = path.slice(idx + marker.length);
  const parts = rest.split('/');
  return parts[0] ?? null;
};

export const generateBobNativeCatalog = (): BobNativeCatalog => {
  const entries = new Map<string, Partial<BobPrimitive>>();

  console.log('[BobNative] HTML modules:', htmlModules);
  console.log('[BobNative] CSS modules:', bobCssModules);

  Object.entries(htmlModules).forEach(([path, html]) => {
    console.log('[BobNative] Processing HTML:', path, typeof html, html);
    const component = extractComponent(path);
    if (!component) return;
    if (!entries.has(component)) entries.set(component, {});
    entries.get(component)!.html = typeof html === 'string' ? html.trim() : String(html);
  });

  Object.entries(bobCssModules).forEach(([path, css]) => {
    console.log('[BobNative] Processing CSS:', path, typeof css, css);
    const component = extractComponent(path);
    if (!component) return;
    if (!entries.has(component)) entries.set(component, {});
    entries.get(component)!.css = inlineDependencies(css, path);
  });

  const catalog: BobNativeCatalog = {};

  Object.entries(metadata).forEach(([component, meta]) => {
    const entry = entries.get(component);
    if (!entry?.html || !entry?.css) return;
    catalog[component] = {
      html: entry.html,
      css: entry.css,
      source: meta.source,
    };
  });

  return catalog;
};
