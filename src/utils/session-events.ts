const SESSION_CHANGED_EVENT = "personare:session-changed";

/**
 * Tells the beta gate (src/components/beta-gate.tsx) to check again, e.g.
 * after logging out or deleting the account in Settings, so the app locks
 * right away instead of on the next launch.
 */
export function notifySessionChanged() {
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function onSessionChanged(listener: () => void): () => void {
  window.addEventListener(SESSION_CHANGED_EVENT, listener);
  return () => window.removeEventListener(SESSION_CHANGED_EVENT, listener);
}
