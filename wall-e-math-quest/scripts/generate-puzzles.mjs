/**
 * Build-time puzzle generation (PRD Open Question #1 -> resolved as
 * "build-time script outputs JSON, runtime just reads").
 *
 *   npm run gen:puzzles
 *
 * Tiers 1-2 come from scripts/authored-content.mjs.
 * Tiers 3-8 come from src/utils/puzzleGenerator.ts.
 *
 * Every emitted tier is validated before it is written — a malformed puzzle
 * fails the build rather than shipping a round the player cannot answer.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTier, validateTier } from './puzzle-pipeline.mjs';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/puzzles');

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let total = 0;
  const failures = [];

  for (let tierId = 1; tierId <= 8; tierId += 1) {
    const puzzles = buildTier(tierId);
    const problems = validateTier(tierId, puzzles);
    if (problems.length > 0) {
      failures.push(...problems.map((p) => `  tier ${tierId}: ${p}`));
      continue;
    }

    writeFileSync(resolve(OUT_DIR, `tier${tierId}.json`), `${JSON.stringify(puzzles, null, 2)}\n`);
    total += puzzles.length;
    console.log(`tier${tierId}.json  ${puzzles.length} puzzles`);
  }

  if (failures.length > 0) {
    console.error('\nPuzzle validation failed:\n' + failures.join('\n'));
    process.exit(1);
  }

  console.log(`\nWrote ${total} puzzles to ${OUT_DIR}`);
}

main();
