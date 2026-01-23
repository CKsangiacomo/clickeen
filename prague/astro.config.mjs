import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
  vite: {
    ssr: {
      noExternal: ['@clickeen/composition'],
    },
    optimizeDeps: {
      exclude: ['@clickeen/composition'],
    },
  },
});
