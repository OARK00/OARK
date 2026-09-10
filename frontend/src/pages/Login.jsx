import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";

// One node in the hub diagram: a colored circle with a small icon, a
// connecting line back to the hub, and a label.
function HubNode({ hub, x, y, color, icon, label, delay }) {
  return (
    <>
      <line
        className="iso-flow-line"
        x1={hub.x}
        y1={hub.y}
        x2={x}
        y2={y}
        stroke={color}
        strokeWidth="2"
        strokeDasharray="5 6"
        opacity="0.55"
      />
      <circle cx={x} cy={y} r="22" fill="#12181e" stroke={color} strokeWidth="1.5" />
      <circle cx={x} cy={y} r="22" fill={color} opacity="0.12" className="iso-pulse" style={{ animationDelay: `${delay}s` }} />
      <g transform={`translate(${x}, ${y})`} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </g>
      <text
        x={x}
        y={y + 36}
        fill="#9aa4ad"
        fontSize="11.5"
        fontWeight="600"
        textAnchor="middle"
        fontFamily="Manrope, sans-serif"
      >
        {label}
      </text>
    </>
  );
}

// The core IoT concept as a hub diagram: one platform at the center,
// several real-world categories connected to it -- the same idea as the
// classic "IoT applications" chart, scaled down and tinted to Oark's brand.
function IotScene() {
  const hub = { x: 165, y: 122 };

  const nodes = [
    {
      x: 165,
      y: 38,
      color: "#2dd4bf",
      label: "Sensors",
      delay: 0,
      icon: (
        <>
          <circle cx="0" cy="2" r="3" fill="#2dd4bf" stroke="none" />
          <path d="M-7 -1a7 7 0 0 1 14 0" />
        </>
      ),
    },
    {
      x: 246,
      y: 96,
      color: "#f59e0b",
      label: "Energy",
      delay: 0.3,
      icon: <path d="M1 -8 L-6 3 L-1 3 L-2 8 L6 -3 L1 -3 Z" fill="#f59e0b" stroke="none" />,
    },
    {
      x: 214,
      y: 190,
      color: "#38bdf8",
      label: "Fleet",
      delay: 0.6,
      icon: (
        <>
          <path d="M-8 3 L-6 -3 L6 -3 L8 3 Z" />
          <path d="M-8 3 H8" />
          <circle cx="-4" cy="4.5" r="1.8" fill="#38bdf8" stroke="none" />
          <circle cx="4" cy="4.5" r="1.8" fill="#38bdf8" stroke="none" />
        </>
      ),
    },
    {
      x: 116,
      y: 190,
      color: "#4ade80",
      label: "Farming",
      delay: 0.9,
      icon: <path d="M0 8 C0 8 -7 3 -7 -3 C-7 -7 -3 -8 0 -4 C3 -8 7 -7 7 -3 C7 3 0 8 0 8 Z" fill="#4ade80" stroke="none" />,
    },
    {
      x: 84,
      y: 96,
      color: "#fb923c",
      label: "Factory",
      delay: 1.2,
      icon: (
        <>
          <path d="M-8 6 V-2 L-3 1 V-2 L3 1 V-4 L8 -1 V6 Z" />
          <path d="M6 -1 V-6 H8 V-1" fill="none" />
        </>
      ),
    },
  ];

  return (
    <>
      {nodes.map((n) => (
        <HubNode key={n.label} hub={hub} {...n} />
      ))}

      {/* central hub */}
      <circle cx={hub.x} cy={hub.y} r="34" fill="#0d1218" stroke="#2dd4bf" strokeWidth="1.5" />
      <circle cx={hub.x} cy={hub.y} r="34" fill="#2dd4bf" opacity="0.08" className="iso-pulse" />
      <text
        x={hub.x}
        y={hub.y + 5}
        fill="#eafffb"
        fontSize="15"
        fontWeight="800"
        textAnchor="middle"
        letterSpacing="0.04em"
        fontFamily="Manrope, sans-serif"
      >
        IoT
      </text>
    </>
  );
}

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "register"
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
        await register(email, password);
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

        <svg className="iso-stack" viewBox="0 0 330 245">
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
          <h1>{mode === "login" ? "Log in to Oark" : "Create your account"}</h1>

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
