import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <div className="auth-branding">
        <span className="corner-mark tl" />
        <span className="corner-mark br" />
        <div className="auth-branding-content">
          <div className="auth-logo">
            <Logo size={40} wordmark />
          </div>
          <h2>Industrial IoT, done right.</h2>
          <p>
            Connect devices over MQTT, monitor live telemetry, and manage your
            fleet from one dashboard — built for real deployments, not demos.
          </p>
          <ul className="auth-features">
            <li>Real-time device status &amp; telemetry</li>
            <li>Org-scoped, multi-tenant from day one</li>
            <li>Secure per-device credentials</li>
          </ul>

          <div className="preview-card">
            <div className="preview-card-header">
              <span>Live fleet</span>
              <span>Now</span>
            </div>
            <div className="preview-row">
              <span className="preview-dot on" />
              <span className="preview-row-name">Warehouse Temp Sensor</span>
              <span className="preview-bars">
                <span style={{ height: "6px" }} />
                <span style={{ height: "10px" }} />
                <span style={{ height: "14px" }} />
                <span style={{ height: "8px" }} />
              </span>
            </div>
            <div className="preview-row">
              <span className="preview-dot on" />
              <span className="preview-row-name">Line 3 Vibration</span>
              <span className="preview-bars">
                <span style={{ height: "12px" }} />
                <span style={{ height: "6px" }} />
                <span style={{ height: "9px" }} />
                <span style={{ height: "16px" }} />
              </span>
            </div>
            <div className="preview-row">
              <span className="preview-dot off" />
              <span className="preview-row-name">EV Battery Monitor</span>
              <span className="preview-bars">
                <span style={{ height: "3px" }} />
                <span style={{ height: "3px" }} />
                <span style={{ height: "3px" }} />
                <span style={{ height: "3px" }} />
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>{mode === "login" ? "Welcome back" : "Create your organization"}</h1>
          <p className="subtitle">
            {mode === "login" ? "Sign in to your dashboard" : "Start monitoring your devices"}
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
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>

          {error && <div className="error">{error}</div>}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            className="link-button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
