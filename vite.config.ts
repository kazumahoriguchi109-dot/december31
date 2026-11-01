import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative asset URLs: works under any path, including https://<owner>.github.io/<repo>/
  build: { target: 'es2022', sourcemap: false },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
} as never);
