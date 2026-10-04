import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'apps/mobile/src/__tests__/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
  },
});
