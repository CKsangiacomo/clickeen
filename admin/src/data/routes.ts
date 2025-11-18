import { dieterComponentCssByName } from './dieterComponents';

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

// Auto-discover HTML files from all folders
const staticShowcaseModules = import.meta.glob('../html/**/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

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

const getFolderTitle = (folder: string): string => {
  if (folder === 'dieter') return 'Dieter Components';
  if (folder === 'components') return 'Dieter Components';
  if (folder === 'tools') return 'Tools';
  return folder.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

// Build showcase pages from discovered files
const staticShowcasePaths = Object.keys(staticShowcaseModules).sort();
const slugTitleOverrides: Record<string, string> = {
  'bob-ui-native': 'Bob UI Native',
};

const staticShowcasePages: ShowcasePage[] = staticShowcasePaths.map((path) => {
  const slug = toSlug(path);
  const title = slugTitleOverrides[slug] ?? toTitle(slug);
  const folder = getFolderFromPath(path);
  const css: string[] = [];
  if (folder === 'components') {
    const cssText = dieterComponentCssByName.get(slug);
    if (cssText) css.push(cssText);
  }
  return {
    slug,
    title,
    path: `#/dieter/${slug}`,
    htmlPath: path,
    css,
  };
});

export const showcasePages: ShowcasePage[] = staticShowcasePages;

export const showcaseIndex = new Map(showcasePages.map((page) => [page.slug, page]));

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

  // Convert to nav groups with specific order
  const groups: NavGroup[] = [];
  const folderOrder = ['tools', 'components', 'dieter', 'foundations'];
  const foundationSlugs = new Set(['colors', 'typography', 'icons']);

  const foundationItems: NavItem[] = [];

  for (const folder of folderOrder) {
    const pages = folderMap.get(folder);
    if (pages) {
      if (folder === 'dieter') {
        const foundationPages = pages.filter((page) => foundationSlugs.has(page.slug));
        const componentPages = pages.filter((page) => !foundationSlugs.has(page.slug));

        if (componentPages.length > 0) {
          groups.push({
            id: 'dieter-full-library',
            title: getFolderTitle(folder),
            items: componentPages.map(pageToNav),
          });
        }
        foundationItems.push(...foundationPages.map(pageToNav));
      } else if (folder === 'foundations') {
        foundationItems.push(...pages.map(pageToNav));
      } else {
        groups.push({
          id: folder.toLowerCase().replace(/_/g, '-'),
          title: getFolderTitle(folder),
          items: pages.map(pageToNav),
        });
      }
    }
  }

  if (foundationItems.length > 0) {
    groups.push({
      id: 'foundations',
      title: 'Foundations',
      items: foundationItems,
    });
  }

  return groups;
};

export const navGroups: NavGroup[] = buildShowcaseGroups();

export const navIndex = new Map<string, NavItem>();
navGroups.forEach((group) => {
  group.items.forEach((item) => navIndex.set(item.path, item));
});
