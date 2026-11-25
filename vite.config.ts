/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  // Относительный base нужен, чтобы сборка работала и в WebView Capacitor, и на любом пути хостинга.
  base: './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // PixiJS — самый тяжёлый модуль, держим его отдельным чанком: он грузится только на экране боя.
        manualChunks(id: string) {
          if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi')) return 'pixi';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
