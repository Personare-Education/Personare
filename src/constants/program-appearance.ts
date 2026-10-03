import {
  Atom,
  Binary,
  Book,
  BookOpen,
  Brain,
  Calculator,
  Code2,
  Compass,
  Database,
  Dna,
  Dumbbell,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Languages,
  Leaf,
  Lightbulb,
  LineChart,
  type LucideIcon,
  Microscope,
  Music,
  Palette,
  PenTool,
  PieChart,
  Puzzle,
  Rocket,
  Scale,
  Sigma,
  Telescope,
  Terminal,
  Trophy,
} from "lucide-react";

export const PROGRAM_ICONS: { Icon: LucideIcon; name: string }[] = [
  { Icon: BookOpen, name: "BookOpen" },
  { Icon: Book, name: "Book" },
  { Icon: GraduationCap, name: "GraduationCap" },
  { Icon: Brain, name: "Brain" },
  { Icon: FlaskConical, name: "FlaskConical" },
  { Icon: Microscope, name: "Microscope" },
  { Icon: Calculator, name: "Calculator" },
  { Icon: Sigma, name: "Sigma" },
  { Icon: Atom, name: "Atom" },
  { Icon: Dna, name: "Dna" },
  { Icon: Globe, name: "Globe" },
  { Icon: Languages, name: "Languages" },
  { Icon: Code2, name: "Code2" },
  { Icon: Terminal, name: "Terminal" },
  { Icon: Palette, name: "Palette" },
  { Icon: Music, name: "Music" },
  { Icon: PenTool, name: "PenTool" },
  { Icon: Scale, name: "Scale" },
  { Icon: Landmark, name: "Landmark" },
  { Icon: Compass, name: "Compass" },
  { Icon: LineChart, name: "LineChart" },
  { Icon: PieChart, name: "PieChart" },
  { Icon: Database, name: "Database" },
  { Icon: Binary, name: "Binary" },
  { Icon: Rocket, name: "Rocket" },
  { Icon: Telescope, name: "Telescope" },
  { Icon: Leaf, name: "Leaf" },
  { Icon: Heart, name: "Heart" },
  { Icon: Dumbbell, name: "Dumbbell" },
  { Icon: Trophy, name: "Trophy" },
  { Icon: Lightbulb, name: "Lightbulb" },
  { Icon: Puzzle, name: "Puzzle" },
];

const PROGRAM_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  PROGRAM_ICONS.map(({ Icon, name }) => [name, Icon])
);

export const DEFAULT_PROGRAM_ICON_NAME = "BookOpen";

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

export const DEFAULT_PROGRAM_COLOR = BRAND_PROGRAM_COLOR;

export function resolveProgramIcon(name: string | null): LucideIcon {
  const icon = name ? PROGRAM_ICON_MAP[name] : null;
  return icon ?? PROGRAM_ICON_MAP[DEFAULT_PROGRAM_ICON_NAME];
}

export function resolveProgramColor(color: string | null): string {
  return color ?? DEFAULT_PROGRAM_COLOR;
}
