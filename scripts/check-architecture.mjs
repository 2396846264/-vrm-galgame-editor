import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rollup/parseAst';

const root = fileURLToPath(new URL('../', import.meta.url));
const baseline = JSON.parse(
  fs.readFileSync(new URL('./architecture-baseline.json', import.meta.url), 'utf8'),
);
const errors = [],
  graph = new Map();
const files = fs
  .readdirSync(path.join(root, 'src'), { recursive: true })
  .map((file) => 'src/' + file.replaceAll('\\', '/'))
  .filter((file) => file.endsWith('.js') && !file.startsWith('src/vendor/'));
function imports(node, result = []) {
  if (!node || typeof node !== 'object') return result;
  if (node.type === 'ImportDeclaration') result.push({ source: node.source.value, dynamic: false });
  if (node.type === 'ImportExpression' && typeof node.source.value === 'string')
    result.push({ source: node.source.value, dynamic: true });
  for (const value of Object.values(node))
    if (Array.isArray(value)) value.forEach((child) => imports(child, result));
    else if (value && typeof value === 'object') imports(value, result);
  return result;
}
for (const file of files) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  let ast;
  try {
    ast = parseAst(code);
  } catch (error) {
    errors.push(`${file}: ${error.message}`);
    continue;
  }
  const dependencies = imports(ast)
    .filter((item) => item.source.startsWith('.'))
    .map((item) => ({
      ...item,
      target: path.posix.normalize(path.posix.join(path.posix.dirname(file), item.source.split('?')[0])),
    }));
  graph.set(
    file,
    dependencies
      .filter((item) => !item.dynamic && item.target.endsWith('.js'))
      .map((item) => item.target),
  );
  for (const dependency of dependencies) {
    if (!fs.existsSync(path.join(root, dependency.target)))
      errors.push(`${file}: missing ${dependency.target}`);
    if (dependency.target === 'src/main.js')
      errors.push(`${file}: modules must not import the application entry`);
    if (
      !file.startsWith('src/testing/') &&
      file !== 'src/main.js' &&
      dependency.target.startsWith('src/testing/')
    )
      errors.push(`${file}: production module imports test scenarios`);
    if (
      file === 'src/main.js' &&
      !dependency.dynamic &&
      dependency.target.startsWith('src/testing/') &&
      !['src/testing/smoke-loader.js', 'src/testing/diagnostics-smoke.js'].includes(
        dependency.target,
      )
    )
      errors.push(`${file}: scenarios must load on demand`);
  }
  if (file.startsWith('src/testing/') || /-smoke\.js$/.test(file)) continue;
  const bytes = Buffer.byteLength(code),
    lines = code.split(/\r?\n/).length;
  const limits = baseline.files[file] || { bytes: 40 * 1024, lines: 800 };
  if (bytes > limits.bytes || lines > limits.lines)
    errors.push(
      `${file}: exceeds size budget (${bytes} bytes, ${lines} lines); extract a responsibility`,
    );
}
const visiting = new Set(),
  visited = new Set();
function visit(file, stack = []) {
  if (visiting.has(file)) {
    errors.push('Static dependency cycle: ' + [...stack, file].join(' -> '));
    return;
  }
  if (visited.has(file)) return;
  visiting.add(file);
  for (const dependency of graph.get(file) || []) visit(dependency, [...stack, file]);
  visiting.delete(file);
  visited.add(file);
}
for (const file of graph.keys()) visit(file);
const partials = fs
  .readdirSync(path.join(root, 'Desktop'), { recursive: true })
  .filter((file) => file.endsWith('.cs') && !/(^|[\\/])(bin|obj)[\\/]/.test(file))
  .filter((file) =>
    /partial class EditorWindow/.test(fs.readFileSync(path.join(root, 'Desktop', file), 'utf8')),
  );
if (partials.length > baseline.editorWindowPartialFiles)
  errors.push('Do not add another EditorWindow partial; use an independent service');
for (const [file, limit] of Object.entries(baseline.desktopFiles))
  if (fs.statSync(path.join(root, file)).size > limit)
    errors.push(`${file}: exceeds the existing class size budget`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `PASS: ${files.length} JavaScript modules parsed; imports, static cycles, size budgets and desktop class growth checked.`,
  );
