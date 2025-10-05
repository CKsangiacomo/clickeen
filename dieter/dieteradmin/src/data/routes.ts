export type NavItemKind = 'home' | 'showcase' | 'component';

export interface NavItem {
  id: string;
  title: string;
  path: string;
  kind: NavItemKind;
  summary?: string;
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export interface ShowcasePage {
  slug: string;
  title: string;
  path: string;
  htmlPath: string;
  css: string[];
  summary?: string;
}

export interface CandidatePage {
  slug: string;
  title: string;
  path: string;
  htmlPath: string;
}

const showcaseModules = import.meta.glob('../html/dieter-showcase/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const candidateModules = import.meta.glob('../html/candidates/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const toSlug = (path: string) => path.split('/').pop()?.replace(/\.html(?:\?raw)?$/, '') ?? '';
const toTitle = (slug: string) =>
  slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const showcaseCssMap: Record<string, string[]> = {
  button: ['@dieter/dist/components/button.css'],
  segmented: ['@dieter/dist/components/segmented.css'],
  colors: ['@dieter/dist/tokens.css'],
  typography: ['@dieter/dist/tokens.css'],
};

const showcasePaths = Object.keys(showcaseModules).sort();
const candidatePaths = Object.keys(candidateModules).sort();
const candidateFilter = (slug: string) => !/(grid|snippet|state|variant)/i.test(slug);

export const showcasePages: ShowcasePage[] = showcasePaths.map((path) => {
  const slug = toSlug(path);
  const title = toTitle(slug);
  return {
    slug,
    title,
    path: `#/dieter/${slug}`,
    htmlPath: path,
    css: showcaseCssMap[slug] ?? [],
  } satisfies ShowcasePage;
});

export const candidatePages: CandidatePage[] = candidatePaths
  .map((path) => {
    const slug = toSlug(path);
    if (!candidateFilter(slug)) return undefined;
    const title = toTitle(slug);
    return {
      slug,
      title,
      path: `#/components/${slug}`,
      htmlPath: path,
    } satisfies CandidatePage;
  })
  .filter((value): value is CandidatePage => Boolean(value));

export const showcaseIndex = new Map(showcasePages.map((page) => [page.slug, page] as const));
export const candidateIndex = new Map(candidatePages.map((page) => [page.slug, page] as const));

const showcaseNavItems: NavItem[] = showcasePages.map((page) => ({
  id: `showcase-${page.slug}`,
  title: page.title,
  path: page.path,
  kind: 'showcase' as const,
  summary: page.summary,
}));

const candidateNavItems: NavItem[] = candidatePages.map((page) => ({
  id: `candidate-${page.slug}`,
  title: page.title,
  path: page.path,
  kind: 'component' as const,
}));

export const navGroups: NavGroup[] = [
  {
    id: 'dieter',
    title: 'Dieter Components',
    items: showcaseNavItems,
  },
  {
    id: 'candidates',
    title: 'Candidates Lab',
    items: candidateNavItems,
  },
];

export const navIndex = new Map<string, NavItem>();
navGroups.forEach((group) => {
  group.items.forEach((item) => navIndex.set(item.path, item));
});
