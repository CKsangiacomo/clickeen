import { dieterComponentCssByName } from './dieterComponents';
import { staticShowcaseModules } from './showcase.generated';

export type NavItemKind = 'home' | 'showcase';

export interface NavItem {
  id: string;
  title: string;
  path: string;
  kind: NavItemKind;
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
}

export const showcaseModules = staticShowcaseModules;

const toSlug = (path: string) => path.split('/').pop()?.replace(/\.html$/, '') ?? '';

const toTitle = (slug: string) => {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const getFolderFromPath = (path: string): string => {
  const parts = path.split('/');
  const htmlIndex = parts.findIndex(p => p === 'html');
  if (htmlIndex !== -1 && htmlIndex + 1 < parts.length) {
    return parts[htmlIndex + 1];
  }
  return 'other';
};

const buildPagePath = (folder: string, slug: string): string => {
  if (folder === 'tools' && slug === 'entitlements') return '#/policy/entitlements';
  return `#/dieter/${slug}`;
};

const getFolderTitle = (folder: string): string => {
  if (folder === 'components') return 'Dieter Components';
  if (folder === 'tools') return 'Policy';
  return folder.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

// Build showcase pages from discovered files
const staticShowcasePaths = Object.keys(staticShowcaseModules).sort();

const staticShowcasePages: ShowcasePage[] = staticShowcasePaths.map((path) => {
  const slug = toSlug(path);
  const title = toTitle(slug);
  const folder = getFolderFromPath(path);
  const css: string[] = [];
  if (folder === 'components') {
    const cssText = dieterComponentCssByName.get(slug);
    if (cssText) css.push(cssText);
  }
  return {
    slug,
    title,
    path: buildPagePath(folder, slug),
    htmlPath: path,
    css,
  };
});

export const showcasePages: ShowcasePage[] = staticShowcasePages;

export const showcaseIndex = new Map(showcasePages.map((page) => [page.path, page]));

const pageToNav = (page: ShowcasePage): NavItem => ({
  id: `showcase-${page.slug}`,
  title: page.title,
  path: page.path,
  kind: 'showcase' as const,
});

// Auto-generate nav groups from folder structure
const buildShowcaseGroups = (): NavGroup[] => {
  const folderMap = new Map<string, ShowcasePage[]>();

  // Group pages by folder
  for (const page of staticShowcasePages) {
    const folder = getFolderFromPath(page.htmlPath);
    if (!folderMap.has(folder)) {
      folderMap.set(folder, []);
    }
    folderMap.get(folder)!.push(page);
  }

  return [
    {
      id: 'foundations',
      title: getFolderTitle('foundations'),
      items: (folderMap.get('foundations') ?? []).map(pageToNav),
    },
    {
      id: 'dieter-components',
      title: getFolderTitle('components'),
      items: (folderMap.get('components') ?? []).map(pageToNav),
    },
    {
      id: 'policy',
      title: getFolderTitle('tools'),
      items: (folderMap.get('tools') ?? []).map(pageToNav),
    },
  ].filter((group) => group.items.length > 0);
};

export const navGroups: NavGroup[] = buildShowcaseGroups();

export const navIndex = new Map<string, NavItem>();
navGroups.forEach((group) => {
  group.items.forEach((item) => navIndex.set(item.path, item));
});
