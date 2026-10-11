import axios from "axios";

// Long enough for a slow connection or the server waking from sleep; short
// enough that nobody stares at "Loading…" wondering if it is broken.
export const REQUEST_TIMEOUT_MS = 20000;
// AI drafting asks one model and, if it is busy, a second (20 s each on the
// server), so it gets a longer limit of its own.
export const AI_DRAFT_TIMEOUT_MS = 60000;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // The session lives in an httpOnly cookie now, not a token this code can
  // read -- the browser attaches it by itself as long as every request asks
  // to send credentials.
  withCredentials: true,
  // Without a limit, a request the server never answers leaves the page on
  // "Loading…" forever. After this long it fails instead, and the page can
  // say so and offer to try again.
  timeout: REQUEST_TIMEOUT_MS,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
