import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const isDev = process.env.NODE_ENV !== 'production';

// Dieter source is compiled with Roma. Only icon SVG bytes come from Tokyo.
const tokyoBase = (
  process.env.NEXT_PUBLIC_TOKYO_URL ??
  process.env.TOKYO_URL ??
  process.env.TOKYO_BASE_URL ??
  ''
)
  .trim()
  .replace(/\/+$/, '');

const nextConfig = {
  typedRoutes: false,
  devIndicators: false,
  transpilePackages: ['@clickeen/bob'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: repoRoot,
  distDir: isDev ? '.next-dev' : '.next',
  async rewrites() {
    if (!tokyoBase) return [];
    return [
      {
        source: '/dieter/icons/svg/:icon',
        destination: `${tokyoBase}/dieter/icons/svg/:icon`,
      },
    ];
  },
};

export default nextConfig;
