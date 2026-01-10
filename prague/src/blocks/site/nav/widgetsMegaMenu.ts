import { listWidgets, loadRequiredWidgetPageJsonForLocale } from '../../../lib/markdown';

export type WidgetsMegaMenuItem = {
  widget: string;
  href: string;
  headline: string;
  subheadline: string;
};

export async function resolveWidgetsMegaMenu(params: { locale: string }) {
  const { locale } = params;
  const widgets = await listWidgets();

  const items: WidgetsMegaMenuItem[] = [];
  for (const widget of widgets) {
    const overview = await loadRequiredWidgetPageJsonForLocale({ widget, page: 'overview', locale });
    const blocks = Array.isArray((overview as any)?.blocks) ? (overview as any).blocks : null;
    const hero = blocks ? blocks.find((b: any) => b && b.id === 'hero' && b.kind === 'hero') : null;
    const copy = hero && typeof hero === 'object' ? (hero as any).copy : null;
    const headline = copy && typeof copy === 'object' ? String((copy as any).headline ?? '') : '';
    const subheadline = copy && typeof copy === 'object' ? String((copy as any).subheadline ?? '') : '';
    if (!headline || !subheadline) {
      throw new Error(`[prague] Invalid tokyo/widgets/${widget}/pages/overview.json (hero.copy.headline/subheadline required)`);
    }
    items.push({
      widget,
      href: `/${locale}/widgets/${widget}`,
      headline,
      subheadline,
    });
  }

  return {
    allWidgetsHref: `/${locale}/widgets/`,
    items,
  };
}


