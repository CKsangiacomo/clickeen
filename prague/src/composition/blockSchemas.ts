export type BlockSchema = {
  type: string;
  layout?: string;
  regions: Record<string, string[]>;
  defaults?: Record<string, unknown>;
};

export const BLOCK_SCHEMAS: Record<string, BlockSchema> = {
  hero: {
    type: 'hero',
    layout: 'split-center',
    regions: {
      content: ['heading', 'text', 'action-group'],
      visual: ['media'],
    },
    defaults: {
      layout: { gap: 'large', alignment: 'center' },
    },
  },
  split: {
    type: 'split',
    layout: 'visual-right',
    regions: {
      content: ['heading', 'text', 'action-group'],
      visual: ['media'],
    },
    defaults: {
      layout: { gap: 'large', alignment: 'center' },
    },
  },
  cta: {
    type: 'cta',
    regions: {
      content: ['heading', 'text'],
      actions: ['action-group'],
    },
  },
  steps: {
    type: 'steps',
    regions: {
      header: ['heading', 'text'],
      steps: ['stack'],
    },
  },
  outcomes: {
    type: 'outcomes',
    regions: {
      header: ['heading'],
      grid: ['grid'],
    },
  },
  minibob: {
    type: 'minibob',
    regions: {
      header: ['heading', 'text'],
      iframe: ['media'],
    },
  },
  'big-bang': {
    type: 'big-bang',
    regions: {
      content: ['heading', 'text'],
      actions: ['action-group'],
    },
  },
};
