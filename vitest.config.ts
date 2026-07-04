import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Minimal config: resolve the `@/` path alias (mirrors tsconfig) so tests can
// import modules that use it. Per-file `// @vitest-environment jsdom` directives
// still control the environment.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
