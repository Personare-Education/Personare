/**
 * The app's sounds (docs/specs/gamification.md §2), made with Web Audio --
 * short notes with a soft attack and a quick fade -- so there are no audio
 * files to ship or license. Off in Settings, nothing plays; with no audio
 * available, it goes on silently.
 */

type AudioContextConstructor = new () => AudioContext;

let enabled = true;
let context: AudioContext | null = null;

/** Follows Settings → Sounds; read when the app starts and on each change. */
export function setSoundsEnabled(value: boolean): void {
  enabled = value;
}

function audio(): AudioContext | null {
  if (!enabled) {
    return null;
  }
  try {
    const Ctor = (globalThis as { AudioContext?: AudioContextConstructor })
      .AudioContext;
    if (!Ctor) {
      return null;
    }
    context ??= new Ctor();
    if (context.state === "suspended") {
      context.resume().catch(() => undefined);
    }
    return context;
  } catch {
    return null;
  }
}

interface Note {
  /** Seconds after now. */
  at: number;
  /** Seconds. */
  duration: number;
  frequency: number;
  /** 0 to 1. */
  volume?: number;
}

/** A triangle note with an octave sine above it, faded out. */
function play(notes: Note[]): void {
  const ctx = audio();
  if (!ctx) {
    return;
  }
  try {
    for (const note of notes) {
      const start = ctx.currentTime + note.at;
      const peak = note.volume ?? 0.16;
      for (const [type, multiple, share] of [
        ["triangle", 1, 1],
        ["sine", 2, 0.35],
      ] as const) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(note.frequency * multiple, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(peak * share, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + note.duration + 0.02);
      }
    }
  } catch {
    // No sound is better than a broken screen (§2 AC-4).
  }
}

const C6 = 1046.5;
const G6 = 1568;

/** A right answer: two notes going up, about a quarter of a second (AC-1). */
export function playCorrect(): void {
  play([
    { at: 0, duration: 0.14, frequency: C6 },
    { at: 0.07, duration: 0.26, frequency: G6 },
  ]);
}

/** C major pentatonic, from C5: it never sounds wrong, however high it goes. */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880];

/** The exam result's n-th tick, a step above the one before (AC-2). */
export function examTickFrequency(index: number): number {
  const octave = Math.floor(index / PENTATONIC.length);
  return PENTATONIC[index % PENTATONIC.length] * 2 ** Math.min(octave, 2);
}

export function playExamTick(index: number): void {
  play([
    {
      at: 0,
      duration: 0.12,
      frequency: examTickFrequency(index),
      volume: 0.12,
    },
  ]);
}

/** Passed: a rising C major arpeggio, ending on the chord (AC-2). */
export function playVictory(): void {
  play([
    { at: 0, duration: 0.2, frequency: 523.25 },
    { at: 0.09, duration: 0.2, frequency: 659.25 },
    { at: 0.18, duration: 0.2, frequency: 783.99 },
    { at: 0.27, duration: 0.7, frequency: 1046.5, volume: 0.18 },
    { at: 0.27, duration: 0.7, frequency: 659.25, volume: 0.1 },
    { at: 0.27, duration: 0.7, frequency: 783.99, volume: 0.1 },
  ]);
}

interface ExamResultSounds {
  correct: number;
  /** How long the score takes to count up. */
  durationMs: number;
  onTick: (index: number) => void;
  onVictory: () => void;
  passed: boolean;
}

/** The pause between the last tick and the victory. */
const VICTORY_DELAY_MS = 250;

/**
 * The exam result's sounds (§2 AC-2): one tick per correct answer, spread
 * over the score's count-up, then the victory when it passed. Returns a
 * way to stop them, for when the result closes.
 */
export function scheduleExamResult({
  correct,
  durationMs,
  onTick,
  onVictory,
  passed,
}: ExamResultSounds): () => void {
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  if (correct > 0) {
    const gap = durationMs / correct;
    for (let index = 0; index < correct; index += 1) {
      timeouts.push(setTimeout(() => onTick(index), index * gap));
    }
  }
  if (passed && correct > 0) {
    timeouts.push(setTimeout(onVictory, durationMs + VICTORY_DELAY_MS));
  }
  return () => {
    for (const timeout of timeouts) {
      clearTimeout(timeout);
    }
  };
}
