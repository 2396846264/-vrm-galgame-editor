import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { editorLanguagePlugin } from './editor-language-plugin.mjs';

const source = "const markup = '<button>保存</button>';";
for (const [file, relative] of [
  ['main.js', './'],
  ['testing/scenario.js', '../'],
  ['editor/panels/example.js', '../../'],
]) {
  const id = fileURLToPath(new URL('../src/' + file, import.meta.url));
  const result = editorLanguagePlugin().transform(source, id);
  assert(result?.code.includes(`from '${relative}editor-language.js'`), file);
}
console.log('PASS: language transforms resolve from root and nested feature folders.');
