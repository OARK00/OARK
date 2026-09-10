import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

  const { logout, email } = useAuth();
  const navigate = useNavigate();

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
    setError(null);
    try {
      const { data } = await api.post("/devices", { name: newDeviceName });
      setCreatedSecret(data);
      setNewDeviceName("");
      await loadDevices();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create device");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this device?")) return;
    await api.delete(`/devices/${id}`);
    await loadDevices();
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const displayName = email ? email.split("@")[0] : "there";

  return (
    <div className="app-shell">
      <Sidebar active="devices" />

      <div className="main-column">
        <header className="topbar topbar-slim">
          <button className="ghost-button" onClick={handleLogout}>
            Log out
          </button>
        </header>

        <div className="content">
          <section className="welcome-banner">
            <span className="eyebrow">{timeOfDayGreeting()}</span>
            <h1>Welcome back, {displayName}</h1>

            <div className="inline-stats">
              <div className="inline-stat">
                <span className="inline-stat-value">{stats.total}</span>
                <span className="inline-stat-label">Total devices</span>
              </div>
              <div className="inline-stat">
                <span className="inline-stat-value stat-online">{stats.online}</span>
                <span className="inline-stat-label">Online</span>
              </div>
              <div className="inline-stat">
                <span className="inline-stat-value stat-offline">{stats.offline}</span>
                <span className="inline-stat-label">Offline</span>
              </div>
              <div className="inline-stat">
                <span className="inline-stat-value stat-stale">{stats.stale}</span>
                <span className="inline-stat-label">Stale</span>
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
                <button type="submit" className="primary-button">
                  Add device
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
