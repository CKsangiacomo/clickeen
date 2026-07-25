import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const isDev = process.env.NODE_ENV !== 'production';

// Tokyo is the canonical home of Dieter artifacts (CONTEXT.md Current
// Authorities). The compiled Builder control media is emitted as same-origin
// relative URLs (/dieter/...). Bob serves these on its own origin; Roma hosts
// the Builder cross-origin via iframe, so Roma itself never needed them. Surfaces
// that hydrate compiled controls on Roma's origin (Settings > Widget Defaults)
// need them same-origin here, so proxy /dieter/* to Tokyo. No /widgets/* proxy:
// those are widget-preview files and the defaults surface renders controls, not
// previews.
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
      { source: '/dieter/:path*', destination: `${tokyoBase}/dieter/:path*` },
    ];
  },
};

export default nextConfig;
