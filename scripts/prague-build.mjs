import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function toPosix(p) {
  return p.split(path.sep).join('/');
}

const files = await glob('tokyo/widgets/*/pages/**/*.md', { cwd: repoRoot, nodir: true });

const pages = files
  .map((file) => {
    const parts = toPosix(file).split('/');
    const widget = parts[2];
    const slug = parts.at(-1).replace(/\.md$/, '');
    return { widget, slug, file };
  })
  .sort((a, b) => (a.widget === b.widget ? a.slug.localeCompare(b.slug) : a.widget.localeCompare(b.widget)));

console.log(`[prague-build] Found ${pages.length} markdown files under tokyo/widgets/*/pages`);

for (const p of pages) {
  if (p.slug === 'landing') {
    console.log(`- /{locale}/widgets/${p.widget}  <- ${p.file}`);
  } else {
    console.log(`- /{locale}/widgets/${p.widget}/${p.slug}  <- ${p.file}`);
  }
}

console.log('');
console.log('[prague-build] Prague output is produced by `pnpm build:prague` (Astro static build).');

