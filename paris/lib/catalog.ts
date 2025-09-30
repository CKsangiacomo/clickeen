export interface WidgetCatalogEntry {
  id: string;
  name: string;
  description: string;
  defaults: Record<string, unknown>;
}

export interface TemplateCatalogEntry {
  id: string;
  widgetType: string;
  name: string;
  premium: boolean;
  schemaVersion: string;
  preview: string;
  descriptor: Record<string, unknown>;
}

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    id: 'forms.contact',
    name: 'Contact Form',
    description: 'Collect leads and messages from visitors.',
    defaults: {
      title: 'Contact Us',
      fields: {
        name: true,
        email: true,
        message: true,
      },
      successMessage: 'Thanks for reaching out! We will get back to you shortly.',
    },
  },
];

export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  {
    id: 'classic-light',
    widgetType: 'forms.contact',
    name: 'Classic Light',
    premium: false,
    schemaVersion: '2025-09-01',
    preview: 'https://static.clickeen.com/templates/forms/classic-light.png',
    descriptor: {
      layout: 'stacked',
      skin: 'MINIMAL',
      density: 'COZY',
    },
  },
  {
    id: 'minimal-dark',
    widgetType: 'forms.contact',
    name: 'Minimal Dark',
    premium: true,
    schemaVersion: '2025-09-01',
    preview: 'https://static.clickeen.com/templates/forms/minimal-dark.png',
    descriptor: {
      layout: 'CARD',
      skin: 'SOFT',
      density: 'COMPACT',
    },
  },
];

export function getWidgets() {
  return WIDGET_CATALOG;
}

export function getTemplates(widgetType?: string) {
  if (!widgetType) return TEMPLATE_CATALOG;
  return TEMPLATE_CATALOG.filter((template) => template.widgetType === widgetType);
}
