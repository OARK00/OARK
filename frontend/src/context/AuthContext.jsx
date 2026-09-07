import { createContext, useContext, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("oark_token"));

  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("oark_token", data.access_token);
    setToken(data.access_token);
  }

  async function register(orgName, email, password) {
    const { data } = await api.post("/auth/register", {
      org_name: orgName,
      email,
      password,
    });
    localStorage.setItem("oark_token", data.access_token);
    setToken(data.access_token);
  }

  function logout() {
    localStorage.removeItem("oark_token");
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
