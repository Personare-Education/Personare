import { cn } from "@/utils/tailwind";

/**
 * Personare's logo, the same drawing as the website's (placeholder until the
 * final brand asset, docs/specs/app-icon.md): a 2x2 grid of rounded squares,
 * three in the foreground color at rising opacity and the last in the brand
 * blue -- a nod to the study heatmap.
 */
export default function PersonareLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-6", className)}
      viewBox="0 0 24 24"
    >
      <rect
        className="fill-foreground/15"
        height="10"
        rx="2.5"
        width="10"
        x="1"
        y="1"
      />
      <rect
        className="fill-foreground/35"
        height="10"
        rx="2.5"
        width="10"
        x="13"
        y="1"
      />
      <rect
        className="fill-foreground/60"
        height="10"
        rx="2.5"
        width="10"
        x="1"
        y="13"
      />
      <rect
        className="fill-brand"
        height="10"
        rx="2.5"
        width="10"
        x="13"
        y="13"
      />
    </svg>
  );
}
