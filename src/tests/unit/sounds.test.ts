import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (docs/specs/gamification.md §2): the correct-answer sounds,
 * made in the app with Web Audio, and when the exam result plays them.
 */

const { examTickFrequency, playCorrect, scheduleExamResult, setSoundsEnabled } =
  await import("@/utils/sounds");

/** A stand-in for Web Audio: it records the notes it is asked to play. */
function fakeAudio() {
  const started: number[] = [];
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
        frequency: param(),
        start: (at: number) => started.push(at),
        stop: vi.fn(),
        type: "sine",
      };
    }
    createGain() {
      return { connect: vi.fn(), gain: param() };
    }
  }
  const constructed = vi.fn();
  const Ctor = vi.fn(function (this: unknown) {
    constructed();
    return new FakeAudioContext();
  });
  return { Ctor, constructed, started };
}

describe("sounds (gamification.md §2)", () => {
  beforeEach(() => {
    setSoundsEnabled(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("plays a short rising pair of notes on a correct answer (AC-1)", () => {
    const audio = fakeAudio();
    vi.stubGlobal("AudioContext", audio.Ctor);

    playCorrect();

    expect(audio.started.length).toBeGreaterThanOrEqual(2);
  });

  it("plays nothing when sounds are off (AC-3)", () => {
    const audio = fakeAudio();
    vi.stubGlobal("AudioContext", audio.Ctor);
    setSoundsEnabled(false);

    playCorrect();

    expect(audio.started).toEqual([]);
  });

  it("goes on without sound when there is no audio (AC-4)", () => {
    vi.stubGlobal("AudioContext", undefined);

    expect(() => playCorrect()).not.toThrow();
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
