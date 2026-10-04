import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import KeyHint from "@/components/key-hint";
import { Button } from "@/components/ui/button";
import { formatInterval } from "@/utils/review-time";
import { cn } from "@/utils/tailwind";

export type RatingValue = "again" | "hard" | "good" | "easy";

export const RATINGS: RatingValue[] = ["again", "hard", "good", "easy"];

/** Which words a rating uses: a flashcard's, or a whole activity's. */
export type RatingScale = "activity" | "flashcard";

/**
 * Flashcards keep FSRS's own words; a whole activity -- a PDF, a link, a
 * quiz -- gets words that fit it (docs/specs/rating-clarity.md AC-2). The
 * stored values do not change.
 */
export const RATING_LABEL_KEYS: Record<
  RatingScale,
  Record<RatingValue, string>
> = {
  activity: {
    again: "activityRatingAgainAction",
    easy: "activityRatingEasyAction",
    good: "activityRatingGoodAction",
    hard: "activityRatingHardAction",
  },
  flashcard: {
    again: "ratingAgainAction",
    easy: "ratingEasyAction",
    good: "ratingGoodAction",
    hard: "ratingHardAction",
  },
};

/**
 * Each rating's tone, from "again" to "easy" (docs/specs/polish.md AC-1): a
 * light fill and border in it, the label in the foreground for contrast.
 */
export const RATING_TONES: Record<RatingValue, string> = {
  again: "var(--destructive)",
  easy: "var(--brand)",
  good: "var(--success)",
  hard: "var(--warning)",
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
  autoFocus: boolean;
  disabled: boolean;
  interval: Date | undefined;
  label: string;
  onClick: (rating: RatingValue) => void;
  rating: RatingValue;
  shortcut: string;
  suggested: boolean;
}

function RatingButton({
  autoFocus,
  disabled,
  interval,
  label,
  onClick,
  rating,
  shortcut,
  suggested,
}: RatingButtonProps) {
  const intervalId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Focus lands on the rating once the answer shows, instead of falling to
  // the page when the reveal button goes (docs/specs/review-focus-errors.md AC-1).
  useEffect(() => {
    if (autoFocus) {
      buttonRef.current?.focus();
    }
  }, [autoFocus]);
  const handleClick = useCallback(() => {
    if (!disabled) {
      onClick(rating);
    }
  }, [disabled, onClick, rating]);

  return (
    <Button
      aria-describedby={interval ? intervalId : undefined}
      // aria-disabled, not disabled: the button keeps focus while saving.
      aria-disabled={disabled || undefined}
      aria-keyshortcuts={shortcut}
      // The suggested one is outlined in its tone
      // (docs/specs/quiz-result-rating.md AC-2).
      className={cn(
        "!border-[color-mix(in_srgb,var(--tone)_45%,transparent)] !bg-[color-mix(in_srgb,var(--tone)_12%,transparent)] hover:!bg-[color-mix(in_srgb,var(--tone)_22%,transparent)] h-auto min-h-7 flex-col gap-0 py-1 text-foreground leading-tight",
        suggested &&
          "ring-2 ring-[var(--tone)] ring-offset-1 ring-offset-background"
      )}
      data-suggested={suggested || undefined}
      onClick={handleClick}
      ref={buttonRef}
      style={{ "--tone": RATING_TONES[rating] } as CSSProperties}
      variant="outline"
    >
      {/* The key beside the name (docs/specs/key-hints.md AC-1). */}
      <span className="flex items-center gap-1.5">
        {label}
        <KeyHint>{shortcut}</KeyHint>
      </span>
      {interval ? (
        // The rating stays the button's name; the interval is its
        // description (AC-1).
        <span
          aria-hidden="true"
          className="font-normal text-[0.6875rem] opacity-70"
          id={intervalId}
        >
          {formatInterval(interval, new Date())}
        </span>
      ) : null}
    </Button>
  );
}

interface RatingButtonsProps {
  /** Focus "good", the usual answer, when the buttons show up. */
  autoFocus?: boolean;
  /** While a rating is being saved: no clicks, no keys (AC-4). */
  disabled?: boolean;
  /** When the next review would be for each rating, if known. */
  intervals?: Partial<Record<RatingValue, Date>>;
  onRate: (rating: RatingValue) => void;
  scale?: RatingScale;
  /** One rating to point out, e.g. from a quiz's score; focus starts there. */
  suggested?: RatingValue;
}

/**
 * Again / Hard / Good / Easy, also on the keys 1-4 while mounted, each with
 * the interval it would schedule. Shared by the flashcard review, the
 * activity rating and the "Today" session.
 */
export function RatingButtons({
  autoFocus = false,
  disabled = false,
  intervals,
  onRate,
  scale = "flashcard",
  suggested,
}: RatingButtonsProps) {
  const { t } = useTranslation();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const rating = RATING_BY_KEY[event.key];
      if (
        !rating ||
        disabled ||
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
  }, [disabled, onRate]);

  return (
    <>
      {RATINGS.map((rating, index) => (
        <RatingButton
          autoFocus={autoFocus && rating === (suggested ?? "good")}
          disabled={disabled}
          interval={intervals?.[rating]}
          key={rating}
          label={t(RATING_LABEL_KEYS[scale][rating])}
          onClick={onRate}
          rating={rating}
          shortcut={String(index + 1)}
          suggested={rating === suggested}
        />
      ))}
    </>
  );
}

/**
 * Said beside the buttons when a rating could not be saved; the item stays,
 * so rating again retries (docs/specs/review-focus-errors.md AC-3).
 */
export function RatingSaveError() {
  const { t } = useTranslation();
  return (
    <p className="text-destructive-text text-sm" role="alert">
      {t("ratingSaveErrorMessage")}
    </p>
  );
}
