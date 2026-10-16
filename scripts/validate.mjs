// Checks vocabulary data: run with `node scripts/validate.mjs`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const index = JSON.parse(readFileSync(join(root, 'languages.json'), 'utf8'));
const targetCodes = index.translate.map((x) => x.code);
const errors = [];
const warnings = [];

for (const lang of index.learn) {
  const vocab = JSON.parse(readFileSync(join(root, lang.file), 'utf8'));
  const where = (...p) => [lang.code, ...p].join(' › ');

  if (vocab.code !== lang.code) errors.push(`${where()}: code mismatch (${vocab.code})`);
  if (!vocab.speech) errors.push(`${where()}: missing "speech" language tag`);
  if (!vocab.license) errors.push(`${where()}: missing "license"`);

  const setIds = new Set();
  let total = 0;
  // translations available for this language = those present on every word
  const available = new Set(targetCodes.filter((c) => c !== lang.code));

  for (const set of vocab.sets) {
    if (setIds.has(set.id)) errors.push(`${where(set.id)}: duplicate set id`);
    setIds.add(set.id);
    if (!set.name?.th) errors.push(`${where(set.id)}: missing Thai set name`);
    if (set.words.length < 4) errors.push(`${where(set.id)}: needs at least 4 words`);

    const terms = new Set();
    const answers = new Map();
    for (const w of set.words) {
      total++;
      if (!w.term) errors.push(`${where(set.id)}: word without term`);
      if (terms.has(w.term)) errors.push(`${where(set.id, w.term)}: duplicate term in set`);
      terms.add(w.term);
      if (!w.tr?.th) errors.push(`${where(set.id, w.term)}: missing Thai translation`);
      for (const c of [...available]) if (!w.tr?.[c]) available.delete(c);
      for (const [c, text] of Object.entries(w.tr || {})) {
        const k = `${c}:${text}`;
        if (answers.has(k)) warnings.push(`${where(set.id)}: "${answers.get(k)}" and "${w.term}" share ${c} translation "${text}"`);
        else answers.set(k, w.term);
      }
    }
  }
  console.log(`${lang.code}: ${vocab.sets.length} sets, ${total} words, translations: ${[...available].join(', ') || '(none)'}`);
}

for (const w of warnings) console.warn(`warn: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
if (errors.length) process.exit(1);
console.log('OK');
