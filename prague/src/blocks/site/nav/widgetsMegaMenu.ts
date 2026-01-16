import { listWidgets, loadRequiredWidgetPageJsonForLocale } from '../../../lib/markdown';

export type WidgetsMegaMenuItem = {
  widget: string;
  href: string;
  title: string;
  description: string;
};

export async function resolveWidgetsMegaMenu(params: { locale: string }) {
  const { locale } = params;
  const widgets = await listWidgets();

  const items: WidgetsMegaMenuItem[] = [];
  for (const widget of widgets) {
    const overview = await loadRequiredWidgetPageJsonForLocale({ widget, page: 'overview', locale });
    const blocks = Array.isArray((overview as any)?.blocks) ? (overview as any).blocks : null;
    const navmeta = blocks ? blocks.find((b: any) => b && b.id === 'navmeta' && b.type === 'navmeta') : null;
    const copy = navmeta && typeof navmeta === 'object' ? (navmeta as any).copy : null;
    const title = copy && typeof copy === 'object' ? String((copy as any).title ?? '') : '';
    const description = copy && typeof copy === 'object' ? String((copy as any).description ?? '') : '';
    if (!title || !description) {
      throw new Error(`[prague] Invalid tokyo/widgets/${widget}/pages/overview.json (navmeta.copy.title/description required)`);
    }
    items.push({
      widget,
      href: `/${locale}/widgets/${widget}`,
      title,
      description,
    });
  }

  return {
    allWidgetsHref: `/${locale}/widgets/`,
    items,
  };
}

