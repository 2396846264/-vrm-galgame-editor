import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
function copyTree(source, target, accept = () => true) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.isDirectory()) copyTree(`${source}/${entry.name}`, `${target}/${entry.name}`, accept);
    else if (accept(entry.name)) copyFileSync(`${source}/${entry.name}`, `${target}/${entry.name}`);
  }
}
mkdirSync('dist/pdf-resources', { recursive: true });
for (const name of ['cmaps', 'standard_fonts', 'wasm']) {
  // Windows supplies standard Latin fonts; the reader never enables PDF scripting.
  copyTree(`node_modules/pdfjs-dist/${name}`, `dist/pdf-resources/${name}`,
    file => !/^Liberation|^LICENSE_LIBERATION$|^quickjs-/i.test(file));
  if (!readdirSync(`dist/pdf-resources/${name}`).length) throw new Error(`PDF resource missing: ${name}`);
}
copyTree('public/fonts', 'dist/fonts');
console.log('Approved offline PDF resources and application fonts copied.');
copyFileSync('node_modules/pdfjs-dist/LICENSE', 'dist/pdf-resources/PDF.js-LICENSE');
