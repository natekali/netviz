import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Relative base so the built site works at any path (e.g. GitHub Pages
// project sites served from /<repo>/). Two pages: the landing (index.html)
// and the tool (tool.html). network.json is fetched at runtime from /public.
export default defineConfig({
  base: './',
  server: { open: true },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        tool: fileURLToPath(new URL('./tool.html', import.meta.url)),
      },
    },
  },
});
