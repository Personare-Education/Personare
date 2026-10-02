import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import { programTintStyle } from "@/utils/program-tint";
import { cn } from "@/utils/tailwind";

export type FlipCardFace = "back" | "front";

const FLIP_KEYS = new Set(["Enter", " "]);

/**
 * The program's color on the card, the same treatment as the program cards.
 * The back is a little more tinted, so the two faces read apart.
 */
function faceStyle(color: string, face: FlipCardFace): CSSProperties {
  return programTintStyle(color, {
    strength:
      face === "back"
        ? "calc(var(--card-tint-strength) + 12%)"
        : "var(--card-tint-strength)",
  });
}

interface FaceProps {
  children: ReactNode;
  color: string;
  face: FlipCardFace;
  hint?: string;
  isHighlighted: boolean;
  isVisible: boolean;
  label: string;
}

function Face({
  children,
  color,
  face,
  hint,
  isHighlighted,
  isVisible,
  label,
}: FaceProps) {
  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        "backface-hidden flex min-h-44 flex-col gap-2 rounded-xl bg-card p-4 [grid-area:1/1]",
        face === "back" && "rotate-y-180",
        isHighlighted && "ring-2 ring-ring/40"
      )}
      data-face={face}
      style={faceStyle(color, face)}
    >
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex flex-1 items-center justify-center text-center">
        {children}
      </div>
      {hint ? (
        <span className="self-center text-[0.625rem] text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

interface FlipCardProps {
  back: ReactNode;
  backLabel: string;
  className?: string;
  /** The program's color (docs/specs/flashcard-editor-and-creation-flow.md). */
  color: string;
  flipped: boolean;
  front: ReactNode;
  frontLabel: string;
  /** A face drawn with a focus ring, e.g. the one being edited. */
  highlightedFace?: FlipCardFace | null;
  hint?: string;
  onFlip: () => void;
}

/**
 * A flashcard that flips around its vertical axis
 * (docs/specs/flashcard-editor-and-creation-flow.md AC-6/AC-11), used by
 * the flashcard editor and by the review session. The hidden face is
 * aria-hidden. Remount it (a `key`) to show another card on its front
 * without flipping back through the new card's back.
 */
export default function FlipCard({
  back,
  backLabel,
  className,
  color,
  flipped,
  front,
  frontLabel,
  highlightedFace = null,
  hint,
  onFlip,
}: FlipCardProps) {
  const { t } = useTranslation();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (FLIP_KEYS.has(event.key)) {
        event.preventDefault();
        onFlip();
      }
    },
    [onFlip]
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: the card holds Markdown blocks, which a <button> cannot contain.
    <div
      aria-label={t("flipFlashcardAction")}
      aria-pressed={flipped}
      className={cn(
        "perspective-distant mx-auto w-full max-w-md cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        className
      )}
      onClick={onFlip}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div
        className={cn(
          "transform-3d grid transition-transform duration-500 ease-out motion-reduce:transition-none",
          flipped && "rotate-y-180"
        )}
      >
        <Face
          color={color}
          face="front"
          hint={hint}
          isHighlighted={highlightedFace === "front"}
          isVisible={!flipped}
          label={frontLabel}
        >
          {front}
        </Face>
        <Face
          color={color}
          face="back"
          hint={hint}
          isHighlighted={highlightedFace === "back"}
          isVisible={flipped}
          label={backLabel}
        >
          {back}
        </Face>
      </div>
    </div>
  );
}
