import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RankEmblem from "@/components/rank-emblem";

/**
 * docs/specs/gamification.md §4: each division looks a step up from the
 * last -- III plain, II with a star, I with the star and an outline.
 */

function parts(division: 1 | 2 | 3 | null, tier = "silver" as const) {
  const { container } = render(
    <RankEmblem division={division} size={40} tier={tier} />
  );
  return {
    frame: container.querySelector('[data-part="frame"]'),
    lines: container.querySelectorAll("line").length,
    sparkle: container.querySelector('[data-part="sparkle"]'),
  };
}

describe("RankEmblem", () => {
  it("draws division III as the plain shape, with no star", () => {
    expect(parts(3)).toMatchObject({ frame: null, sparkle: null });
  });

  it("gives division II the star, and no brackets or outline", () => {
    const { frame, sparkle } = parts(2);
    expect(sparkle).not.toBeNull();
    expect(frame).toBeNull();
  });

  it("gives division I the star and a double outline, with nothing on top", () => {
    const { frame, sparkle } = parts(1);
    expect(sparkle).not.toBeNull();
    expect(frame?.children).toHaveLength(2);
  });

  it("draws Magnum without rays around it", () => {
    expect(parts(null, "magnum" as never).lines).toBe(0);
  });
});
