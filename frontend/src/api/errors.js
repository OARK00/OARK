// FastAPI's `detail` is a string for most errors, but a list of
// {msg, loc, ...} objects for 422 validation errors -- never assume it's
// renderable as-is.
export function getErrorMessage(err, fallback) {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join(" ");
  }
  return fallback;
}
