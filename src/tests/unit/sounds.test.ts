import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (docs/specs/gamification.md §2): the correct-answer sounds,
 * made in the app with Web Audio, and when the exam result plays them.
 */

const { examTickFrequency, scheduleExamResult } = await import(
  "@/utils/sounds"
);

/**
 * The module keeps its audio context once made, so each test that plays
 * loads it afresh, with its own stand-in.
 */
async function loadSounds() {
  vi.resetModules();
  return await import("@/utils/sounds");
}

/** A stand-in for Web Audio: it records the notes it is asked to play. */
function fakeAudio() {
  const started: number[] = [];
  /** The pitch of each oscillator, in the order they were made. */
  const pitches: number[] = [];
  const param = () => ({
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
  });
  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    state = "running";
    resume = vi.fn();
    createOscillator() {
      return {
        connect: vi.fn(),
        frequency: {
          ...param(),
          setValueAtTime: (value: number) => pitches.push(value),
        },
        start: (at: number) => started.push(at),
        stop: vi.fn(),
        type: "sine",
      };
    }
    createGain() {
      return { connect: vi.fn(), gain: param() };
    }
  }
  const Ctor = vi.fn(function (this: unknown) {
    return new FakeAudioContext();
  });
  return { Ctor, pitches, started };
}

describe("sounds (gamification.md §2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("plays a short rising pair of notes on a correct answer (AC-1)", async () => {
    const audio = fakeAudio();
    vi.stubGlobal("AudioContext", audio.Ctor);
    const { playCorrect } = await loadSounds();

    playCorrect();

    expect(audio.started.length).toBeGreaterThanOrEqual(2);
  });

  it("plays a lower pair of notes going down on a wrong answer (AC-1)", async () => {
    const right = fakeAudio();
    vi.stubGlobal("AudioContext", right.Ctor);
    (await loadSounds()).playCorrect();
    const wrong = fakeAudio();
    vi.stubGlobal("AudioContext", wrong.Ctor);
    (await loadSounds()).playWrong();

    expect(wrong.started.length).toBeGreaterThanOrEqual(2);
    // Going down, and below every note of a right answer.
    expect(wrong.pitches[0]).toBeGreaterThan(wrong.pitches.at(-1) ?? 0);
    expect(Math.max(...wrong.pitches)).toBeLessThan(Math.min(...right.pitches));
  });

  it("plays nothing when sounds are off (AC-3)", async () => {
    const audio = fakeAudio();
    vi.stubGlobal("AudioContext", audio.Ctor);
    const { playCorrect, playWrong, setSoundsEnabled } = await loadSounds();
    setSoundsEnabled(false);

    playCorrect();
    playWrong();

    expect(audio.started).toEqual([]);
  });

  it("goes on without sound when there is no audio (AC-4)", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const { playCorrect, playWrong } = await loadSounds();

    expect(() => playCorrect()).not.toThrow();
    expect(() => playWrong()).not.toThrow();
  });

  it("raises each exam tick a little above the last", () => {
    const frequencies = [0, 1, 2, 3, 4, 5, 6].map(examTickFrequency);

    for (let index = 1; index < frequencies.length; index += 1) {
      expect(frequencies[index]).toBeGreaterThan(frequencies[index - 1]);
    }
  });

  describe("the exam result (AC-2)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("plays one tick per correct answer while the score counts, then the victory if passed", () => {
      const onTick = vi.fn();
      const onVictory = vi.fn();

      scheduleExamResult({
        correct: 3,
        durationMs: 1500,
        onTick,
        onVictory,
        passed: true,
      });
      vi.advanceTimersByTime(1400);
      expect(onTick.mock.calls.map(([index]) => index)).toEqual([0, 1, 2]);
      expect(onVictory).not.toHaveBeenCalled();

      vi.advanceTimersByTime(600);
      expect(onVictory).toHaveBeenCalledTimes(1);
    });

    it("plays no victory when it did not pass, and nothing with no correct answer", () => {
      const onTick = vi.fn();
      const onVictory = vi.fn();

      scheduleExamResult({
        correct: 0,
        durationMs: 1500,
        onTick,
        onVictory,
        passed: false,
      });
      vi.advanceTimersByTime(3000);

      expect(onTick).not.toHaveBeenCalled();
      expect(onVictory).not.toHaveBeenCalled();
    });

    it("stops when cancelled, as when the result closes", () => {
      const onTick = vi.fn();
      const cancel = scheduleExamResult({
        correct: 5,
        durationMs: 1500,
        onTick,
        onVictory: vi.fn(),
        passed: true,
      });

      vi.advanceTimersByTime(400);
      cancel();
      const ticked = onTick.mock.calls.length;
      vi.advanceTimersByTime(3000);

      expect(onTick).toHaveBeenCalledTimes(ticked);
    });
  });
});
