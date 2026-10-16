// Bump the app version and open a new changelog entry.
//   node scripts/bump-version.mjs patch|minor|major   bump + add an entry to data/changelog.json
//   node scripts/bump-version.mjs --sync               only regenerate CHANGELOG.md
// After bumping, fill in the new entry's "th" and "en" lists, then run --sync.
import { writeFileSync } from 'node:fs';
import { path, readJSON, readVersion, renderChangelogMd } from './lib.mjs';

const arg = process.argv[2];
const log = readJSON('data', 'changelog.json');

if (arg !== '--sync') {
  const idx = ['major', 'minor', 'patch'].indexOf(arg);
  if (idx < 0) {
    console.error('usage: node scripts/bump-version.mjs <patch|minor|major|--sync>');
    process.exit(1);
  }
  const { src, parts } = readVersion();
  parts[idx] += 1;
  for (let i = idx + 1; i < 3; i++) parts[i] = 0;
  const next = parts.join('.');
  writeFileSync(path('version.js'), src.replace(/APP_VERSION\s*=\s*'[^']*'/, `APP_VERSION = '${next}'`));
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  log.unshift({ version: next, date, changes: { th: [], en: [] } });
  writeFileSync(path('data', 'changelog.json'), JSON.stringify(log, null, 2) + '\n');
  console.log(`version ${next}: now describe the changes in data/changelog.json, then run with --sync`);
}

writeFileSync(path('CHANGELOG.md'), renderChangelogMd(log));
console.log('CHANGELOG.md updated');
