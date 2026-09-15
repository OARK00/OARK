import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import AddDeviceWizard from "../components/AddDeviceWizard";
import { categoryIcon, CheckIcon, CopyIcon, DotsIcon, TrashIcon } from "../components/icons";
import { CATEGORY_LABELS } from "../constants/devices";

const SunIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
  </svg>
);

const MoonIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </svg>
);

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "online", label: "Online" },
  { value: "stale", label: "Stale" },
  { value: "offline", label: "Offline" },
];

function shortId(id) {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good morning", icon: SunIcon };
  if (hour < 17) return { text: "Good afternoon", icon: SunIcon };
  return { text: "Good evening", icon: MoonIcon };
}

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="live-clock">
      <span className="live-clock-time">{time}</span>
      <span className="live-pill">
        <span className="live-dot" />
        Live
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const { email } = useAuth();

  useEffect(() => {
    if (!openMenuId) return;
    function handlePointerDown(e) {
      if (!e.target.closest(".card-menu")) setOpenMenuId(null);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  async function loadDevices() {
    setLoading(true);
    try {
      const { data } = await api.get("/devices");
      setDevices(data);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load devices"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

  const stats = useMemo(() => {
    const online = devices.filter((d) => d.status === "online").length;
    const offline = devices.filter((d) => d.status === "offline").length;
    const stale = devices.filter((d) => d.status === "stale").length;
    return { total: devices.length, online, offline, stale };
  }, [devices]);

  const visibleDevices =
    statusFilter === "all" ? devices : devices.filter((d) => d.status === statusFilter);

  async function copyDeviceId(id) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId(null);
        setOpenMenuId(null);
      }, 900);
    } catch {
      setOpenMenuId(null);
    }
  }

  async function confirmDelete() {
    if (!deviceToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/devices/${deviceToDelete.id}`);
      await loadDevices();
      setDeviceToDelete(null);
    } catch (err) {
      setError(getErrorMessage(err, "Could not delete device"));
    } finally {
      setDeleting(false);
    }
  }

  const displayName = email ? email.split("@")[0] : "there";
  const greeting = timeOfDayGreeting();

  return (
    <AppShell active="devices">
          <section className="welcome-banner">
            <div className="welcome-banner-top">
              <span className="eyebrow">
                {greeting.icon}
                {greeting.text}
              </span>
              <LiveClock />
            </div>
            <h1>Welcome back, {displayName}</h1>

            <div className="inline-stats">
              <div className="inline-stat">
                <span className="inline-stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </span>
                <div>
                  <span className="inline-stat-value">{stats.total}</span>
                  <span className="inline-stat-label">Total devices</span>
                </div>
              </div>
              <div className="inline-stat inline-stat-online">
                <span className="inline-stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
                    <circle cx="12" cy="19.5" r="1.2" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <div>
                  <span className="inline-stat-value">{stats.online}</span>
                  <span className="inline-stat-label">Online</span>
                </div>
              </div>
              <div className="inline-stat inline-stat-offline">
                <span className="inline-stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v6" />
                    <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <div>
                  <span className="inline-stat-value">{stats.offline}</span>
                  <span className="inline-stat-label">Offline</span>
                </div>
              </div>
              <div className="inline-stat inline-stat-stale">
                <span className="inline-stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3.5 2" />
                  </svg>
                </span>
                <div>
                  <span className="inline-stat-value">{stats.stale}</span>
                  <span className="inline-stat-label">Stale</span>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <h2>Fleet</h2>
                {devices.length > 0 && (
                  <div className="status-filter" role="group" aria-label="Filter devices by status">
                    {STATUS_FILTERS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        className={`status-filter-button ${statusFilter === f.value ? "active" : ""}`}
                        aria-pressed={statusFilter === f.value}
                        onClick={() => setStatusFilter(f.value)}
                      >
                        {f.label}
                        <span className="status-filter-count">
                          {f.value === "all" ? stats.total : stats[f.value]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="primary-button" onClick={() => setShowAddDevice(true)}>
                + Add device
              </button>
            </div>

            {error && <div className="error">{error}</div>}

            {loading ? (
              <p className="muted">Loading devices...</p>
            ) : devices.length === 0 ? (
              <p className="muted">No devices yet. Add your first one above.</p>
            ) : visibleDevices.length === 0 ? (
              <p className="muted">No {statusFilter} devices right now.</p>
            ) : (
              <div className="device-grid">
                {visibleDevices.map((d) => (
                  <div className="device-card" key={d.id}>
                    <div className="device-card-top">
                      <div className="device-card-identity">
                        <span className={`device-icon device-icon-${d.category || "other"}`}>
                          {categoryIcon(d.category)}
                        </span>
                        <div>
                          <div className="device-card-name">{d.name}</div>
                          <div className="device-card-category">
                            {d.product_name ||
                              (d.category ? CATEGORY_LABELS[d.category] || d.category : "Uncategorized")}
                          </div>
                          <div className="device-card-id" title={d.id}>
                            {shortId(d.id)}
                          </div>
                        </div>
                      </div>
                      <span className={`status status-${d.status}`}>
                        <span className="status-dot" />
                        {d.status}
                      </span>
                    </div>

                    {d.description && <p className="device-card-description">{d.description}</p>}

                    <div className="device-card-footer">
                      {d.last_seen_at ? (
                        <span className="muted" title={new Date(d.last_seen_at).toLocaleString()}>
                          Last seen {timeAgo(d.last_seen_at)}
                        </span>
                      ) : (
                        <span className="muted">Never seen</span>
                      )}
                      <div className="card-menu">
                        <button
                          type="button"
                          className="card-menu-trigger"
                          aria-label={`Actions for ${d.name}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === d.id}
                          onClick={() => setOpenMenuId(openMenuId === d.id ? null : d.id)}
                        >
                          {DotsIcon}
                        </button>
                        {openMenuId === d.id && (
                          <div className="card-menu-list" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              className="card-menu-item"
                              onClick={() => copyDeviceId(d.id)}
                            >
                              {copiedId === d.id ? CheckIcon : CopyIcon}
                              {copiedId === d.id ? "Copied" : "Copy device ID"}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="card-menu-item card-menu-item-danger"
                              onClick={() => {
                                setOpenMenuId(null);
                                setDeviceToDelete(d);
                              }}
                            >
                              {TrashIcon}
                              Delete device
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

      {showAddDevice && (
        <AddDeviceWizard
          onCreated={loadDevices}
          onClose={() => {
            setShowAddDevice(false);
            loadDevices();
          }}
        />
      )}

      {deviceToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeviceToDelete(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Delete device?</h3>
            <p>
              <strong>{deviceToDelete.name}</strong> will be permanently removed and its device
              secret revoked. This can't be undone.
            </p>
            <div className="modal-actions">
              <button
                className="ghost-button"
                onClick={() => setDeviceToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button className="danger-button" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete device"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
