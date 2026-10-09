import { useEffect, useState } from "react";
import api from "../api/client";
import { AuthContext } from "./useAuth";

export function AuthProvider({ children }) {
  const [email, setEmail] = useState(null);
  // True until the first /auth/me check resolves. A route guard must wait
  // for this instead of treating "no email yet" as "not logged in" --
  // otherwise every refresh flashes the login page before the httpOnly
  // cookie has had a chance to prove there's already a session.
  const [checking, setChecking] = useState(true);

  // The cookie itself isn't readable here, so whether a session exists is
  // only knowable by asking the backend.
  useEffect(() => {
    api
      .get("/auth/me")
      .then(({ data }) => setEmail(data.email))
      .catch(() => setEmail(null))
      .finally(() => setChecking(false));
  }, []);

  async function login(emailInput, password) {
    await api.post("/auth/login", { email: emailInput, password });
    setEmail(emailInput);
  }

  async function register(emailInput, password) {
    await api.post("/auth/register", { email: emailInput, password });
    setEmail(emailInput);
  }

  function logout() {
    // Cleared locally right away so the UI never waits on the network for
    // this; the request below only tells the server to drop its cookie.
    setEmail(null);
    api.post("/auth/logout").catch(() => {
      // Nothing to recover: the cookie is httpOnly, so there's nothing more
      // this page could do about it either way.
    });
  }

  return (
    <AuthContext.Provider value={{ email, checking, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
