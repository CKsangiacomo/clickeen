import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: path.join(__dirname, '..'),
  // Remove the Next.js DevTools "N" indicator in development.
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
