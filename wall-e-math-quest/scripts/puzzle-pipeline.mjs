/**
 * Shared puzzle-build pipeline.
 *
 * `scripts/generate-puzzles.mjs` writes what this produces;
 * `scripts/verify-content.mjs` re-runs it and diffs against what is committed.
 * Keeping both on one code path is what makes the committed JSON trustworthy.
 */
import { AUTHORED_TIERS } from './authored-content.mjs';
import { generateTier, PUZZLES_PER_TIER } from '../src/utils/puzzleGenerator.ts';
import { seededRandom, shuffle } from '../src/utils/random.ts';

/** Fixed seed: regenerating without a template change is a no-op diff. */
export const SEED = 20260820;

const ID_PREFIX = {
  door_selection: 'door',
  drag_and_drop: 'drag',
  pattern_completion: 'pattern',
};

export function expandAuthored(tierId, random) {
  const groups = AUTHORED_TIERS[tierId];
  const out = [];

  for (const [type, entries] of Object.entries(groups)) {
    entries.forEach((entry, index) => {
      const id = `t${tierId}-${ID_PREFIX[type]}-${String(index + 1).padStart(3, '0')}`;
      const base = { id, type, tierId, mathTopic: entry.mathTopic, prompt: entry.prompt };

      if (type === 'door_selection') {
        out.push({ ...base, options: shuffle(entry.options, random) });
        return;
      }

      if (type === 'drag_and_drop') {
        out.push({ ...base, draggableItems: shuffle(entry.draggableItems, random) });
        return;
      }

      // pattern_completion: __cells uses null for blanks.
      const cells = entry.__cells;
      const correctFills = [];
      const sequence = cells.map((value, i) => {
        if (value !== null) return { value, isBlank: false };
        // The authored file marks the blank; its answer is whatever the
        // surrounding pattern implies, derived below.
        const answer = inferBlank(cells, i);
        correctFills.push(answer);
        return { value: answer, isBlank: true };
      });

      out.push({
        ...base,
        sequence,
        correctFills,
        fillOptions: shuffle([...correctFills, ...entry.__decoys.slice(0, 3)], random),
      });
    });
  }

  return out;
}

/**
 * Derives the value behind an authored blank.
 *
 * Numeric sequences: continue the arithmetic step read off the known cells.
 * Repeating glyph sequences: copy the cell one period back.
 */
function inferBlank(cells, index) {
  const numeric = cells.every((c) => c === null || /^-?\d+$/.test(c));
  if (numeric) {
    const known = cells.map((c, i) => (c === null ? null : { i, v: Number(c) })).filter(Boolean);
    if (known.length < 2) throw new Error('Numeric pattern needs at least two known cells');
    const first = known[0];
    const last = known[known.length - 1];
    const step = (last.v - first.v) / (last.i - first.i);
    if (!Number.isInteger(step)) throw new Error(`Non-integer step in pattern: ${cells.join(',')}`);
    return String(first.v + step * (index - first.i));
  }

  // Glyph pattern: find the smallest period that explains every known cell.
  for (let period = 1; period < cells.length; period += 1) {
    let consistent = true;
    for (let i = period; i < cells.length; i += 1) {
      const a = cells[i];
      const b = cells[i - period];
      if (a !== null && b !== null && a !== b) {
        consistent = false;
        break;
      }
    }
    if (!consistent) continue;
    for (let probe = index - period; probe >= 0; probe -= period) {
      if (cells[probe] !== null) return cells[probe];
    }
    for (let probe = index + period; probe < cells.length; probe += period) {
      if (cells[probe] !== null) return cells[probe];
    }
  }
  throw new Error(`Could not infer blank at index ${index} for pattern: ${cells.join(',')}`);
}

export function validateTier(tierId, puzzles) {
  const problems = [];
  const counts = { door_selection: 0, drag_and_drop: 0, pattern_completion: 0 };
  const ids = new Set();

  for (const p of puzzles) {
    if (ids.has(p.id)) problems.push(`duplicate id ${p.id}`);
    ids.add(p.id);
    if (p.tierId !== tierId) problems.push(`${p.id}: wrong tierId ${p.tierId}`);
    if (!p.prompt) problems.push(`${p.id}: empty prompt`);
    if (!p.mathTopic) problems.push(`${p.id}: empty mathTopic`);
    counts[p.type] += 1;

    if (p.type === 'door_selection') {
      const correct = (p.options ?? []).filter((o) => o.isCorrect);
      if (correct.length !== 1) problems.push(`${p.id}: needs exactly 1 correct door`);
      if ((p.options ?? []).length < 3 || (p.options ?? []).length > 4) {
        problems.push(`${p.id}: needs 3-4 doors, has ${(p.options ?? []).length}`);
      }
      const labels = new Set((p.options ?? []).map((o) => o.label));
      if (labels.size !== (p.options ?? []).length) problems.push(`${p.id}: duplicate door labels`);
    }

    if (p.type === 'drag_and_drop') {
      const items = p.draggableItems ?? [];
      if (items.length < 3) problems.push(`${p.id}: needs at least 3 draggable items`);
      const positions = items.map((i) => i.correctPosition).sort((a, b) => a - b);
      const expected = items.map((_, i) => i);
      if (positions.join(',') !== expected.join(',')) {
        problems.push(`${p.id}: correctPosition values must be 0..n-1 with no gaps`);
      }
      if (new Set(items.map((i) => i.label)).size !== items.length) {
        problems.push(`${p.id}: duplicate draggable labels make the target order ambiguous`);
      }
    }

    if (p.type === 'pattern_completion') {
      const seq = p.sequence ?? [];
      const blanks = seq.filter((c) => c.isBlank);
      if (blanks.length < 1 || blanks.length > 2) {
        problems.push(`${p.id}: needs 1-2 blanks, has ${blanks.length}`);
      }
      if ((p.correctFills ?? []).length !== blanks.length) {
        problems.push(`${p.id}: correctFills length must match blank count`);
      }
      for (const fill of p.correctFills ?? []) {
        if (!(p.fillOptions ?? []).includes(fill)) {
          problems.push(`${p.id}: tray is missing the correct fill "${fill}"`);
        }
      }
      if (seq[0]?.isBlank) problems.push(`${p.id}: first cell must not be blank`);
    }
  }

  for (const [type, want] of Object.entries(PUZZLES_PER_TIER)) {
    if (counts[type] !== want) {
      problems.push(`tier ${tierId}: expected ${want} ${type}, got ${counts[type]}`);
    }
  }

  return problems;
}

/**
 * Builds one tier. A per-tier seed keeps tier N's output stable when tier M's
 * templates change.
 */
export function buildTier(tierId, seed = SEED) {
  const random = seededRandom(seed + tierId * 7919);
  return tierId <= 2 ? expandAuthored(tierId, random) : generateTier(tierId, random);
}

export { PUZZLES_PER_TIER };
