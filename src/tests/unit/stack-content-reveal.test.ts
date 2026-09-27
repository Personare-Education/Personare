import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installStackContentReveal,
  isStackEntering,
  subscribeStackEntering,
} from "@/utils/stack-content-reveal";

/**
 * docs/specs/calendar-module-review-highlight.md AC-9/10: during a stack
 * push/pop only the empty content panel slides. The new page mounts once
 * the slide ends (then fades in): mounted earlier, it showed up mid-slide
 * over the old page, and rendering it (a heavy programs grid, as its data
 * arrives) made the slide stutter.
 */

interface FakeTransition {
  finish: () => void;
  finished: Promise<void>;
  updateCallbackDone: Promise<void>;
}

let transitions: FakeTransition[];

function noop(): void {
  // Stands in for the router's update callback.
}

beforeEach(() => {
  transitions = [];

  document.startViewTransition = vi.fn(
    (options: StartViewTransitionOptions | ViewTransitionUpdateCallback) => {
      const update = typeof options === "function" ? options : options.update;
      let finish: () => void = noop;
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const updateCallbackDone = Promise.resolve(update?.());
      const transition = { finish, finished, updateCallbackDone };
      transitions.push(transition);
      return transition as unknown as ViewTransition;
    }
  ) as unknown as typeof document.startViewTransition;
});

// Ends every slide, so the shared flag starts the next test lowered.
afterEach(async () => {
  for (const transition of transitions) {
    transition.finish();
  }
  await Promise.all(transitions.map((transition) => transition.finished));
  await Promise.resolve();
});

describe("installStackContentReveal", () => {
  it("holds the new page back from the router's update until the slide ends", async () => {
    installStackContentReveal(document);
    const changes: boolean[] = [];
    const unsubscribe = subscribeStackEntering(() =>
      changes.push(isStackEntering())
    );
    let enteringDuringUpdate: boolean | undefined;

    document.startViewTransition({
      types: ["stack-push"],
      update: () => {
        enteringDuringUpdate = isStackEntering();
      },
    });
    await transitions[0].updateCallbackDone;

    // Set before the router's update renders the new page -- after the old
    // page was captured, which happens before the update is called.
    expect(enteringDuringUpdate).toBe(true);
    expect(isStackEntering()).toBe(true);

    transitions[0].finish();
    await transitions[0].finished;
    await Promise.resolve();

    expect(isStackEntering()).toBe(false);
    expect(changes).toEqual([true, false]);
    unsubscribe();
  });

  it("does the same on a pop", async () => {
    installStackContentReveal(document);

    document.startViewTransition({ types: ["stack-pop"], update: noop });
    await transitions[0].updateCallbackDone;

    expect(isStackEntering()).toBe(true);
  });

  it("leaves other view transitions alone", async () => {
    installStackContentReveal(document);

    document.startViewTransition(noop);
    await transitions[0].updateCallbackDone;

    expect(isStackEntering()).toBe(false);
  });
});
