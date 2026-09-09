import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";

// A pulsing status dot, reused for each device inside the building and for
// the cloud itself.
function PulseDot({ cx, cy, color, delay = 0 }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="6" fill={color} opacity="0.35" className="iso-pulse" style={{ animationDelay: `${delay}s` }} />
      <circle cx={cx} cy={cy} r="3.2" fill={color} />
    </g>
  );
}

// One scene: a building with several connected devices inside it, each
// broadcasting wirelessly up to the cloud -- the three most basic IoT ideas
// (a device, a network of them, a real environment) shown together.
function IotScene() {
  return (
    <>
      {/* building silhouette */}
      <path
        d="M40 190 V120 L95 85 L150 120 V190 Z"
        fill="#12181e"
        stroke="#2c3844"
        strokeWidth="1.5"
      />
      <rect x="82" y="160" width="26" height="30" fill="#0d1218" stroke="#2c3844" strokeWidth="1.5" />
      <rect x="52" y="140" width="16" height="16" fill="#0d1218" stroke="#2c3844" strokeWidth="1.5" />
      <rect x="120" y="140" width="16" height="16" fill="#0d1218" stroke="#2c3844" strokeWidth="1.5" />

      {/* devices inside the building */}
      <PulseDot cx={60} cy={148} color="#4ade80" delay={0} />
      <PulseDot cx={95} cy={130} color="#4ade80" delay={0.3} />
      <PulseDot cx={128} cy={148} color="#4ade80" delay={0.6} />

      {/* wifi arcs broadcasting from the roof */}
      <path d="M85 82 a14 14 0 0 1 20 0" stroke="#2dd4bf" strokeWidth="2" fill="none" opacity="0.7" />
      <path d="M78 72 a25 25 0 0 1 34 0" stroke="#2dd4bf" strokeWidth="2" fill="none" opacity="0.45" />

      {/* signal flowing up to the cloud */}
      <line
        className="iso-flow-line"
        x1="95"
        y1="80"
        x2="225"
        y2="65"
        stroke="#2dd4bf"
        strokeWidth="2"
        strokeDasharray="6 6"
        opacity="0.7"
      />

      {/* cloud (platform) */}
      <circle cx="207" cy="70" r="15" fill="#1c242c" stroke="#2c3844" strokeWidth="1.5" />
      <circle cx="227" cy="60" r="19" fill="#1c242c" stroke="#2c3844" strokeWidth="1.5" />
      <circle cx="247" cy="70" r="14" fill="#1c242c" stroke="#2c3844" strokeWidth="1.5" />
      <rect x="197" y="68" width="60" height="20" rx="10" fill="#1c242c" stroke="#2c3844" strokeWidth="1.5" />
      <PulseDot cx={227} cy={78} color="#2dd4bf" delay={0.9} />

      <text x="40" y="210" fill="#dbe3e8" fontSize="14" fontWeight="600" fontFamily="Manrope, sans-serif">
        Connected facility
      </text>
      <text x="197" y="105" fill="#dbe3e8" fontSize="14" fontWeight="600" fontFamily="Manrope, sans-serif">
        Oark platform
      </text>
    </>
  );
}

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

        <svg className="iso-stack" viewBox="0 0 320 230">
          <IotScene />
        </svg>

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
