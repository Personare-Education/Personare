import { LOCAL_STORAGE_KEYS } from "@/constants";

/**
 * The app's text sizes (docs/specs/text-size.md), as a share of the
 * browser's base font size. Almost everything is in rem, so text and
 * spacing scale together.
 */
export const TEXT_SIZES = {
  default: 1,
  large: 1.125,
  larger: 1.25,
  small: 0.9,
} as const;

export type TextSize = keyof typeof TEXT_SIZES;

/** In the order the setting lists them. */
export const TEXT_SIZE_ORDER: TextSize[] = [
  "small",
  "default",
  "large",
  "larger",
];

function isTextSize(value: string | null): value is TextSize {
  return value !== null && Object.hasOwn(TEXT_SIZES, value);
}

export function getTextSize(): TextSize {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.TEXT_SIZE);
    return isTextSize(saved) ? saved : "default";
  } catch {
    return "default";
  }
}

function applyTextSize(size: TextSize) {
  document.documentElement.style.fontSize = `${TEXT_SIZES[size] * 100}%`;
}

export function setTextSize(size: TextSize) {
  applyTextSize(size);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.TEXT_SIZE, size);
  } catch {
    // Storage unavailable: the size still applies for this session.
  }
}

/** On app start: the size chosen last time, or the default. */
export function applySavedTextSize() {
  applyTextSize(getTextSize());
}
