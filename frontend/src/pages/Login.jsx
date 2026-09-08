import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(orgName, email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-form-side">
        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-logo">
            <Logo size={28} wordmark />
          </div>

          <h1>{mode === "login" ? "Welcome back" : "Create your organization"}</h1>
          <p className="subtitle">
            {mode === "login" ? "Sign in to pick up where you left off." : "Start monitoring your devices."}
          </p>

          {mode === "register" && (
            <label className="field">
              <span>Organization name</span>
              <input
                type="text"
                placeholder="Acme Manufacturing"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error && <div className="error">{error}</div>}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            className="link-button centered"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>

      <div className="auth-branding">
        <div className="auth-branding-content">
          <span className="eyebrow">Industrial IoT platform</span>
          <p>
            Connect devices over MQTT, monitor live telemetry, and manage your
            fleet from one dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
