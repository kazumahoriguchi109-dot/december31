import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative asset URLs: works under any path, including https://<owner>.github.io/<repo>/
  // evidence files written by tests (screenshots, measurements) must never make the dev server reload a page mid-test
  server: { watch: { ignored: ['**/handoff/**', '**/test-results/**'] } },
  build: { target: 'es2022', sourcemap: false },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
} as never);
