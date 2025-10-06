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
  {
    id: 'content.faq',
    name: 'FAQ',
    description: 'Answer common questions to reduce support.',
    defaults: {
      title: 'Frequently Asked Questions',
      items: [
        { q: 'What is Clickeen?', a: 'Embeddable widgets with one line of code.' },
        { q: 'Is there a free plan?', a: 'Yes, one active widget with branding.' },
      ],
    },
  },
  {
    id: 'social.testimonials',
    name: 'Testimonials',
    description: 'Show social proof with customer quotes.',
    defaults: {
      title: 'What our customers say',
      items: [
        { quote: 'Fantastic!', author: 'Alex' },
        { quote: 'So easy to use', author: 'Taylor' },
      ],
    },
  },
  {
    id: 'engagement.announcement',
    name: 'Announcement',
    description: 'Promote news, offers, or launches.',
    defaults: {
      title: 'Announcement',
      message: 'We have something new for you!',
      ctaLabel: 'Learn more',
      ctaHref: '#',
    },
  },
  {
    id: 'engagement.newsletter',
    name: 'Newsletter',
    description: 'Capture email signups for your list.',
    defaults: {
      title: 'Subscribe to our newsletter',
      placeholder: 'you@example.com',
      buttonText: 'Subscribe',
      layout: 'inline',
    },
  },
  {
    id: 'social.proof',
    name: 'Social Proof',
    description: 'Display brand logos to build trust.',
    defaults: {
      title: 'Trusted by great teams',
      logos: [{ alt: 'Company A' }, { alt: 'Company B' }, { alt: 'Company C' }],
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
  // FAQ
  {
    id: 'faq-list',
    widgetType: 'content.faq',
    name: 'List',
    premium: false,
    schemaVersion: '2025-09-01',
    preview: 'https://static.clickeen.com/templates/faq/list.png',
    descriptor: { layout: 'LIST', skin: 'MINIMAL', density: 'COZY' },
  },
  // Testimonials
  {
    id: 'testimonials-grid',
    widgetType: 'social.testimonials',
    name: 'Grid',
    premium: false,
    schemaVersion: '2025-09-01',
    preview: 'https://static.clickeen.com/templates/testimonials/grid.png',
    descriptor: { layout: 'GRID', skin: 'SOFT', density: 'COMPACT' },
  },
  // Announcement/Promo
  {
    id: 'announcement-banner',
    widgetType: 'engagement.announcement',
    name: 'Banner',
    premium: false,
    schemaVersion: '2025-09-01',
    preview: 'https://static.clickeen.com/templates/announcement/banner.png',
    descriptor: { layout: 'INLINE', skin: 'SHARP', density: 'COZY' },
  },
  // Newsletter
  {
    id: 'newsletter-inline',
    widgetType: 'engagement.newsletter',
    name: 'Inline',
    premium: false,
    schemaVersion: '2025-09-01',
    preview: 'https://static.clickeen.com/templates/newsletter/inline.png',
    descriptor: { layout: 'INLINE', skin: 'MINIMAL', density: 'COZY' },
  },
  // Social Proof
  {
    id: 'logos-grid',
    widgetType: 'social.proof',
    name: 'Logos Grid',
    premium: false,
    schemaVersion: '2025-09-01',
    preview: 'https://static.clickeen.com/templates/social/logos-grid.png',
    descriptor: { layout: 'GRID', skin: 'MINIMAL', density: 'COMPACT' },
  },
];

export function getWidgets() {
  return WIDGET_CATALOG;
}

export function getTemplates(widgetType?: string) {
  if (!widgetType) return TEMPLATE_CATALOG;
  return TEMPLATE_CATALOG.filter((template) => template.widgetType === widgetType);
}
