export const VALID_COMPOSITIONS = {
  'heading + text + action': 'hero pattern',
  'stack[heading, text, action-group]': 'content block',
  'media + text': 'visual block',
};

export type BlockContract = {
  purpose: string;
  regions: Record<string, string>;
  constraints: Record<string, boolean>;
  variations?: string[];
  aiGuidance?: string;
};

export const BLOCK_CONTRACTS: Record<string, BlockContract> = {
  hero: {
    purpose: 'Page hero section with value proposition',
    regions: {
      content: 'Main content area (title, subtitle, CTAs)',
      visual: 'Supporting visual (widget demo, image, video)',
    },
    constraints: {
      'content should have primary CTA': true,
      'visual enhances but not required': true,
    },
    variations: ['centered', 'left-aligned', 'right-aligned'],
    aiGuidance: 'Use for page introductions, major value propositions',
  },
  split: {
    purpose: 'Two-column layout with content and visual',
    regions: {
      content: 'Narrative copy and actions',
      visual: 'Curated widget or media preview',
    },
    constraints: {
      'content should include CTA group': true,
      'visual can be stacked on mobile': true,
    },
    variations: ['visual-left', 'visual-right', 'stacked'],
  },
  cta: {
    purpose: 'End-of-page conversion block',
    regions: {
      content: 'Short headline and subhead',
      actions: 'Single primary CTA (optional secondary)',
    },
    constraints: {
      'primary CTA should be present': true,
    },
    variations: ['card', 'inline'],
  },
  steps: {
    purpose: 'Explain workflow or benefits in discrete steps',
    regions: {
      header: 'Section heading + subhead',
      steps: 'List of step tiles',
    },
    constraints: {
      'at least 3 steps recommended': true,
    },
  },
  outcomes: {
    purpose: 'Proof points or outcomes grid',
    regions: {
      header: 'Section title (optional)',
      grid: 'Outcome tiles',
    },
    constraints: {
      'grid items should be concise': true,
    },
  },
  minibob: {
    purpose: 'Live editor embed to customize widget',
    regions: {
      header: 'Heading + subhead for the embed',
      iframe: 'Minibob embed surface',
    },
    constraints: {
      'iframe is required': true,
    },
  },
  'big-bang': {
    purpose: 'High-emphasis conversion band',
    regions: {
      content: 'Headline + body',
      actions: 'Primary/secondary CTA group',
    },
    constraints: {
      'headline should be short and punchy': true,
    },
  },
};

export function getBlockContract(type: string): BlockContract | null {
  return BLOCK_CONTRACTS[type] ?? null;
}
