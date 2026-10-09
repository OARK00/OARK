import { createContext, useContext } from "react";

// The context object and its hook live here, apart from AuthProvider, so
// AuthContext.jsx exports only a component (keeps React fast-refresh happy).
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}
