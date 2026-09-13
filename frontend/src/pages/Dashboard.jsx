import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
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

const CATEGORY_OPTIONS = [
  { value: "sensor", label: "Sensor" },
  { value: "controller", label: "Controller" },
  { value: "gateway", label: "Gateway" },
  { value: "other", label: "Other" },
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c.label]));

const CATEGORY_ICONS = {
  sensor: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3a2 2 0 0 0-2 2v9.34a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2Z" />
      <path d="M12 17.5v-6" />
    </svg>
  ),
  controller: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 7h14M5 12h14M5 17h14" />
      <circle cx="9" cy="7" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="10" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  gateway: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 13.5v6M9 6.8a5 5 0 1 0 6 0" />
      <path d="M6.2 4a8.5 8.5 0 0 0 0 11.5M17.8 4a8.5 8.5 0 0 1 0 11.5" />
    </svg>
  ),
  other: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12m0 0 8-4.5M12 12v9" />
    </svg>
  ),
};

function categoryIcon(category) {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
}

const MQTT_HOST = "h1106116.ala.asia-southeast1.emqxsl.com";
const MQTT_PORT = 8883;

const CopyIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="11" height="11" rx="1.5" />
    <path d="M5 15V6a1 1 0 0 1 1-1h9" />
  </svg>
);

const CheckIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12.5 10 17l9-10" />
  </svg>
);

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (permissions, non-HTTPS contexts) --
      // leave the button as-is rather than crash.
    }
  }

  return (
    <div className="copy-field">
      <span className="copy-field-label">{label}</span>
      <div className="copy-field-row">
        <code>{value}</code>
        <button
          type="button"
          className="copy-field-button"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
        >
          {copied ? CheckIcon : CopyIcon}
        </button>
      </div>
    </div>
  );
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
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceCategory, setNewDeviceCategory] = useState("sensor");
  const [newDeviceDescription, setNewDeviceDescription] = useState("");
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

  async function handleAddDevice(e) {
    e.preventDefault();
    if (addingDevice) return;
    setError(null);
    setAddingDevice(true);
    try {
      const { data } = await api.post("/devices", {
        name: newDeviceName,
        category: newDeviceCategory,
        description: newDeviceDescription || null,
      });
      setCreatedSecret(data);
      setNewDeviceName("");
      setNewDeviceCategory("sensor");
      setNewDeviceDescription("");
      setShowAddDevice(false);
      await loadDevices();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create device"));
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
      setError(getErrorMessage(err, "Could not delete device"));
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
        <header className="topbar">
          <div className="topbar-crumbs">
            <span className="topbar-org">{displayName}</span>
            <span className="topbar-sep">/</span>
            <span className="topbar-page">Devices</span>
          </div>
          <div className="topbar-right">
            <span className="eyebrow">
              {greeting.icon}
              {greeting.text}
            </span>
            <LiveClock />
          </div>
        </header>

        <div className="content">
          <section className="stat-strip">
            <div className="inline-stats">
              <div className="inline-stat inline-stat-neutral">
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
              <h2>Fleet</h2>
              <button className="primary-button" onClick={() => setShowAddDevice(true)}>
                + Add device
              </button>
            </div>

            {error && <div className="error">{error}</div>}

            {loading ? (
              <p className="muted">Loading devices...</p>
            ) : devices.length === 0 ? (
              <p className="muted">No devices yet. Add your first one above.</p>
            ) : (
              <div className="device-grid">
                {devices.map((d) => (
                  <div className="device-card" key={d.id}>
                    <div className="device-card-top">
                      <div className="device-card-identity">
                        <span className={`device-icon device-icon-${d.category || "other"}`}>
                          {categoryIcon(d.category)}
                        </span>
                        <div>
                          <div className="device-card-name">{d.name}</div>
                          <div className="device-card-category">
                            {d.category ? CATEGORY_LABELS[d.category] || d.category : "Uncategorized"}
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
                      <span className="muted">
                        {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "Never seen"}
                      </span>
                      <button className="ghost-button" onClick={() => setDeviceToDelete(d)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {showAddDevice && (
        <div className="modal-overlay" onClick={() => !addingDevice && setShowAddDevice(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Add device</h3>
            <p>Register a new device and get its connection secret.</p>
            <form className="add-device-form" onSubmit={handleAddDevice}>
              <label className="field">
                Name
                <input
                  type="text"
                  placeholder="e.g. Warehouse Temp Sensor"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label className="field">
                Category
                <select
                  value={newDeviceCategory}
                  onChange={(e) => setNewDeviceCategory(e.target.value)}
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Description <span className="muted">(optional)</span>
                <textarea
                  placeholder="What is this device, and where is it?"
                  value={newDeviceDescription}
                  onChange={(e) => setNewDeviceDescription(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowAddDevice(false)}
                  disabled={addingDevice}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={addingDevice}>
                  {addingDevice ? "Adding..." : "Add device"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createdSecret && (
        <div className="modal-overlay" onClick={() => setCreatedSecret(null)}>
          <div className="modal-card connection-card" onClick={(e) => e.stopPropagation()}>
            <h3>Connect &ldquo;{createdSecret.name}&rdquo;</h3>
            <p>
              Configure your device with these details. The secret is shown only once —
              save it now.
            </p>

            <div className="connection-fields">
              <CopyField label="Device ID" value={createdSecret.id} />
              <CopyField label="Device secret" value={createdSecret.secret} />
              <CopyField label="MQTT host" value={MQTT_HOST} />
              <CopyField label="MQTT port" value={String(MQTT_PORT)} />
              <CopyField label="Publish topic" value={`oark/devices/${createdSecret.id}/telemetry`} />
            </div>

            <div className="connection-payload">
              <span className="copy-field-label">Payload format</span>
              <pre>{`{
  "secret": "<device secret>",
  "data": { "temperature": 24.5, "humidity": 61 }
}`}</pre>
            </div>

            <div className="modal-actions">
              <button className="primary-button" onClick={() => setCreatedSecret(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
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
    </div>
  );
}
