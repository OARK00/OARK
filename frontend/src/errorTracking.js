import * as Sentry from "@sentry/react";

// Crash reports to Sentry, with nothing personal or secret in them.
// Off unless VITE_SENTRY_DSN is set at build time, so local development
// never sends anything. Sentry 11 collects user info, cookies, headers,
// request bodies and local variables BY DEFAULT -- every one is switched off
// here on purpose; only the error and where it happened may leave Oark.
const dsn = import.meta.env.VITE_SENTRY_DSN;

function scrub(event) {
  delete event.user;
  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
  }
  return event;
}

export const errorTrackingOn = Boolean(dsn);

if (errorTrackingOn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    // Errors only: no performance tracing and no session replay.
    tracesSampleRate: 0,
    beforeSend: scrub,
  });
}

// React's own error hooks (createRoot options). Without them, errors that
// React catches while drawing a page would never reach Sentry.
export const reactErrorHooks = errorTrackingOn
  ? {
      onUncaughtError: Sentry.reactErrorHandler(),
      onCaughtError: Sentry.reactErrorHandler(),
      onRecoverableError: Sentry.reactErrorHandler(),
    }
  : {};
