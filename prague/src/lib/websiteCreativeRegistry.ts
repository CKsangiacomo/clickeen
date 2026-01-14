// Prague owns the canonical website creative slot taxonomy.
//
// Deterministic identity contract:
// - creativeKey = {widgetType}.{page}.{slot}
// - publicId    = wgt_curated_{creativeKey}                  (locale-free; locale is a runtime parameter)
//
// Example:
//   creativeKey = faq.overview.hero
//   publicId    = wgt_curated_faq.overview.hero
//
// Evolution policy:
// - Growth is additive: add new pages/slots as the website expands.
// - Never rename or remove shipped slot keys (doing so breaks deterministic IDs and embeds).

export const CREATIVE_PAGES = ['overview', 'templates', 'examples', 'features'] as const;
export type CreativePage = (typeof CREATIVE_PAGES)[number];

export const CREATIVE_SLOTS_BY_PAGE: Record<CreativePage, readonly string[]> = {
  // v1: only overview slots are defined.
  overview: ['hero', 'features'] as const,
  templates: [] as const,
  examples: [] as const,
  features: [] as const,
} as const;
