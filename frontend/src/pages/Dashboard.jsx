import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import AddDeviceWizard from "../components/AddDeviceWizard";
import ConnectPanel from "../components/DeviceConnect";
import { categoryIcon, CheckIcon, CopyIcon, KeyIcon, TrashIcon } from "../components/icons";
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
  const [deleteError, setDeleteError] = useState(null);
  const [deviceToReset, setDeviceToReset] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [newCredentials, setNewCredentials] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("added");
  const [copiedId, setCopiedId] = useState(null);

  const { email } = useAuth();

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

  const visibleDevices = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = statusFilter === "all" ? devices : devices.filter((d) => d.status === statusFilter);

    if (term) {
      list = list.filter((d) =>
        [d.name, d.id, d.product_name, d.description].some((field) =>
          (field || "").toLowerCase().includes(term)
        )
      );
    }

    const sorted = [...list];
    if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "last_seen") {
      // Devices that never reported sort last rather than as "very old".
      sorted.sort(
        (a, b) => new Date(b.last_seen_at || 0).getTime() - new Date(a.last_seen_at || 0).getTime()
      );
    }
    return sorted;
  }, [devices, statusFilter, search, sort]);

  async function copyDeviceId(id) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 900);
    } catch {
      // Clipboard access can be denied; leave the button unchanged.
    }
  }

  async function confirmDelete() {
    if (!deviceToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/devices/${deviceToDelete.id}`);
      await loadDevices();
      setDeviceToDelete(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Could not delete device"));
    } finally {
      setDeleting(false);
    }
  }

  async function confirmReset() {
    if (!deviceToReset) return;
    setResetting(true);
    setResetError(null);
    try {
      const { data } = await api.post(`/devices/${deviceToReset.id}/credentials`);
      setDeviceToReset(null);
      setNewCredentials(data);
    } catch (err) {
      setResetError(getErrorMessage(err, "Could not reset credentials"));
    } finally {
      setResetting(false);
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
                <span className="panel-count">
                  {visibleDevices.length === devices.length
                    ? `${devices.length} ${devices.length === 1 ? "device" : "devices"}`
                    : `${visibleDevices.length} of ${devices.length}`}
                </span>
              </div>
              <button className="primary-button" onClick={() => setShowAddDevice(true)}>
                + Add device
              </button>
            </div>

            {devices.length > 0 && (
              <div className="table-toolbar">
                <div className="search-field">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search name, ID or product"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search devices"
                  />
                </div>

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

                <label className="sort-field">
                  <span>Sort</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort devices">
                    <option value="added">Recently added</option>
                    <option value="last_seen">Last seen</option>
                    <option value="name">Name</option>
                  </select>
                </label>
              </div>
            )}

            {error && <div className="error">{error}</div>}

            {loading ? (
              <p className="muted">Loading devices...</p>
            ) : devices.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-art" aria-hidden="true">
                  {categoryIcon("sensor")}
                </div>
                <h3>No devices yet</h3>
                <p>
                  A device is one physical unit reporting to Oark. Adding one gives you credentials and a
                  ready-to-paste sketch.
                </p>
                <button className="primary-button" onClick={() => setShowAddDevice(true)}>
                  + Add your first device
                </button>
              </div>
            ) : visibleDevices.length === 0 ? (
              <p className="muted">
                {search ? `Nothing matches “${search}”.` : `No ${statusFilter} devices right now.`}
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Product</th>
                      <th>Status</th>
                      <th>Last seen</th>
                      <th>Latest values</th>
                      <th className="cell-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDevices.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <div className="cell-device">
                            <span className={`device-icon device-icon-${d.category || "other"}`}>
                              {categoryIcon(d.category)}
                            </span>
                            <div className="cell-device-text">
                              <Link to={`/devices/${d.id}`} className="cell-device-name">
                                {d.name}
                              </Link>
                              <span className="cell-device-id" title={d.id}>
                                {shortId(d.id)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {d.product_name || (
                            <span className="muted">
                              {d.category ? CATEGORY_LABELS[d.category] || d.category : "—"}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`status status-${d.status}`}>
                            <span className="status-dot" />
                            {d.status}
                          </span>
                        </td>
                        <td className="cell-muted" title={d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : ""}>
                          {d.last_seen_at ? timeAgo(d.last_seen_at) : "never"}
                        </td>
                        <td>
                          <div className="cell-values">
                            {Object.entries(d.reported_state || {})
                              .slice(0, 3)
                              .map(([key, value]) => (
                                <span key={key} className="activity-value">
                                  {key}{" "}
                                  <b>{typeof value === "object" ? JSON.stringify(value) : String(value)}</b>
                                </span>
                              ))}
                            {Object.keys(d.reported_state || {}).length === 0 && (
                              <span className="muted">—</span>
                            )}
                          </div>
                        </td>
                        {/* Inline buttons rather than a dropdown: a menu
                            positioned inside a table that scrolls sideways
                            gets clipped by that scroll container. */}
                        <td className="cell-actions">
                          <div className="row-actions">
                            <button
                              type="button"
                              className="row-action"
                              title="Copy device ID"
                              aria-label={`Copy ID of ${d.name}`}
                              onClick={() => copyDeviceId(d.id)}
                            >
                              {copiedId === d.id ? CheckIcon : CopyIcon}
                            </button>
                            <button
                              type="button"
                              className="row-action"
                              title="Reset credentials"
                              aria-label={`Reset credentials for ${d.name}`}
                              onClick={() => {
                                setResetError(null);
                                setDeviceToReset(d);
                              }}
                            >
                              {KeyIcon}
                            </button>
                            <button
                              type="button"
                              className="row-action danger"
                              title="Delete device"
                              aria-label={`Delete ${d.name}`}
                              onClick={() => {
                                setDeleteError(null);
                                setDeviceToDelete(d);
                              }}
                            >
                              {TrashIcon}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            {deleteError && <div className="error modal-error">{deleteError}</div>}
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

      {deviceToReset && (
        <div className="modal-overlay" onClick={() => !resetting && setDeviceToReset(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Reset credentials?</h3>
            <p>
              <strong>{deviceToReset.name}</strong> gets a new password. The current one stops working
              immediately, so the board disconnects until you update it.
            </p>
            {resetError && <div className="error modal-error">{resetError}</div>}
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setDeviceToReset(null)} disabled={resetting}>
                Cancel
              </button>
              <button className="danger-button" onClick={confirmReset} disabled={resetting}>
                {resetting ? "Resetting..." : "Reset credentials"}
              </button>
            </div>
          </div>
        </div>
      )}

      {newCredentials && (
        <div className="modal-overlay">
          <div className="modal-card wizard-card" role="dialog" aria-modal="true" aria-labelledby="new-creds-title">
            <h3 id="new-creds-title">New credentials for &ldquo;{newCredentials.name}&rdquo;</h3>
            <p>Put these on the board. The password is shown only once — save it now.</p>
            <ConnectPanel created={newCredentials} />
            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={() => setNewCredentials(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
