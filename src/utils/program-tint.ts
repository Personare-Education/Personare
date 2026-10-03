import type { CSSProperties } from "react";

interface ProgramTintOptions {
  /** Where the gradient ends, from the top. */
  fadeAt?: string;
  /** How much of the color the top of the gradient carries. */
  strength?: string;
}

/**
 * A program's color on a surface: a tinted gradient from the top and a
 * colored ring with a soft shadow below. One definition for the program cards, the
 * flashcards and the "Today" items (docs/specs/today-review-queue.md), so
 * the program's color reads the same everywhere.
 */
export function programTintStyle(
  color: string,
  {
    fadeAt = "75%",
    strength = "var(--card-tint-strength)",
  }: ProgramTintOptions = {}
): CSSProperties {
  return {
    backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${color} ${strength}, transparent), transparent ${fadeAt})`,
    // A 1px ring and a soft shadow cast downward: depth, not a halo all
    // around (docs/specs/polish.md AC-4).
    boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 35%, transparent), 0 8px 20px -10px color-mix(in srgb, ${color} 45%, transparent)`,
  };
}
