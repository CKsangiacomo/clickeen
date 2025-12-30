const nextConfig = {
  typedRoutes: true,
  // Prevent `next build` from clobbering a running `next dev` instance.
  // In local dev we run with `NEXT_DIST_DIR=.next-dev` (see bob/package.json).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Remove the Next.js DevTools "N" indicator in development.
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
