import * as Sentry from "@sentry/react";

// The Sentry library itself. Loaded on its own, after the page is on screen
// (see errorTracking.js), because it is the largest single piece of code the
// app carries and no visitor should wait for it.
//
// Crash reports carry nothing personal or secret. Sentry 11 collects user
// info, cookies, headers, request bodies and local variables BY DEFAULT --
// every one is switched off here on purpose; only the error and where it
// happened may leave Oark.
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

export function start(dsn) {
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

export function report(error) {
  Sentry.captureException(error);
}
