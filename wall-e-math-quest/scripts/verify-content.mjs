/**
 * Zero-install content gate.
 *
 *   npm run verify:content
 *
 * Regenerates every tier in memory and diffs it against the committed JSON, so
 * a template edit that was never re-run — or a hand-edited puzzle file — fails
 * the build instead of shipping. Uses only Node built-ins, which means CI can
 * run it without installing the React Native toolchain.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTier, SEED, validateTier } from './puzzle-pipeline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../src/data/puzzles');

let failures = 0;
let total = 0;

for (let tierId = 1; tierId <= 8; tierId += 1) {
  const file = resolve(OUT_DIR, `tier${tierId}.json`);
  let committed;
  try {
    committed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`tier${tierId}.json: cannot read (${error.message})`);
    failures += 1;
    continue;
  }

  const problems = validateTier(tierId, committed);
  if (problems.length > 0) {
    problems.forEach((p) => console.error(`tier${tierId}.json: ${p}`));
    failures += problems.length;
    continue;
  }

  const expected = buildTier(tierId, SEED);
  if (JSON.stringify(expected) !== JSON.stringify(committed)) {
    console.error(
      `tier${tierId}.json is out of date — run "npm run gen:puzzles" and commit the result`,
    );
    failures += 1;
    continue;
  }

  total += committed.length;
  console.log(`tier${tierId}.json  ok (${committed.length} puzzles)`);
}

if (failures > 0) {
  console.error(`\n${failures} problem(s) found.`);
  process.exit(1);
}

console.log(`\n${total} puzzles verified.`);
