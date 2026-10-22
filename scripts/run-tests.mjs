import { readdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// These three checks require separately supplied character/motion files.
// Keep the default source suite identical locally and in CI.
const fixtureChecks = new Set([
  'test-white-motion72.mjs',
  'test-white73.mjs',
  'test-anon-secondary.mjs',
]);
const scripts = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../', import.meta.url));
const all = readdirSync(scripts)
  .filter((name) => /^test-.*\.mjs$/.test(name))
  .sort();
const withFixtures = process.argv.includes('--with-fixtures');
const fixtureOption = process.argv.indexOf('--fixtures');
const fixturePath =
  fixtureOption >= 0 ? process.argv[fixtureOption + 1] : process.env.VRMGALGAME_TEST_FIXTURES;
let fixtureArguments = {};
if (withFixtures) {
  if (!fixturePath)
    throw new Error(
      'Provide --fixtures <JSON path> or VRMGALGAME_TEST_FIXTURES; see docs/DEVELOPMENT.md.',
    );
  fixtureArguments = JSON.parse(readFileSync(fixturePath, 'utf8'));
  for (const file of fixtureChecks) {
    const args = fixtureArguments[file];
    if (
      !Array.isArray(args) ||
      !args.length ||
      args.some((value) => typeof value !== 'string' || !value)
    )
      throw new Error('Missing external fixture arguments for ' + file);
  }
}
const files = all.filter((name) => withFixtures || !fixtureChecks.has(name));
let failures = 0;
for (const file of files) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scripts + file, ...(fixtureArguments[file] || [])], {
      cwd: root,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code));
  });
  if (code !== 0) {
    failures++;
    console.error('FAIL:', file);
  }
}
console.log(`Source checks: ${files.length - failures}/${files.length} passed.`);
if (!withFixtures) console.log('External fixture checks excluded:', [...fixtureChecks].join(', '));
process.exitCode = failures ? 1 : 0;
