import path from 'node:path';

const nextConfig = {
  // Next 15: typedRoutes moved out of experimental
  typedRoutes: true,

  // Build should not depend on host-machine eslint config resolution.
  // We run lint/typecheck explicitly elsewhere; keep build fast/robust.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Ensure Next doesn't walk up to unrelated workspace roots/lockfiles.
  outputFileTracingRoot: path.join(path.dirname(new URL(import.meta.url).pathname), '..'),
};

export default nextConfig;
