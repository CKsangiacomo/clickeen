import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  typedRoutes: true,
  // Remove the Next.js DevTools "N" indicator in development.
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Avoid Next picking the wrong workspace root due to stray lockfiles.
  outputFileTracingRoot: repoRoot,
  // Keep dev/prod artifacts isolated to prevent stale chunk mismatches.
  distDir: isDev ? '.next-dev' : '.next',
};

export default nextConfig;
