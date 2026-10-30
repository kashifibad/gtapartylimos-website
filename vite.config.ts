import { build, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export default defineConfig({
  plugins: [react(), {
    name: 'gta-static-route-rendering',
    apply: 'build',
    async writeBundle() {
      // Bolt publishes with `vite build`, so correctness must live in Vite's
      // build lifecycle rather than depend on a package-script post-step.
      // Disable config discovery for the isolated renderer to avoid recursion.
      await build({
        configFile: false,
        plugins: [react()],
        build: { ssr: 'src/entry-server.tsx', outDir: '.prerender', emptyOutDir: true },
      });
      await import(pathToFileURL(resolve('scripts/create-route-files.mjs')).href);
    },
  }],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
