import i18n from "i18next";
import { describe, expect, it } from "vitest";
import "@/localization/i18n";
import { describeLock } from "@/utils/lock-text";

/**
 * RED phase (docs/specs/sequences-and-locks.md §4 AC-2): what a padlock
 * says is missing.
 */

const NAMES = { a: "Capítulo 1", b: "Videoaula", m: "Esqueleto" };

describe("describeLock", () => {
  it("joins what is missing with 'and'", () => {
    expect(
      describeLock(
        i18n.t,
        "en",
        {
          locked: true,
          missing: [
            { id: "a", kind: "activity" },
            { id: "b", kind: "activity" },
          ],
        },
        "all",
        NAMES
      )
    ).toBe(i18n.t("lockMissingLabel", { items: "Capítulo 1 and Videoaula" }));
  });

  it("joins with 'or' for an any-of rule", () => {
    expect(
      describeLock(
        i18n.t,
        "en",
        {
          locked: true,
          missing: [
            { id: "a", kind: "activity" },
            { id: "b", kind: "activity" },
          ],
        },
        "any",
        NAMES
      )
    ).toBe(i18n.t("lockMissingLabel", { items: "Capítulo 1 or Videoaula" }));
  });

  it("says it waits for its module (or sequence) to unlock", () => {
    expect(
      describeLock(
        i18n.t,
        "en",
        { locked: true, missing: [{ id: "m", kind: "module" }], waiting: true },
        "none",
        NAMES
      )
    ).toBe(i18n.t("lockWaitingLabel", { item: "Esqueleto" }));
  });
});
