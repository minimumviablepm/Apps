/**
 * Every interface in this file comes straight from the PRD (Sections 11 & 12).
 * The whole app depends on this schema, so treat changes here as breaking.
 */

// ---------------------------------------------------------------------------
// Section 11 — Data model (persisted to AsyncStorage)
// ---------------------------------------------------------------------------

export interface PlayerProfile {
  id: string; // UUID generated on first launch
  name: string; // max 20 chars
  age: number; // 3-11
  createdAt: string; // ISO timestamp
}

export interface TierProgress {
  tierId: number; // 1-8
  isUnlocked: boolean;
  bestScore: number; // highest single-round score
  bestPercentage: number; // highest single-round percentage
  starRating: number; // 0-3 (best achieved)
  consecutivePasses: number; // consecutive rounds >= 70%, resets on fail
  totalRoundsPlayed: number;
  totalCorrectAnswers: number;
}

export interface PuzzleTypeBreakdown {
  attempted: number;
  correct: number;
}

export interface RoundResult {
  tierId: number;
  timestamp: string; // ISO timestamp
  score: number; // correct answers
  totalPuzzles: number; // puzzles attempted
  percentage: number; // score / totalPuzzles * 100
  durationMs: number; // always ~60000 unless app backgrounded
  puzzleBreakdown: {
    doorSelection: PuzzleTypeBreakdown;
    dragAndDrop: PuzzleTypeBreakdown;
    patternCompletion: PuzzleTypeBreakdown;
  };
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
}

export interface GameState {
  profile: PlayerProfile;
  tiers: TierProgress[]; // array of 8
  roundHistory: RoundResult[]; // last 50 rounds (FIFO)
  settings: GameSettings;
}

// ---------------------------------------------------------------------------
// Section 12 — Puzzle content schema
// ---------------------------------------------------------------------------

export type PuzzleType = 'door_selection' | 'drag_and_drop' | 'pattern_completion';

export interface DoorOption {
  label: string; // what's displayed on the door
  isCorrect: boolean;
}

export interface DraggableItem {
  id: string;
  label: string;
  correctPosition: number; // 0-indexed target slot
}

export interface SequenceCell {
  value: string;
  isBlank: boolean; // true = player must fill this
}

export interface Puzzle {
  id: string;
  type: PuzzleType;
  tierId: number; // 1-8
  mathTopic: string; // e.g., 'addition_within_20'
  prompt: string; // display text, e.g., "What is 3 + 4?"
  promptImage?: string; // optional image asset path for visual puzzles

  // Door Selection specific
  options?: DoorOption[];

  // Drag and Drop specific
  draggableItems?: DraggableItem[];

  // Pattern Completion specific
  sequence?: SequenceCell[];
  fillOptions?: string[];
  correctFills?: string[]; // correct values for blank positions, in order
}

// ---------------------------------------------------------------------------
// Section 6 — Tiers
// ---------------------------------------------------------------------------

export interface TierDefinition {
  tierId: number;
  label: string;
  minAge: number;
  maxAge: number;
  topics: string[];
}

// ---------------------------------------------------------------------------
// Section 7 — Characters
// ---------------------------------------------------------------------------

export type WrongAnswerCharacterId = 'mo' | 'auto' | 'vaqm' | 'dfib' | 'brla';
export type CharacterId = 'walle' | 'eve' | WrongAnswerCharacterId;

/** The subset of sound keys a character can be voiced with (PRD Section 7.1). */
export type CharacterSoundKey =
  | 'walle_beep'
  | 'correct'
  | 'mo_scrub'
  | 'auto_buzz'
  | 'bot_clunk'
  | 'bot_spring'
  | 'bot_umbrella';

export interface CharacterConfig {
  id: CharacterId;
  name: string;
  /** Placeholder sprite colour. The real art pipeline replaces this. */
  color: string;
  textColor: string;
  reactions: string[];
  /** Sound key played when this character appears. */
  soundKey: CharacterSoundKey;
  /** Weight used by the wrong-answer picker. Unused for walle/eve. */
  weight?: number;
}

// ---------------------------------------------------------------------------
// Runtime-only round state
// ---------------------------------------------------------------------------

export type PuzzleOutcome = 'correct' | 'incorrect';

export interface PuzzleAttemptRecord {
  puzzleId: string;
  type: PuzzleType;
  outcome: PuzzleOutcome;
  retriesUsed: number;
}
