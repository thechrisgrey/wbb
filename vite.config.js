import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// <!--@include path/to/file.html--> is replaced with the file's contents at build and dev time,
// so every section lives in its own folder but ships as static HTML.
function htmlIncludes() {
  const pattern = /<!--\s*@include\s+([^\s]+)\s*-->/g;
  const expand = (html, depth = 0) =>
    depth > 4 ? html : html.replace(pattern, (_, file) => expand(readFileSync(resolve(file), 'utf8'), depth + 1));
  return {
    name: 'html-includes',
    transformIndexHtml: { order: 'pre', handler: (html) => expand(html) },
    handleHotUpdate({ file, server }) {
      if (file.endsWith('template.html')) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: './',
  plugins: [htmlIncludes()],
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    rollupOptions: {
      input: command === 'build' ? { main: resolve('index.html') } : undefined,
      output: { manualChunks: { three: ['three'], gsap: ['gsap'] } },
    },
  },
}));
