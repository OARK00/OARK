import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";

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
  const [newDeviceName, setNewDeviceName] = useState("");
  const [createdSecret, setCreatedSecret] = useState(null);
  const [addingDevice, setAddingDevice] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { email } = useAuth();

  async function loadDevices() {
    setLoading(true);
    try {
      const { data } = await api.get("/devices");
      setDevices(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load devices");
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

  async function handleAddDevice(e) {
    e.preventDefault();
    if (addingDevice) return;
    setError(null);
    setAddingDevice(true);
    try {
      const { data } = await api.post("/devices", { name: newDeviceName });
      setCreatedSecret(data);
      setNewDeviceName("");
      await loadDevices();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create device");
    } finally {
      setAddingDevice(false);
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
      setError(err.response?.data?.detail || "Could not delete device");
    } finally {
      setDeleting(false);
    }
  }

  const displayName = email ? email.split("@")[0] : "there";
  const greeting = timeOfDayGreeting();

  return (
    <div className="app-shell">
      <Sidebar active="devices" />

      <div className="main-column">
        <div className="content">
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
              <div className="inline-stat inline-stat-neutral">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
                <div>
                  <span className="inline-stat-value">{stats.total}</span>
                  <span className="inline-stat-label">Total devices</span>
                </div>
              </div>
              <div className="inline-stat inline-stat-online">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
                  <circle cx="12" cy="19.5" r="1.2" fill="currentColor" stroke="none" />
                </svg>
                <div>
                  <span className="inline-stat-value">{stats.online}</span>
                  <span className="inline-stat-label">Online</span>
                </div>
              </div>
              <div className="inline-stat inline-stat-offline">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v6" />
                  <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
                </svg>
                <div>
                  <span className="inline-stat-value">{stats.offline}</span>
                  <span className="inline-stat-label">Offline</span>
                </div>
              </div>
              <div className="inline-stat inline-stat-stale">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3.5 2" />
                </svg>
                <div>
                  <span className="inline-stat-value">{stats.stale}</span>
                  <span className="inline-stat-label">Stale</span>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Fleet</h2>
              <form className="add-device" onSubmit={handleAddDevice}>
                <input
                  type="text"
                  placeholder="New device name (e.g. Warehouse Temp Sensor)"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  required
                />
                <button type="submit" className="primary-button" disabled={addingDevice}>
                  {addingDevice ? "Adding..." : "Add device"}
                </button>
              </form>
            </div>

            {createdSecret && (
              <div className="secret-banner">
                <strong>{createdSecret.name}</strong> created. Save this device secret now —
                it will not be shown again:
                <code>{createdSecret.secret}</code>
                <button className="ghost-button" onClick={() => setCreatedSecret(null)}>
                  Dismiss
                </button>
              </div>
            )}

            {error && <div className="error">{error}</div>}

            {loading ? (
              <p className="muted">Loading devices...</p>
            ) : devices.length === 0 ? (
              <p className="muted">No devices yet. Add your first one above.</p>
            ) : (
              <table className="device-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Last seen</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.id}>
                      <td>{d.name}</td>
                      <td>
                        <span className={`status status-${d.status}`}>
                          <span className="status-dot" />
                          {d.status}
                        </span>
                      </td>
                      <td>{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "Never"}</td>
                      <td>
                        <button className="ghost-button" onClick={() => setDeviceToDelete(d)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>

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
    </div>
  );
}
