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
 * No production backend is deployed yet (Issue #25/#26/#27 are still in
 * progress) -- this must become a real URL before Fase 2 ships to users.
 */
export const BACKEND_BASE_URL = "http://localhost:3333";

/**
 * The public website (personare-website), where the beta is applied for and
 * activated. Like BACKEND_BASE_URL, still the local dev server until it is
 * deployed.
 */
export const PERSONARE_SITE_URL = "http://localhost:5173";

export const OAUTH_PROTOCOL = "personare";
export const OAUTH_REDIRECT_URI = `${OAUTH_PROTOCOL}://oauth-callback`;
export const CALENDAR_CONNECT_REDIRECT_URI = `${OAUTH_PROTOCOL}://calendar-connect-callback`;
export const DRIVE_CONNECT_REDIRECT_URI = `${OAUTH_PROTOCOL}://drive-connect-callback`;
