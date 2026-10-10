import { defineConfig } from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({ base: './', resolve:{alias:[{find:'@noname0310/mmd-parser',replacement:fileURLToPath(new URL('./src/mmd-parser-compat.js',import.meta.url))},{find:/^ammojs-typed$/,replacement:fileURLToPath(new URL('./src/ammo-wasm-compat.js',import.meta.url))}]}, build: { rollupOptions: { input: { index: 'index.html', player: 'player.html', environment: 'environment.html' } } } });
