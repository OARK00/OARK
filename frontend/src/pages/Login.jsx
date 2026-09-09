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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showForgotNotice, setShowForgotNotice] = useState(false);
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
          <div className="iso-shadow iso-shadow-1" />
          <div className="iso-shadow iso-shadow-2" />
          <div className="iso-shadow iso-shadow-3" />

          <div className="iso-box iso-box-1">
            <div className="iso-face-top" />
            <div className="iso-face-front">
              <svg viewBox="0 0 16 16" width="13" height="13">
                <circle cx="8" cy="8" r="2" fill="#4ade80" />
                <path d="M4 8a4 4 0 0 1 8 0M2 8a6 6 0 0 1 12 0" stroke="#4ade80" strokeWidth="1.2" fill="none" opacity="0.6" />
              </svg>
              <span>Sensor</span>
            </div>
          </div>

          <div className="iso-box iso-box-2">
            <div className="iso-face-top" />
            <div className="iso-face-front">
              <svg viewBox="0 0 16 16" width="13" height="13">
                <rect x="2" y="6" width="12" height="5" rx="1" fill="none" stroke="#4ade80" strokeWidth="1.2" />
                <path d="M5 6V4M8 6V4M11 6V4" stroke="#4ade80" strokeWidth="1.2" />
              </svg>
              <span>Gateway</span>
            </div>
          </div>

          <div className="iso-box iso-box-3">
            <div className="iso-face-top" />
            <div className="iso-face-front">
              <svg viewBox="0 0 16 16" width="13" height="13">
                <path
                  d="M4.5 11a2.5 2.5 0 0 1-.3-4.98A3.5 3.5 0 0 1 11 5.05 2.5 2.5 0 0 1 11.5 11h-7Z"
                  fill="none"
                  stroke="#8b98a3"
                  strokeWidth="1.2"
                />
              </svg>
              <span>Cloud</span>
            </div>
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
            {mode === "login" && (
              <button
                type="button"
                className="link-button small forgot-link"
                onClick={() => setShowForgotNotice(true)}
              >
                Forgot password?
              </button>
            )}
          </label>

          {showForgotNotice && (
            <p className="notice">
              Password reset isn't available yet — contact your organization admin for now.
            </p>
          )}

          {mode === "register" && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                required
              />
              <span>I agree to the Terms of Service and Privacy Policy</span>
            </label>
          )}

          {error && <div className="error">{error}</div>}

          <button
            type="submit"
            className="primary-button"
            disabled={loading || (mode === "register" && !termsAccepted)}
          >
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>

          <button
            type="button"
            className="link-button centered"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setShowForgotNotice(false);
            }}
          >
            {mode === "login" ? "Sign up" : "Already have an account? Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
