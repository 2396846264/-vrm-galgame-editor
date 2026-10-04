import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { rollupOptions: { input: { index: 'index.html', player: 'player.html', environment: 'environment.html' } } } });
