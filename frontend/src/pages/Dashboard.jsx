import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [createdSecret, setCreatedSecret] = useState(null);

  const { logout } = useAuth();
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

  return (
    <div className="dashboard">
      <header>
        <h1>Oark</h1>
        <button onClick={handleLogout}>Log out</button>
      </header>

      <section className="add-device">
        <form onSubmit={handleAddDevice}>
          <input
            type="text"
            placeholder="New device name (e.g. Warehouse Temp Sensor)"
            value={newDeviceName}
            onChange={(e) => setNewDeviceName(e.target.value)}
            required
          />
          <button type="submit">Add device</button>
        </form>

        {createdSecret && (
          <div className="secret-banner">
            <strong>{createdSecret.name}</strong> created. Save this device secret now —
            it will not be shown again:
            <code>{createdSecret.secret}</code>
            <button onClick={() => setCreatedSecret(null)}>Dismiss</button>
          </div>
        )}
      </section>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <p>Loading devices...</p>
      ) : devices.length === 0 ? (
        <p>No devices yet. Add your first one above.</p>
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
                  <span className={`status status-${d.status}`}>{d.status}</span>
                </td>
                <td>{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "Never"}</td>
                <td>
                  <button onClick={() => handleDelete(d.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
