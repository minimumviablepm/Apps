/**
 * Generates the game's sound effects and music beds as 16-bit mono WAV files.
 *
 *   npm run gen:sounds
 *
 * PRD Section 9 requires every sound to be royalty-free or original — these are
 * synthesised from scratch here, so there is no third-party audio in the repo
 * and nothing from the film. Durations match the table in Section 9.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../assets/sounds');
const RATE = 22050;

// --- tiny synth ------------------------------------------------------------

const clamp = (v) => Math.max(-1, Math.min(1, v));

function buffer(seconds) {
  return new Float32Array(Math.round(seconds * RATE));
}

/** Linear attack / exponential decay envelope. */
function env(t, duration, attack = 0.01, decay = 0.4) {
  if (t < attack) return t / attack;
  const rest = (t - attack) / Math.max(1e-6, duration - attack);
  return Math.exp(-rest / decay) * (1 - rest * 0.15);
}

function tone(buf, { freq, start, duration, gain = 0.3, wave = 'sine', sweep = 0, attack = 0.01, decay = 0.4 }) {
  const from = Math.round(start * RATE);
  const count = Math.round(duration * RATE);
  let phase = 0;
  for (let i = 0; i < count; i += 1) {
    const idx = from + i;
    if (idx >= buf.length) break;
    const t = i / RATE;
    const f = freq + sweep * (t / duration);
    phase += (2 * Math.PI * f) / RATE;
    let sample;
    if (wave === 'square') sample = Math.sign(Math.sin(phase));
    else if (wave === 'saw') sample = ((phase / Math.PI) % 2) - 1;
    else if (wave === 'triangle') sample = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else sample = Math.sin(phase);
    buf[idx] += sample * gain * env(t, duration, attack, decay);
  }
}

function noise(buf, { start, duration, gain = 0.2, decay = 0.3, lowpass = 0.35 }) {
  const from = Math.round(start * RATE);
  const count = Math.round(duration * RATE);
  let last = 0;
  for (let i = 0; i < count; i += 1) {
    const idx = from + i;
    if (idx >= buf.length) break;
    const t = i / RATE;
    const white = Math.random() * 2 - 1;
    last += lowpass * (white - last); // one-pole lowpass keeps it soft
    buf[idx] += last * gain * env(t, duration, 0.005, decay);
  }
}

function writeWav(name, buf) {
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i += 1) {
    data.writeInt16LE(Math.round(clamp(buf[i]) * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(resolve(OUT_DIR, `${name}.wav`), Buffer.concat([header, data]));
  return data.length + 44;
}

// --- the sound set ---------------------------------------------------------

const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };

const SOUNDS = {
  // Round start — Wall-E's curious beep layered over a rising motif (2s).
  round_start: () => {
    const b = buffer(2);
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) =>
      tone(b, { freq: f, start: i * 0.18, duration: 0.55, gain: 0.22, wave: 'triangle' }),
    );
    tone(b, { freq: 700, start: 0.85, duration: 0.18, gain: 0.16, wave: 'square', sweep: 500 });
    tone(b, { freq: 1200, start: 1.05, duration: 0.12, gain: 0.12, wave: 'square', sweep: -400 });
    return b;
  },

  // Correct answer — bright ascending chime (1s).
  correct: () => {
    const b = buffer(1);
    [NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6].forEach((f, i) =>
      tone(b, { freq: f, start: i * 0.07, duration: 0.6, gain: 0.24, wave: 'sine', decay: 0.35 }),
    );
    return b;
  },

  // Wrong answer — playful, non-punishing boing (0.5s).
  wrong: () => {
    const b = buffer(0.5);
    tone(b, { freq: 320, start: 0, duration: 0.45, gain: 0.28, wave: 'triangle', sweep: -170, decay: 0.5 });
    return b;
  },

  // Ticking speedup for the last 10 seconds — loops.
  timer_warning: () => {
    const b = buffer(1);
    [0, 0.25, 0.5, 0.75].forEach((s) =>
      tone(b, { freq: 1500, start: s, duration: 0.05, gain: 0.13, wave: 'square', decay: 0.12 }),
    );
    return b;
  },

  // Round end — three fanfares, picked by score band (2s each).
  round_end_low: () => {
    const b = buffer(2);
    [NOTE.C5, NOTE.D5].forEach((f, i) =>
      tone(b, { freq: f, start: i * 0.3, duration: 0.9, gain: 0.2, wave: 'triangle' }),
    );
    return b;
  },
  round_end_mid: () => {
    const b = buffer(2);
    [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) =>
      tone(b, { freq: f, start: i * 0.22, duration: 1.1, gain: 0.21, wave: 'triangle' }),
    );
    return b;
  },
  round_end_high: () => {
    const b = buffer(2);
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6].forEach((f, i) =>
      tone(b, { freq: f, start: i * 0.14, duration: 1.2, gain: 0.19, wave: 'triangle' }),
    );
    noise(b, { start: 0.9, duration: 0.9, gain: 0.06, decay: 0.5, lowpass: 0.6 });
    return b;
  },

  // Tier unlock — distinct 3s achievement jingle.
  tier_unlock: () => {
    const b = buffer(3);
    [NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6].forEach((f, i) =>
      tone(b, { freq: f, start: i * 0.2, duration: 1.6, gain: 0.2, wave: 'sine', decay: 0.6 }),
    );
    [NOTE.C5, NOTE.G5].forEach((f, i) =>
      tone(b, { freq: f, start: 1.2 + i * 0.3, duration: 1.4, gain: 0.16, wave: 'triangle' }),
    );
    return b;
  },

  // Drag feedback (0.3s each).
  drag_correct: () => {
    const b = buffer(0.3);
    tone(b, { freq: NOTE.A5, start: 0, duration: 0.25, gain: 0.26, wave: 'sine', sweep: 260, decay: 0.2 });
    return b;
  },
  drag_incorrect: () => {
    const b = buffer(0.3);
    tone(b, { freq: 260, start: 0, duration: 0.28, gain: 0.24, wave: 'sine', sweep: -90, decay: 0.35 });
    return b;
  },

  // Character voices.
  walle_beep: () => {
    const b = buffer(0.6);
    tone(b, { freq: 620, start: 0, duration: 0.18, gain: 0.2, wave: 'square', sweep: 420 });
    tone(b, { freq: 900, start: 0.22, duration: 0.16, gain: 0.16, wave: 'square', sweep: -300 });
    return b;
  },
  mo_scrub: () => {
    const b = buffer(0.7);
    for (let i = 0; i < 4; i += 1) {
      noise(b, { start: i * 0.15, duration: 0.13, gain: 0.22, decay: 0.25, lowpass: 0.8 });
    }
    return b;
  },
  auto_buzz: () => {
    const b = buffer(0.7);
    tone(b, { freq: 150, start: 0, duration: 0.6, gain: 0.22, wave: 'square', decay: 0.7 });
    tone(b, { freq: 75, start: 0, duration: 0.6, gain: 0.14, wave: 'saw', decay: 0.7 });
    return b;
  },
  bot_clunk: () => {
    const b = buffer(0.6);
    noise(b, { start: 0, duration: 0.12, gain: 0.3, decay: 0.12, lowpass: 0.25 });
    tone(b, { freq: 190, start: 0.02, duration: 0.3, gain: 0.2, wave: 'triangle', decay: 0.2 });
    tone(b, { freq: 260, start: 0.24, duration: 0.2, gain: 0.14, wave: 'square', decay: 0.2 });
    return b;
  },
  bot_spring: () => {
    const b = buffer(0.6);
    for (let i = 0; i < 5; i += 1) {
      tone(b, {
        freq: 400 + i * 120,
        start: i * 0.08,
        duration: 0.14,
        gain: 0.16,
        wave: 'sine',
        sweep: -180,
        decay: 0.25,
      });
    }
    return b;
  },
  bot_umbrella: () => {
    const b = buffer(0.5);
    noise(b, { start: 0, duration: 0.06, gain: 0.34, decay: 0.08, lowpass: 0.9 });
    tone(b, { freq: 520, start: 0.04, duration: 0.3, gain: 0.18, wave: 'sine', sweep: 300, decay: 0.25 });
    return b;
  },
};

/** Calm, low-volume ambient beds — one per puzzle type (PRD Section 9). */
function ambient(rootHz, seconds, sparkle) {
  const b = buffer(seconds);
  const beat = seconds / 8;
  for (let i = 0; i < 8; i += 1) {
    const step = [0, 3, 5, 7, 5, 3, 2, 0][i];
    tone(b, {
      freq: rootHz * 2 ** (step / 12),
      start: i * beat,
      duration: beat * 1.9,
      gain: 0.08,
      wave: 'sine',
      attack: beat * 0.4,
      decay: 0.8,
    });
    if (sparkle && i % 2 === 0) {
      tone(b, {
        freq: rootHz * 4 * 2 ** (step / 12),
        start: i * beat + beat * 0.5,
        duration: beat,
        gain: 0.03,
        wave: 'triangle',
        decay: 0.4,
      });
    }
  }
  // Sub-drone glues the loop point together.
  tone(b, { freq: rootHz / 2, start: 0, duration: seconds, gain: 0.05, wave: 'sine', attack: 0.5, decay: 4 });
  return b;
}

SOUNDS.music_door = () => ambient(196, 8, true); // G3
SOUNDS.music_drag = () => ambient(174.61, 8, false); // F3
SOUNDS.music_pattern = () => ambient(220, 8, true); // A3

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let bytes = 0;
  for (const [name, make] of Object.entries(SOUNDS)) {
    bytes += writeWav(name, make());
  }
  console.log(
    `Wrote ${Object.keys(SOUNDS).length} WAV files (${(bytes / 1024 / 1024).toFixed(2)} MB) to ${OUT_DIR}`,
  );
}

main();
