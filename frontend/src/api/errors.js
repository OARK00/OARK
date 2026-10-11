export const NO_ANSWER_MESSAGE = "Oark's server did not answer. Check your connection and try again.";

// True when the request never got an answer: the connection dropped, the
// server was unreachable, or the time limit in client.js ran out. Different
// from "the server answered with an error", which has its own message.
export function isNoAnswer(err) {
  // axios puts the server's answer on the error as `response`; when the
  // server never answered at all, there is none.
  return !err.response;
}

// FastAPI's `detail` is a string for most errors, but a list of
// {msg, loc, ...} objects for 422 validation errors -- never assume it's
// renderable as-is.
export function getErrorMessage(err, fallback) {
  if (isNoAnswer(err)) return NO_ANSWER_MESSAGE;
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join(" ");
  }
  return fallback;
}
