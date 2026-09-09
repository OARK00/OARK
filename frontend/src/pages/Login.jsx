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
    <div className="auth-page-split">
      <div className="auth-side-dark">
        <div className="auth-side-dark-top">
          <Logo size={26} wordmark />
        </div>

        <div className="iso-stack">
          <div className="iso-card iso-card-1">
            <span className="iso-dot iso-dot-on" />
            <span>Sensor</span>
          </div>
          <div className="iso-card iso-card-2">
            <span className="iso-dot iso-dot-on" />
            <span>Gateway</span>
          </div>
          <div className="iso-card iso-card-3">
            <span className="iso-dot iso-dot-off" />
            <span>Cloud</span>
          </div>
        </div>

        <div className="auth-side-dark-bottom">
          <h2>
            Monitor your <span className="highlight">entire fleet</span> in real time.
          </h2>
          <p>Connect devices over MQTT, track live telemetry, and manage everything from one dashboard.</p>
        </div>
      </div>

      <div className="auth-side-light">
        <form className="auth-card-plain" onSubmit={handleSubmit}>
          <h1>{mode === "login" ? "Log in to Oark" : "Create your organization"}</h1>

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
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>

          <button
            type="button"
            className="link-button centered"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Sign up" : "Already have an account? Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
