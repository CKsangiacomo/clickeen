import { assertSplitLayout } from '@clickeen/composition';
import Cta from '../blocks/cta/cta.astro';
import BigBang from '../blocks/big-bang/big-bang.astro';
import Hero from '../blocks/hero/hero.astro';
import Minibob from '../blocks/minibob/minibob.astro';
import Outcomes from '../blocks/outcomes/outcomes.astro';
import Split from '../blocks/split/split.astro';
import Steps from '../blocks/steps/steps.astro';

type StringType = 'string' | 'array';
type RequiredString = { key: string; type: StringType };

export type BlockType =
  | 'big-bang'
  | 'hero'
  | 'split'
  | 'steps'
  | 'cta'
  | 'minibob'
  | 'outcomes'
  | 'navmeta'
  | 'page-meta';

type BlockContract = {
  type: BlockType;
  component?: any;
  required: RequiredString[];
  meta: string[];
  nonVisual?: boolean;
};

const BLOCK_REGISTRY: Record<BlockType, BlockContract> = {
  'big-bang': {
    type: 'big-bang',
    component: BigBang,
    required: [
      { key: 'headline', type: 'string' },
      { key: 'body', type: 'string' },
    ],
    meta: [],
  },
  hero: {
    type: 'hero',
    component: Hero,
    required: [
      { key: 'headline', type: 'string' },
      { key: 'subheadline', type: 'string' },
    ],
    meta: ['visual', 'curatedRef'],
  },
  split: {
    type: 'split',
    component: Split,
    required: [
      { key: 'headline', type: 'string' },
      { key: 'subheadline', type: 'string' },
    ],
    meta: ['curatedRef', 'layout', 'copy'],
  },
  steps: {
    type: 'steps',
    component: Steps,
    required: [
      { key: 'title', type: 'string' },
      { key: 'items', type: 'array' },
    ],
    meta: [],
  },
  cta: {
    type: 'cta',
    component: Cta,
    required: [
      { key: 'headline', type: 'string' },
      { key: 'subheadline', type: 'string' },
    ],
    meta: ['copy', 'primaryCta'],
  },
  minibob: {
    type: 'minibob',
    component: Minibob,
    required: [
      { key: 'heading', type: 'string' },
      { key: 'subhead', type: 'string' },
    ],
    meta: ['copy'],
  },
  outcomes: {
    type: 'outcomes',
    component: Outcomes,
    required: [],
    meta: [],
  },
  navmeta: {
    type: 'navmeta',
    required: [
      { key: 'title', type: 'string' },
      { key: 'description', type: 'string' },
    ],
    meta: [],
    nonVisual: true,
  },
  'page-meta': {
    type: 'page-meta',
    required: [
      { key: 'title', type: 'string' },
      { key: 'description', type: 'string' },
    ],
    meta: [],
    nonVisual: true,
  },
};

export function getBlockContract(type: string): BlockContract {
  const contract = (BLOCK_REGISTRY as Record<string, BlockContract>)[type];
  if (!contract) {
    throw new Error(`[prague] Unknown block type "${type}" (register it in blockRegistry)`);
  }
  return contract;
}

export function validateBlockMeta(args: { block: Record<string, unknown>; pagePath: string }) {
  const { block, pagePath } = args;
  const type = typeof block.type === 'string' ? block.type : '';
  if (!type) throw new Error(`[prague] ${pagePath}: block.type is required`);
  const contract = getBlockContract(type);
  const allowed = new Set(['id', 'type', ...contract.meta]);
  for (const key of Object.keys(block)) {
    if (!allowed.has(key)) {
      throw new Error(`[prague] ${pagePath}: block "${type}" contains unsupported field "${key}"`);
    }
  }
  if (contract.meta.includes('visual') && block.visual != null && typeof block.visual !== 'boolean') {
    throw new Error(`[prague] ${pagePath}: block "${type}" visual must be boolean`);
  }
  if (contract.meta.includes('curatedRef') && block.curatedRef != null) {
    if (typeof block.curatedRef !== 'object' || Array.isArray(block.curatedRef)) {
      throw new Error(`[prague] ${pagePath}: block "${type}" curatedRef must be an object`);
    }
    const publicId = (block.curatedRef as { publicId?: unknown }).publicId;
    if (publicId != null && typeof publicId !== 'string') {
      throw new Error(`[prague] ${pagePath}: block "${type}" curatedRef.publicId must be a string`);
    }
  }
  if (contract.meta.includes('layout') && (block as any).layout != null) {
    assertSplitLayout((block as any).layout, `${pagePath}:${type}.layout`);
  }
}

export function validateBlockStrings(args: { blockType: string; strings: Record<string, unknown>; pagePath: string; blockId: string }) {
  const { blockType, strings, pagePath, blockId } = args;
  const contract = getBlockContract(blockType);
  for (const requirement of contract.required) {
    const value = (strings as any)[requirement.key];
    if (requirement.type === 'string' && typeof value !== 'string') {
      throw new Error(`[prague] ${pagePath}: block "${blockId}" missing string "${requirement.key}"`);
    }
    if (requirement.type === 'array' && !Array.isArray(value)) {
      throw new Error(`[prague] ${pagePath}: block "${blockId}" missing array "${requirement.key}"`);
    }
  }
}

export function isNonVisualBlock(type: string): boolean {
  return Boolean(getBlockContract(type).nonVisual);
}

export function getBlockComponent(type: string) {
  const contract = getBlockContract(type);
  if (contract.nonVisual) return null;
  if (!contract.component) {
    throw new Error(`[prague] Block type "${type}" has no component mapping`);
  }
  return contract.component;
}
