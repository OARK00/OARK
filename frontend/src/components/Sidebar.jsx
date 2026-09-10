import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";

const icons = {
  overview: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  devices: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="10" rx="1.5" />
      <path d="M8 20h8M12 14v6" />
    </svg>
  ),
  analytics: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  ),
  alerts: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3a6 6 0 0 0-6 6c0 5-2 6-2 6h16s-2-1-2-6a6 6 0 0 0-6-6Z" />
      <path d="M10.5 21a1.5 1.5 0 0 0 3 0" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.63.5 1.18 1.04 1.44H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  ),
};

const navGroups = [
  {
    label: "Monitor",
    items: [
      { key: "overview", label: "Overview", icon: icons.overview, disabled: true },
      { key: "devices", label: "Devices", icon: icons.devices, disabled: false },
      { key: "analytics", label: "Analytics", icon: icons.analytics, disabled: true },
      { key: "alerts", label: "Alerts", icon: icons.alerts, disabled: true },
    ],
  },
  {
    label: "Manage",
    items: [{ key: "settings", label: "Settings", icon: icons.settings, disabled: true }],
  },
];

export default function Sidebar({ active = "devices" }) {
  const { email, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-main">
        <div className="sidebar-brand">
          <Logo size={28} wordmark />
        </div>
        {navGroups.map((group) => (
          <div key={group.label} className="sidebar-group">
            <div className="sidebar-group-label">{group.label}</div>
            <nav className="sidebar-nav">
              {group.items.map((item) => (
                <div
                  key={item.key}
                  className={`sidebar-item ${active === item.key ? "active" : ""} ${item.disabled ? "disabled" : ""}`}
                  title={item.disabled ? "Coming soon" : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.disabled && <span className="soon-badge">Soon</span>}
                </div>
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="sidebar-account">
        <div className="sidebar-group-label">Account</div>
        <div className="account-indicator">
          <span className="account-avatar">{(email || "?").charAt(0).toUpperCase()}</span>
          <span className="account-email">{email || "..."}</span>
        </div>
        <button className="sidebar-signout" onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
