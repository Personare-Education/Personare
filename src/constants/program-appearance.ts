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

import { BRAND_PROGRAM_COLOR } from "./program-palette";

// biome-ignore lint/performance/noBarrelFile: the palette lives without React for the MCP server; the app keeps importing it from here.
export { BRAND_PROGRAM_COLOR, PROGRAM_COLORS } from "./program-palette";

export const DEFAULT_PROGRAM_COLOR = BRAND_PROGRAM_COLOR;

export function resolveProgramIcon(name: string | null): LucideIcon {
  const icon = name ? PROGRAM_ICON_MAP[name] : null;
  return icon ?? PROGRAM_ICON_MAP[DEFAULT_PROGRAM_ICON_NAME];
}

export function resolveProgramColor(color: string | null): string {
  return color ?? DEFAULT_PROGRAM_COLOR;
}
