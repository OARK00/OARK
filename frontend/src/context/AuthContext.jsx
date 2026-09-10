import { createContext, useContext, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("oark_token"));
  const [email, setEmail] = useState(() => localStorage.getItem("oark_email"));

  async function login(emailInput, password) {
    const { data } = await api.post("/auth/login", { email: emailInput, password });
    localStorage.setItem("oark_token", data.access_token);
    localStorage.setItem("oark_email", emailInput);
    setToken(data.access_token);
    setEmail(emailInput);
  }

  async function register(emailInput, password) {
    const { data } = await api.post("/auth/register", { email: emailInput, password });
    localStorage.setItem("oark_token", data.access_token);
    localStorage.setItem("oark_email", emailInput);
    setToken(data.access_token);
    setEmail(emailInput);
  }

  function logout() {
    localStorage.removeItem("oark_token");
    localStorage.removeItem("oark_email");
    setToken(null);
    setEmail(null);
  }

  return (
    <AuthContext.Provider value={{ token, email, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
