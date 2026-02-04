import { assertSplitLayout } from '@clickeen/composition';
import Cta from '../blocks/cta/cta.astro';
import BigBang from '../blocks/big-bang/big-bang.astro';
import Hero from '../blocks/hero/hero.astro';
import Minibob from '../blocks/minibob/minibob.astro';
import Split from '../blocks/split/split.astro';
import Steps from '../blocks/steps/steps.astro';

type StringType = 'string' | 'array';
type RequiredString = { key: string; type: StringType };

export type BlockType =
  | 'big-bang'
  | 'hero'
  | 'split'
  | 'steps'
  | 'cta-bottom-block'
  | 'minibob'
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
    meta: ['visual'],
  },
  'cta-bottom-block': {
    type: 'cta-bottom-block',
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
  const allowed = new Set(['id', 'type', 'copy', ...contract.meta]);
  for (const key of Object.keys(block)) {
    if (!allowed.has(key)) {
      throw new Error(`[prague] ${pagePath}: block "${type}" contains unsupported field "${key}"`);
    }
  }
  if (contract.meta.includes('visual') && block.visual != null) {
    if (typeof block.visual !== 'boolean' && typeof block.visual !== 'object') {
      throw new Error(`[prague] ${pagePath}: block "${type}" visual must be boolean or object`);
    }
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

  if (blockType === 'steps') {
    const items = (strings as any).items;
    if (!Array.isArray(items)) {
      throw new Error(`[prague] ${pagePath}: block "${blockId}" missing array "items"`);
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}] must be an object`);
      }
      const title = (item as any).title;
      const body = (item as any).body;
      if (typeof title !== 'string') {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].title must be a string`);
      }
      if (typeof body !== 'string') {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].body must be a string`);
      }

      const iconEnabled = (item as any).iconEnabled;
      if (iconEnabled != null && typeof iconEnabled !== 'boolean') {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].iconEnabled must be boolean`);
      }
      const iconName = (item as any).iconName;
      if (iconName != null && typeof iconName !== 'string') {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].iconName must be a string`);
      }
      const legacyIcon = (item as any).icon;
      if (legacyIcon != null && typeof legacyIcon !== 'string') {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].icon must be a string`);
      }

      const backgroundEnabled = (item as any).backgroundEnabled;
      if (backgroundEnabled != null && typeof backgroundEnabled !== 'boolean') {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].backgroundEnabled must be boolean`);
      }
      const backgroundPath = (item as any).backgroundPath;
      if (backgroundPath != null && typeof backgroundPath !== 'string') {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].backgroundPath must be a string`);
      }
      const legacyBackground = (item as any).background;
      if (legacyBackground != null && typeof legacyBackground !== 'string') {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].background must be a string`);
      }

      const imageEnabled = (item as any).imageEnabled;
      if (imageEnabled != null && typeof imageEnabled !== 'boolean') {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].imageEnabled must be boolean`);
      }
      const imagePath = (item as any).imagePath;
      if (imagePath != null && typeof imagePath !== 'string') {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].imagePath must be a string`);
      }
      const legacyImage = (item as any).image;
      if (legacyImage != null && typeof legacyImage !== 'string') {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].image must be a string`);
      }
      const imageAlt = (item as any).imageAlt;
      if (imageAlt != null && typeof imageAlt !== 'string') {
        throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].imageAlt must be a string`);
      }

      const imageLayout = (item as any).imageLayout;
      if (imageLayout != null) {
        if (typeof imageLayout !== 'string') {
          throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].imageLayout must be a string`);
        }
        const value = imageLayout.trim();
        if (value !== 'inset' && value !== 'bleed') {
          throw new Error(
            `[prague] ${pagePath}: block "${blockId}" items[${i}].imageLayout must be "inset" or "bleed"`,
          );
        }
      }

      const imageFit = (item as any).imageFit;
      if (imageFit != null) {
        if (typeof imageFit !== 'string') {
          throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].imageFit must be a string`);
        }
        const value = imageFit.trim();
        if (value !== 'cover' && value !== 'contain') {
          throw new Error(
            `[prague] ${pagePath}: block "${blockId}" items[${i}].imageFit must be "cover" or "contain"`,
          );
        }
      }

      const imagePositionY = (item as any).imagePositionY;
      if (imagePositionY != null) {
        if (typeof imagePositionY !== 'string') {
          throw new Error(`[prague] ${pagePath}: block "${blockId}" items[${i}].imagePositionY must be a string`);
        }
        const value = imagePositionY.trim();
        if (value !== 'top' && value !== 'center' && value !== 'bottom') {
          throw new Error(
            `[prague] ${pagePath}: block "${blockId}" items[${i}].imagePositionY must be "top", "center", or "bottom"`,
          );
        }
      }
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
