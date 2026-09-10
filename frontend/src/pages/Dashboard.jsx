import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [createdSecret, setCreatedSecret] = useState(null);
  const [addingDevice, setAddingDevice] = useState(false);

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

  async function handleDelete(id) {
    if (!confirm("Delete this device?")) return;
    await api.delete(`/devices/${id}`);
    await loadDevices();
  }

  const displayName = email ? email.split("@")[0] : "there";

  return (
    <div className="app-shell">
      <Sidebar active="devices" />

      <div className="main-column">
        <div className="content">
          <section className="welcome-banner">
            <span className="eyebrow">{timeOfDayGreeting()}</span>
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
                        <button className="ghost-button" onClick={() => handleDelete(d.id)}>
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
    </div>
  );
}
