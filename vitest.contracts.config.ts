import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@roma': path.resolve(__dirname, 'roma'),
      '@clickeen/ck-contracts': path.resolve(__dirname, 'packages/ck-contracts/src/index.js'),
      '@clickeen/ck-policy': path.resolve(__dirname, 'packages/ck-policy/src/index.ts'),
      '@clickeen/l10n/locales.json': path.resolve(__dirname, 'packages/l10n/locales.json'),
      '@clickeen/l10n': path.resolve(__dirname, 'packages/l10n/src/index.ts'),
      '@venice': path.resolve(__dirname, 'venice'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/contracts/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true,
    server: {
      deps: {
        inline: ['@clickeen/ck-contracts', '@clickeen/ck-policy', '@clickeen/l10n'],
      },
    },
  },
});
