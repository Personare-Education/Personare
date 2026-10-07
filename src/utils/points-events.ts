/**
 * Tells the rank badge the points changed (docs/specs/gamification.md §4):
 * a quiz, an exam or the day's settling, anywhere in the app. Ratings
 * already say so through review-events.ts.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyPointsChanged() {
  for (const listener of listeners) {
    listener();
  }
}

export function onPointsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
