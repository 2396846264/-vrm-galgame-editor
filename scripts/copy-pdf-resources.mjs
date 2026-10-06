import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
function copyTree(source, target) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.isDirectory()) copyTree(`${source}/${entry.name}`, `${target}/${entry.name}`);
    else copyFileSync(`${source}/${entry.name}`, `${target}/${entry.name}`);
  }
}
mkdirSync('dist/pdf-resources', { recursive: true });
for (const name of ['cmaps', 'standard_fonts', 'wasm']) {
  copyTree(`node_modules/pdfjs-dist/${name}`, `dist/pdf-resources/${name}`);
  if (!readdirSync(`dist/pdf-resources/${name}`).length) throw new Error(`PDF resource missing: ${name}`);
}
console.log('Offline PDF fonts and decoders copied.');
copyFileSync('node_modules/pdfjs-dist/LICENSE', 'dist/pdf-resources/PDF.js-LICENSE');
