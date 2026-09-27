// biome-ignore-all lint/style/useFilenamingConvention: TanStack Router file-based routing requires the "$paramName" filename convention for dynamic route segments.
import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Pathless layout: TanStack Router's flat-file convention nests
 * `programs.$programId.modules.$moduleId.tsx` under this route (its
 * filename is a prefix match), so this component must render an
 * `<Outlet />` for that child route to ever mount. The actual Modules
 * list UI lives in the sibling index route, `programs.$programId.index.tsx`
 * (`/programs/$programId/`), which renders through this Outlet too.
 */
export interface ProgramSearch {
  /** Local day (`yyyy-MM-dd`) of the calendar event that led here. */
  focusDate?: string;
  /** Module to pulse, then open (docs/specs/calendar-module-review-highlight.md). */
  focusModuleId?: string;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Declared here, on the layout, so both children (the modules list and a
 * module's activities) read the same calendar focus.
 */
export const Route = createFileRoute("/programs/$programId")({
  component: Outlet,
  validateSearch: (search: Record<string, unknown>): ProgramSearch => ({
    focusDate: optionalString(search.focusDate),
    focusModuleId: optionalString(search.focusModuleId),
  }),
});
