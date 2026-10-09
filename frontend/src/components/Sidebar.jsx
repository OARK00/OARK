import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
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
  products: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12m0 0 8-4.5M12 12v9" />
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
  // A magic wand: "create with AI" without borrowing any AI vendor's logo
  // (a four-pointed star reads as Gemini's).
  aiProduct: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 20 14 10" />
      <path d="M16 3v3M16 10v1M19.5 6.5 18 8M12.5 6.5 14 8M20 9h-3" />
    </svg>
  ),
  assistant: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.63.5 1.18 1.04 1.44H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  ),
};

// Order agreed with the user (2026-09-30): Products right below Devices, then
// AI Product -- creating a product with AI, Oark's core idea -- as its own entry.
const navGroups = [
  {
    label: "Monitor",
    items: [
      { key: "overview", label: "Overview", icon: icons.overview, to: "/overview" },
      { key: "devices", label: "Devices", icon: icons.devices, to: "/dashboard" },
      { key: "products", label: "Products", icon: icons.products, to: "/products" },
      { key: "ai-product", label: "AI Product", icon: icons.aiProduct, to: "/ai-product" },
      { key: "alerts", label: "Alerts", icon: icons.alerts, to: "/alerts" },
    ],
  },
  {
    label: "Insights",
    items: [
      { key: "analytics", label: "Analytics", icon: icons.analytics, disabled: true },
      { key: "assistant", label: "AI Assistant", icon: icons.assistant, disabled: true },
    ],
  },
  {
    label: "Manage",
    items: [{ key: "settings", label: "Settings", icon: icons.settings, to: "/settings" }],
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
          <Logo height={32} />
        </div>
        {navGroups.map((group) => (
          <div key={group.label} className="sidebar-group">
            <div className="sidebar-group-label">{group.label}</div>
            <nav className="sidebar-nav">
              {group.items.map((item) =>
                item.disabled ? (
                  <div key={item.key} className="sidebar-item disabled" title="Coming soon">
                    {item.icon}
                    <span>{item.label}</span>
                    <span className="soon-badge">Soon</span>
                  </div>
                ) : (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={`sidebar-item sidebar-link ${active === item.key ? "active" : ""}`}
                    aria-current={active === item.key ? "page" : undefined}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )
              )}
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
