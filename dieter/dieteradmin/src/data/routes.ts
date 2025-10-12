export type NavItemKind = 'home' | 'showcase';

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

const showcaseModules = import.meta.glob('../html/dieter-showcase/*.html', {
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
  button: ['@dieter/components/button.css'],
  segmented: ['@dieter/components/segmented.css'],
  textfield: ['@dieter/components/textfield.css'],
  colors: ['@dieter/tokens/tokens.css'],
  typography: ['@dieter/tokens/tokens.css'],
  dropdown: ['@dieter/components/dropdown.css'],
};

const showcasePaths = Object.keys(showcaseModules).sort();
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

export const showcaseIndex = new Map(showcasePages.map((page) => [page.slug, page] as const));

// Optional navigation config to group and order showcase pages
import { navConfig } from './nav.config';
interface NavConfigGroup { id: string; title: string; items: string[] }
interface NavConfig { groups: NavConfigGroup[] }

const allShowcaseSlugs = new Set(showcasePages.map((p) => p.slug));

const pageToNav = (page: ShowcasePage): NavItem => ({
  id: `showcase-${page.slug}`,
  title: page.title,
  path: page.path,
  kind: 'showcase' as const,
  summary: page.summary,
});

const buildShowcaseGroups = (): NavGroup[] => {
  if (!navConfig) {
    // Fallback: single group with all showcase pages
    return [{ id: 'components', title: 'Components', items: showcasePages.map(pageToNav) }];
  }
  const remaining = new Set(allShowcaseSlugs);
  const groups: NavGroup[] = [];
  for (const g of navConfig.groups) {
    const items: NavItem[] = [];
    for (const slug of g.items) {
      const page = showcaseIndex.get(slug);
      if (!page) continue;
      items.push(pageToNav(page));
      remaining.delete(slug);
    }
    if (items.length) groups.push({ id: g.id, title: g.title, items });
  }
  // Append any pages not listed in config under "Other"
  if (remaining.size) {
    const leftovers = Array.from(remaining)
      .sort((a, b) => a.localeCompare(b))
      .map((slug) => pageToNav(showcaseIndex.get(slug)!));
    groups.push({ id: 'other', title: 'Other', items: leftovers });
  }
  return groups;
};

export const navGroups: NavGroup[] = buildShowcaseGroups();

export const navIndex = new Map<string, NavItem>();
navGroups.forEach((group) => {
  group.items.forEach((item) => navIndex.set(item.path, item));
});
