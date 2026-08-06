import type { RuntimeMaterializerCompiledWidget, RuntimeMaterializerFileContext } from './types';

export const SOCIAL_SHARE_CSS_MODULE_KEY = 'product/widgets/shared/socialShare.css';
export const SOCIAL_SHARE_RUNTIME_MODULE_KEY = 'product/widgets/shared/socialShare.js';

export function fileSource(file: RuntimeMaterializerFileContext | undefined): string {
  return typeof file?.source === 'string' ? file.source : '';
}

export function resolveProductPath(widgetType: string, src: string): string | null {
  const withoutQuery = src.split('?')[0] || '';
  if (!withoutQuery || withoutQuery.startsWith('/') || /^https?:\/\//i.test(withoutQuery)) return null;
  const base = `product/widgets/${widgetType}/`;
  const stack = base.split('/').filter(Boolean);
  for (const part of withoutQuery.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  const normalized = stack.join('/');
  return normalized.startsWith('product/widgets/') ? normalized : null;
}

export function chunkMarkerId(value: string): string {
  const sourceNeutral = value
    .replace(/^product\/widgets\//, '')
    .replace(/\/widget\./g, '/widget-')
    .replace(/\.\.\//g, '')
    .replace(/^\/+/, '');
  return sourceNeutral.replace(/[^A-Za-z0-9_.:-]+/g, '-');
}

export function packageSource(args: { compiled: RuntimeMaterializerCompiledWidget; key: string }): string {
  return fileSource(args.compiled.widgetPackage.files[args.key]);
}
