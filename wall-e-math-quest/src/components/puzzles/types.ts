import type { Puzzle } from '@/types';
import type { PuzzleAttemptResult } from '@/hooks/usePuzzleEngine';

/** Contract shared by all three puzzle renderers (PRD Section 5.2). */
export interface PuzzleRendererProps {
  puzzle: Puzzle;
  /**
   * Report one attempt. The round engine answers with whether the puzzle is
   * now resolved and whether the answer should be revealed.
   */
  onAttempt: (correct: boolean) => PuzzleAttemptResult;
  /** The feedback animation finished and the round can move on. */
  onResolved: (correct: boolean) => void;
  /** Input is ignored while true (round over, or an animation in flight). */
  locked?: boolean;
}
