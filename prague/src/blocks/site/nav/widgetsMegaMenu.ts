import { listWidgets, loadWidgetPageMarkdown, parseMarkdownSections } from '../../../lib/markdown';

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
    const md = await loadWidgetPageMarkdown({ widget, page: 'landing' });
    const sections = parseMarkdownSections(md);
    const headline = sections.get('headline') ?? widget;
    const subheadline = sections.get('subheadline') ?? '';
    items.push({
      widget,
      href: `/${locale}/widgets/${widget}`,
      headline,
      subheadline,
    });
  }

  return {
    allWidgetsHref: `/${locale}/`,
    items,
  };
}


