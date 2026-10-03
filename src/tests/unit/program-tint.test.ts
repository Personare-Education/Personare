import { describe, expect, it } from "vitest";
import { programTintStyle } from "@/utils/program-tint";

/** docs/specs/polish.md AC-4: depth with an offset, not a zero-offset halo. */
describe("programTintStyle", () => {
  it("keeps the 1px ring in the program's color", () => {
    expect(programTintStyle("#22c55e").boxShadow).toContain(
      "0 0 0 1px color-mix(in srgb, #22c55e"
    );
  });

  it("casts a soft shadow downward instead of a glow all around", () => {
    const { boxShadow } = programTintStyle("#22c55e");

    expect(boxShadow).not.toContain("0 0 20px");
    expect(boxShadow).toMatch(
      /0 \d+px \d+px -\d+px color-mix\(in srgb, #22c55e/
    );
  });
});
