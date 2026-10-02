import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export type RatingValue = "again" | "hard" | "good" | "easy";

export const RATINGS: RatingValue[] = ["again", "hard", "good", "easy"];

const RATING_TRANSLATION_KEYS: Record<RatingValue, string> = {
  again: "ratingAgainAction",
  easy: "ratingEasyAction",
  good: "ratingGoodAction",
  hard: "ratingHardAction",
};

/** The keys 1-4 rate, in the buttons' order (docs/specs/today-review-queue.md AC-7). */
const RATING_BY_KEY: Record<string, RatingValue> = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy",
};

/** Typing in a field must never rate anything. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
  );
}

interface RatingButtonProps {
  label: string;
  onClick: (rating: RatingValue) => void;
  rating: RatingValue;
  shortcut: string;
}

function RatingButton({ label, onClick, rating, shortcut }: RatingButtonProps) {
  const handleClick = useCallback(() => {
    onClick(rating);
  }, [onClick, rating]);

  return (
    <Button aria-keyshortcuts={shortcut} onClick={handleClick}>
      {label}
    </Button>
  );
}

interface RatingButtonsProps {
  onRate: (rating: RatingValue) => void;
}

/**
 * Again / Hard / Good / Easy, also on the keys 1-4 while mounted. Shared by
 * the flashcard review and the activity rating in the "Today" session.
 */
export function RatingButtons({ onRate }: RatingButtonsProps) {
  const { t } = useTranslation();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const rating = RATING_BY_KEY[event.key];
      if (
        !rating ||
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTypingTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      onRate(rating);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onRate]);

  return (
    <>
      {RATINGS.map((rating, index) => (
        <RatingButton
          key={rating}
          label={t(RATING_TRANSLATION_KEYS[rating])}
          onClick={onRate}
          rating={rating}
          shortcut={String(index + 1)}
        />
      ))}
    </>
  );
}
