import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // The session lives in an httpOnly cookie now, not a token this code can
  // read -- the browser attaches it by itself as long as every request asks
  // to send credentials.
  withCredentials: true,
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
