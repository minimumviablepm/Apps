/**
 * Hand-authored puzzle content for Tiers 1 and 2 (ages 3-5).
 *
 * PRD Section 12.2: these tiers are authored rather than templated because
 * developmental appropriateness for pre-readers is a judgement call — the
 * prompts lean on countable glyphs and single short words, never on reading
 * a sentence of instructions.
 *
 * `scripts/generate-puzzles.mjs` turns this file into src/data/puzzles/tier1.json
 * and tier2.json. Ids, option shuffling and validation happen there.
 */

const door = (mathTopic, prompt, correct, ...wrongs) => ({
  type: 'door_selection',
  mathTopic,
  prompt,
  options: [
    { label: String(correct), isCorrect: true },
    ...wrongs.map((w) => ({ label: String(w), isCorrect: false })),
  ],
});

/** `orderedLabels` are given in their correct order; presentation is shuffled later. */
const drag = (mathTopic, prompt, orderedLabels) => ({
  type: 'drag_and_drop',
  mathTopic,
  prompt,
  draggableItems: orderedLabels.map((label, index) => ({
    id: `item-${index}`,
    label: String(label),
    correctPosition: index,
  })),
});

/** `cells` uses null to mark a blank. `decoys` pad the tray. */
const pattern = (mathTopic, prompt, cells, decoys) => {
  const filled = cells.map((c) => (c === null ? null : String(c)));
  return {
    type: 'pattern_completion',
    mathTopic,
    prompt,
    __cells: filled,
    __decoys: decoys.map(String),
  };
};

const bolt = (n) => '\u{1F529}'.repeat(n); // nut and bolt
const star = (n) => '⭐'.repeat(n);
const plant = (n) => '\u{1F331}'.repeat(n);

// ---------------------------------------------------------------------------
// Tier 1 — Tiny Collector (ages 3-4)
// Counting 1-10, number recognition, colour/shape matching, more vs fewer.
// ---------------------------------------------------------------------------

const TIER1_DOORS = [
  // Counting 1-10 (10)
  door('counting_1_10', `How many? ${bolt(1)}`, 1, 2, 3),
  door('counting_1_10', `How many? ${bolt(2)}`, 2, 1, 3),
  door('counting_1_10', `How many? ${bolt(3)}`, 3, 2, 4),
  door('counting_1_10', `How many? ${star(4)}`, 4, 3, 5),
  door('counting_1_10', `How many? ${star(5)}`, 5, 4, 6),
  door('counting_1_10', `How many? ${plant(6)}`, 6, 5, 7),
  door('counting_1_10', `How many? ${plant(7)}`, 7, 6, 8),
  door('counting_1_10', `How many? ${bolt(8)}`, 8, 7, 9),
  door('counting_1_10', `How many? ${star(9)}`, 9, 8, 10),
  door('counting_1_10', `How many? ${bolt(10)}`, 10, 9, 8),

  // Number recognition (6)
  door('number_recognition', 'Find the number one.', 1, 7, 4),
  door('number_recognition', 'Find the number three.', 3, 8, 5),
  door('number_recognition', 'Find the number five.', 5, 2, 9),
  door('number_recognition', 'Find the number seven.', 7, 1, 4),
  door('number_recognition', 'Find the number eight.', 8, 3, 6),
  door('number_recognition', 'Find the number ten.', 10, 1, 6),

  // Colour matching (6)
  door('color_shape_matching', 'Find the red one.', '\u{1F534}', '\u{1F535}', '\u{1F7E2}'),
  door('color_shape_matching', 'Find the blue one.', '\u{1F535}', '\u{1F7E1}', '\u{1F534}'),
  door('color_shape_matching', 'Find the green one.', '\u{1F7E2}', '\u{1F534}', '\u{1F7E3}'),
  door('color_shape_matching', 'Find the yellow one.', '\u{1F7E1}', '\u{1F7E2}', '\u{1F535}'),
  door('color_shape_matching', 'Find the orange one.', '\u{1F7E0}', '\u{1F534}', '\u{1F7E1}'),
  door('color_shape_matching', 'Find the purple one.', '\u{1F7E3}', '\u{1F535}', '\u{1F7E2}'),

  // Shape matching (4)
  door('color_shape_matching', 'Find the circle.', '⭕', '⬛', '\u{1F53A}'),
  door('color_shape_matching', 'Find the square.', '⬛', '⭕', '\u{1F53A}'),
  door('color_shape_matching', 'Find the triangle.', '\u{1F53A}', '⭕', '⬛'),
  door('color_shape_matching', 'Find the star.', '⭐', '⭕', '⬛'),

  // More vs fewer (4)
  door('more_vs_fewer', 'Which pile has MORE?', bolt(5), bolt(2), bolt(1)),
  door('more_vs_fewer', 'Which pile has FEWER?', star(1), star(4), star(6)),
  door('more_vs_fewer', 'Which pile has MORE?', plant(7), plant(3), plant(2)),
  door('more_vs_fewer', 'Which pile has FEWER?', bolt(2), bolt(5), bolt(8)),
];

const TIER1_DRAGS = [
  drag('counting_1_10', 'Put the numbers in order.', [1, 2, 3]),
  drag('counting_1_10', 'Put the numbers in order.', [2, 3, 4]),
  drag('counting_1_10', 'Put the numbers in order.', [3, 4, 5]),
  drag('counting_1_10', 'Put the numbers in order.', [1, 2, 3, 4]),
  drag('counting_1_10', 'Put the numbers in order.', [4, 5, 6, 7]),
  drag('counting_1_10', 'Put the numbers in order.', [6, 7, 8]),
  drag('counting_1_10', 'Put the numbers in order.', [7, 8, 9, 10]),
  drag('counting_1_10', 'Put the numbers in order.', [2, 4, 6, 8]),
  drag('more_vs_fewer', 'Fewest first!', [bolt(1), bolt(2), bolt(3)]),
  drag('more_vs_fewer', 'Fewest first!', [star(2), star(4), star(6)]),
  drag('more_vs_fewer', 'Fewest first!', [plant(1), plant(3), plant(5)]),
  drag('more_vs_fewer', 'Most first!', [bolt(6), bolt(4), bolt(2)]),
  drag('color_shape_matching', 'Fewest sides first!', ['⭕', '\u{1F53A}', '⬛']),
  drag('counting_1_10', 'Put the numbers in order.', [5, 6, 7, 8]),
  drag('counting_1_10', 'Put the numbers in order.', [1, 3, 5, 7]),
];

const TIER1_PATTERNS = [
  pattern('counting_1_10', 'What is missing?', [1, 2, null, 4, 5], [6, 7, 9]),
  pattern('counting_1_10', 'What is missing?', [2, 3, 4, null, 6], [7, 1, 9]),
  pattern('counting_1_10', 'What is missing?', [5, 6, null, 8, 9], [4, 10, 2]),
  pattern('counting_1_10', 'What is missing?', [1, null, 3, null, 5], [6, 7, 8]),
  pattern('counting_1_10', 'What is missing?', [6, 7, 8, null, 10], [5, 4, 3]),
  pattern('counting_1_10', 'What is missing?', [3, 4, 5, 6, null], [8, 9, 2]),
  pattern('color_shape_matching', 'What comes next?', ['\u{1F534}', '\u{1F535}', '\u{1F534}', '\u{1F535}', null], ['\u{1F7E2}', '\u{1F7E1}', '\u{1F7E3}']),
  pattern('color_shape_matching', 'What comes next?', ['\u{1F7E2}', '\u{1F7E1}', '\u{1F7E2}', '\u{1F7E1}', null], ['\u{1F534}', '\u{1F535}', '\u{1F7E0}']),
  pattern('color_shape_matching', 'What is missing?', ['\u{1F534}', '\u{1F534}', '\u{1F535}', null, '\u{1F534}'], ['\u{1F7E2}', '\u{1F7E1}', '\u{1F7E0}']),
  pattern('color_shape_matching', 'What comes next?', ['\u{1F7E0}', '\u{1F7E3}', '\u{1F7E0}', '\u{1F7E3}', null], ['\u{1F534}', '\u{1F535}', '\u{1F7E2}']),
  pattern('color_shape_matching', 'What comes next?', ['\u{1F535}', '\u{1F535}', '\u{1F7E1}', '\u{1F535}', '\u{1F535}', null], ['\u{1F534}', '\u{1F7E2}', '\u{1F7E3}']),
  pattern('color_shape_matching', 'What comes next?', ['⭕', '⬛', '⭕', '⬛', null], ['\u{1F53A}', '⭐', '\u{1F536}']),
  pattern('color_shape_matching', 'What is missing?', ['\u{1F53A}', '⭕', null, '⭕', '\u{1F53A}'], ['⬛', '⭐', '\u{1F536}']),
  pattern('color_shape_matching', 'What comes next?', ['⭐', '⬛', '⭐', '⬛', null], ['⭕', '\u{1F53A}', '\u{1F536}']),
  pattern('color_shape_matching', 'What comes next?', ['⬛', '⬛', '⭕', '⬛', '⬛', null], ['\u{1F53A}', '⭐', '\u{1F536}']),
];

// ---------------------------------------------------------------------------
// Tier 2 — Junior Sorter (ages 4-5)
// Counting 1-20, addition to 10, basic shape names, size ordering.
// ---------------------------------------------------------------------------

const TIER2_DOORS = [
  // Counting 1-20 (8)
  door('counting_1_20', `How many? ${bolt(11)}`, 11, 10, 12),
  door('counting_1_20', `How many? ${star(12)}`, 12, 11, 13),
  door('counting_1_20', `How many? ${plant(13)}`, 13, 12, 14),
  door('counting_1_20', `How many? ${bolt(15)}`, 15, 14, 16),
  door('counting_1_20', 'What comes after 16?', 17, 15, 18),
  door('counting_1_20', 'What comes before 20?', 19, 18, 21),
  door('counting_1_20', 'What comes after 13?', 14, 12, 15),
  door('counting_1_20', 'What comes before 11?', 10, 12, 9),

  // Addition within 10 (10)
  door('addition_within_10', 'What is 1 + 1?', 2, 1, 3),
  door('addition_within_10', 'What is 2 + 1?', 3, 2, 4),
  door('addition_within_10', 'What is 2 + 2?', 4, 3, 5),
  door('addition_within_10', 'What is 3 + 2?', 5, 4, 6),
  door('addition_within_10', 'What is 3 + 3?', 6, 5, 7),
  door('addition_within_10', 'What is 4 + 2?', 6, 7, 5),
  door('addition_within_10', 'What is 4 + 3?', 7, 6, 8),
  door('addition_within_10', 'What is 5 + 3?', 8, 7, 9),
  door('addition_within_10', 'What is 5 + 4?', 9, 8, 10),
  door('addition_within_10', 'What is 5 + 5?', 10, 9, 11),

  // Shape names (6)
  door('shape_names', 'Which one is a circle?', '⭕', '⬛', '\u{1F53A}'),
  door('shape_names', 'Which one is a square?', '⬛', '\u{1F53A}', '⭕'),
  door('shape_names', 'Which one is a triangle?', '\u{1F53A}', '⭕', '⬛'),
  door('shape_names', 'Which one is a diamond?', '\u{1F536}', '⭕', '⬛'),
  door('shape_names', 'How many corners does a square have?', 4, 3, 5),
  door('shape_names', 'How many corners does a triangle have?', 3, 4, 2),

  // Size ordering (6)
  door('size_ordering', 'Which is the BIGGEST number?', 9, 4, 6),
  door('size_ordering', 'Which is the SMALLEST number?', 2, 7, 5),
  door('size_ordering', 'Which is the BIGGEST number?', 18, 12, 15),
  door('size_ordering', 'Which is the SMALLEST number?', 11, 16, 14),
  door('size_ordering', 'Which pile is BIGGEST?', bolt(9), bolt(4), bolt(6)),
  door('size_ordering', 'Which pile is SMALLEST?', star(2), star(5), star(8)),
];

const TIER2_DRAGS = [
  drag('counting_1_20', 'Put the numbers in order.', [10, 11, 12, 13]),
  drag('counting_1_20', 'Put the numbers in order.', [14, 15, 16, 17]),
  drag('counting_1_20', 'Put the numbers in order.', [17, 18, 19, 20]),
  drag('counting_1_20', 'Put the numbers in order.', [11, 13, 15, 17]),
  drag('counting_1_20', 'Put the numbers in order.', [12, 14, 16, 18]),
  drag('counting_1_20', 'Put the numbers in order.', [5, 10, 15, 20]),
  drag('size_ordering', 'Smallest to biggest!', [3, 8, 12, 19]),
  drag('size_ordering', 'Smallest to biggest!', [2, 6, 11, 16]),
  drag('size_ordering', 'Biggest to smallest!', [20, 15, 9, 4]),
  drag('size_ordering', 'Biggest to smallest!', [18, 13, 7, 1]),
  drag('size_ordering', 'Smallest to biggest!', [bolt(2), bolt(4), bolt(6), bolt(8)]),
  drag('addition_within_10', 'Smallest answer first!', ['1 + 1', '2 + 1', '2 + 2', '3 + 3']),
  drag('addition_within_10', 'Smallest answer first!', ['1 + 2', '2 + 3', '3 + 4', '4 + 5']),
  drag('addition_within_10', 'Smallest answer first!', ['0 + 2', '1 + 3', '2 + 4', '3 + 5']),
  drag('shape_names', 'Fewest corners first!', ['circle', 'triangle', 'square']),
];

const TIER2_PATTERNS = [
  pattern('counting_1_20', 'What is missing?', [10, 11, null, 13, 14], [15, 9, 16]),
  pattern('counting_1_20', 'What is missing?', [12, 13, 14, null, 16], [17, 11, 18]),
  pattern('counting_1_20', 'What is missing?', [15, null, 17, 18, null], [20, 19, 14]),
  pattern('counting_1_20', 'What is missing?', [16, 17, 18, 19, null], [21, 15, 14]),
  pattern('counting_1_20', 'What is missing?', [11, null, 13, 14, null], [16, 10, 17]),
  pattern('counting_1_20', 'Counting by 2s. What is missing?', [2, 4, null, 8, 10], [12, 7, 5]),
  pattern('counting_1_20', 'Counting by 2s. What is missing?', [6, 8, 10, null, 14], [16, 11, 13]),
  pattern('counting_1_20', 'Counting by 2s. What is missing?', [10, 12, null, 16, null], [20, 18, 15]),
  pattern('counting_1_20', 'Counting by 5s. What is missing?', [5, 10, null, 20], [25, 12, 18]),
  pattern('addition_within_10', 'Add 1 each time. What is missing?', [1, 2, 3, null, 5], [6, 7, 0]),
  pattern('addition_within_10', 'Add 2 each time. What is missing?', [1, 3, 5, null, 9], [11, 8, 6]),
  pattern('addition_within_10', 'Add 3 each time. What is missing?', [1, 4, null, 10], [13, 8, 6]),
  pattern('shape_names', 'What comes next?', ['⭕', '\u{1F53A}', '⬛', '⭕', '\u{1F53A}', null], ['⭐', '\u{1F536}', '\u{1F534}']),
  pattern('shape_names', 'What comes next?', ['⬛', '⭕', '⬛', '⭕', null], ['\u{1F53A}', '⭐', '\u{1F536}']),
  pattern('shape_names', 'What is missing?', ['\u{1F536}', '⭐', null, '⭐', '\u{1F536}'], ['⭕', '⬛', '\u{1F53A}']),
];

export const AUTHORED_TIERS = {
  1: {
    door_selection: TIER1_DOORS,
    drag_and_drop: TIER1_DRAGS,
    pattern_completion: TIER1_PATTERNS,
  },
  2: {
    door_selection: TIER2_DOORS,
    drag_and_drop: TIER2_DRAGS,
    pattern_completion: TIER2_PATTERNS,
  },
};
