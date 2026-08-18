export function resolveProductPath(widgetType: string, sourcePath: string): string | null {
  const withoutQuery = sourcePath.split('?')[0];
  if (!withoutQuery || withoutQuery.startsWith('/') || /^https?:\/\//i.test(withoutQuery)) {
    return null;
  }
  const stack = `product/widgets/${widgetType}/`.split('/').filter(Boolean);
  for (const part of withoutQuery.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}
