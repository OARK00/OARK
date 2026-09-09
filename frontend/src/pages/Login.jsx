import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";

// Draws one isometric cube (3 real faces, not a CSS-skewed rectangle) plus a
// horizontal, unrotated label so it stays legible at small sizes.
function IsoCube({ cx, cy, label, dotColor }) {
  const hw = 34; // half-width of the top diamond
  const hh = 17; // half-height of the top diamond
  const depth = 32; // how far the cube extrudes downward

  const T = [cx, cy - hh];
  const R = [cx + hw, cy];
  const B = [cx, cy + hh];
  const L = [cx - hw, cy];

  const pt = (p) => p.join(",");

  return (
    <g>
      <ellipse cx={cx} cy={cy + hh + depth + 6} rx={hw * 0.75} ry="7" fill="#000" opacity="0.35" />

      {/* left face (darkest) */}
      <polygon
        points={`${pt(L)} ${pt(B)} ${B[0]},${B[1] + depth} ${L[0]},${L[1] + depth}`}
        fill="#12181e"
        stroke="#26323c"
        strokeWidth="1"
      />
      {/* right face (medium) */}
      <polygon
        points={`${pt(B)} ${pt(R)} ${R[0]},${R[1] + depth} ${B[0]},${B[1] + depth}`}
        fill="#1c242c"
        stroke="#26323c"
        strokeWidth="1"
      />
      {/* top face (lightest) */}
      <polygon
        points={`${pt(T)} ${pt(R)} ${pt(B)} ${pt(L)}`}
        fill="#33424f"
        stroke="#44566450"
        strokeWidth="1"
      />
      <circle cx={cx} cy={cy} r="4" fill={dotColor} />

      <text
        x={cx + hw + 12}
        y={cy + hh - depth / 2 + 4}
        fill="#dbe3e8"
        fontSize="14"
        fontWeight="600"
        fontFamily="Manrope, sans-serif"
      >
        {label}
      </text>
    </g>
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
          <line x1="70" y1="180" x2="150" y2="125" stroke="#0f766e" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />
          <line x1="150" y1="125" x2="230" y2="70" stroke="#0f766e" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />
          <IsoCube cx={70} cy={180} label="Sensor" dotColor="#4ade80" />
          <IsoCube cx={150} cy={125} label="Gateway" dotColor="#4ade80" />
          <IsoCube cx={230} cy={70} label="Cloud" dotColor="#2dd4bf" />
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
