/**
 * The program colors and icon names, without React: the MCP server, which
 * runs in Claude Desktop's Node, offers them too (docs/specs/mcp-create-program.md).
 */

/** The brand blue (PRODUCT.md), shared with the website: a new program starts in it (docs/specs/bolder-cards.md AC-1). */
export const BRAND_PROGRAM_COLOR = "#3b6cf6";

/** Tailwind's 500-shade palette, same spread (warm to cool, plus neutrals) as the reference habit-tracker's color picker, with the brand blue in place of Tailwind's. */
export const PROGRAM_COLORS: string[] = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  BRAND_PROGRAM_COLOR,
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#94a3b8",
  "#9ca3af",
];

/** The program icons' names; src/constants/program-appearance.ts maps them to lucide icons. */
export const PROGRAM_ICON_NAMES: string[] = [
  "BookOpen",
  "Book",
  "GraduationCap",
  "Brain",
  "FlaskConical",
  "Microscope",
  "Calculator",
  "Sigma",
  "Atom",
  "Dna",
  "Globe",
  "Languages",
  "Code2",
  "Terminal",
  "Palette",
  "Music",
  "PenTool",
  "Scale",
  "Landmark",
  "Compass",
  "LineChart",
  "PieChart",
  "Database",
  "Binary",
  "Rocket",
  "Telescope",
  "Leaf",
  "Heart",
  "Dumbbell",
  "Trophy",
  "Lightbulb",
  "Puzzle",
];
