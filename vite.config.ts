import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import growthNativeBlog from './growth-native-blog-plugin.mjs';

export default defineConfig({
  plugins: [react(), growthNativeBlog()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
