export const LOCAL_STORAGE_KEYS = {
  LANGUAGE: "lang",
  THEME: "theme",
};

export const IPC_CHANNELS = {
  START_ORPC_SERVER: "start-orpc-server",
};

export const ENVIRONMENT_VARIABLES = {
  NODE_ENV: process.env.NODE_ENV,
};

export const inDevelopment = ENVIRONMENT_VARIABLES.NODE_ENV === "development";

/**
 * The shared backend (study-butler-backend on Fly.io). `npm start` talks to
 * a local one instead (docs/specs/production-urls.md). No trailing slash:
 * callers append the path.
 */
export const BACKEND_BASE_URL = inDevelopment
  ? "http://localhost:3333"
  : "https://personare-backend.fly.dev";

/**
 * The public website (personare-website), where the beta is applied for and
 * activated. Local dev server under `npm start`, like BACKEND_BASE_URL.
 */
export const PERSONARE_SITE_URL = inDevelopment
  ? "http://localhost:5173"
  : "https://personare-website.wandering-pond-32a8.workers.dev";

export const OAUTH_PROTOCOL = "personare";
export const OAUTH_REDIRECT_URI = `${OAUTH_PROTOCOL}://oauth-callback`;
export const CALENDAR_CONNECT_REDIRECT_URI = `${OAUTH_PROTOCOL}://calendar-connect-callback`;
export const DRIVE_CONNECT_REDIRECT_URI = `${OAUTH_PROTOCOL}://drive-connect-callback`;
