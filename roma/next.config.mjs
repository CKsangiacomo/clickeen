import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  typedRoutes: false,
  devIndicators: false,
  transpilePackages: ['@clickeen/bob'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: repoRoot,
  distDir: isDev ? '.next-dev' : '.next',
};

export default nextConfig;
