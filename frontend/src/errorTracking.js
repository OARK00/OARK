// Crash reporting without making anyone wait for it.
//
// Off unless VITE_SENTRY_DSN is set at build time, so local development
// never sends anything. When it is on, the Sentry library (sentrySetup.js)
// is fetched only after the page is on screen. Errors that happen before it
// arrives are kept in a short queue here and handed over when it does, so
// the first second of the app is not a blind spot.
const dsn = import.meta.env.VITE_SENTRY_DSN;
const MAX_WAITING = 20;

let report = null;
const waiting = [];

function note(error) {
  if (!error) return;
  if (report) report(error);
  else if (waiting.length < MAX_WAITING) waiting.push(error);
}

function onWindowError(event) {
  note(event.error || event.reason);
}

// React's own error hooks (createRoot options): without them, errors React
// catches while drawing a page would never be reported.
export const reactErrorHooks = dsn ? { onUncaughtError: note, onCaughtError: note, onRecoverableError: note } : {};

export function startErrorTracking() {
  if (!dsn) return;
  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onWindowError);

  import("./sentrySetup")
    .then((sentry) => {
      sentry.start(dsn);
      // From here Sentry listens to the window itself; ours would report twice.
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onWindowError);
      report = sentry.report;
      waiting.splice(0).forEach(report);
    })
    .catch(() => {
      // The library could not be fetched (offline, blocked). The app works
      // without crash reports; there is nobody to report this to.
    });
}
