import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import AppShell from "../components/AppShell";
import DeviceControls, { CommandHistory } from "../components/DeviceControls";
import LineChart from "../components/LineChart";
import { CATEGORY_LABELS } from "../constants/devices";

const RANGES = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "24 hours" },
  { hours: 24 * 7, label: "7 days" },
];

const REFRESH_MS = 30000;
// While a command waits for its device, check often: a switch that takes
// thirty seconds to show it worked feels broken.
const PENDING_REFRESH_MS = 2000;

function timeAgo(iso) {
  if (!iso) return "never";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function numericKeys(readings) {
  const keys = new Set();
  readings.forEach((reading) => {
    Object.entries(reading.data || {}).forEach(([key, value]) => {
      if (typeof value === "number") keys.add(key);
    });
  });
  return [...keys].sort();
}

export default function DeviceDetail() {
  const { deviceId } = useParams();
  const [device, setDevice] = useState(null);
  const [dataPoints, setDataPoints] = useState([]);
  const [readings, setReadings] = useState([]);
  const [commands, setCommands] = useState([]);
  const [range, setRange] = useState(24);
  const [selectedKey, setSelectedKey] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [deviceResponse, telemetryResponse] = await Promise.all([
        api.get(`/devices/${deviceId}`),
        api.get(`/devices/${deviceId}/telemetry`, { params: { hours: range, limit: 2000 } }),
      ]);
      setDevice(deviceResponse.data);
      // The API returns newest first; a chart reads oldest to newest.
      setReadings([...telemetryResponse.data].reverse());
      setError(null);

      // Units live on the product, not the device, so the chart can label
      // degrees as degrees instead of a bare number.
      if (deviceResponse.data.product_id) {
        try {
          const product = await api.get(`/products/${deviceResponse.data.product_id}`);
          setDataPoints(product.data.data_points || []);
        } catch {
          setDataPoints([]);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not load this device"));
    } finally {
      setLoading(false);
    }
  }, [deviceId, range]);

  // The device and its commands only, without the heavier telemetry history.
  const loadLive = useCallback(async () => {
    try {
      const [deviceResponse, commandsResponse] = await Promise.all([
        api.get(`/devices/${deviceId}`),
        api.get(`/devices/${deviceId}/commands`),
      ]);
      setDevice(deviceResponse.data);
      setCommands(commandsResponse.data);
    } catch {
      // The next refresh tries again; the full load reports real errors.
    }
  }, [deviceId]);

  useEffect(() => {
    load();
    loadLive();
    const id = setInterval(() => {
      load();
      loadLive();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load, loadLive]);

  const waiting = commands.some((command) => command.status === "pending");
  useEffect(() => {
    if (!waiting) return undefined;
    const id = setInterval(loadLive, PENDING_REFRESH_MS);
    return () => clearInterval(id);
  }, [waiting, loadLive]);

  const controls = useMemo(() => dataPoints.filter((point) => point.access === "write"), [dataPoints]);

  const keys = useMemo(() => numericKeys(readings), [readings]);
  const activeKey = selectedKey && keys.includes(selectedKey) ? selectedKey : keys[0];

  const points = useMemo(
    () =>
      readings
        .filter((reading) => typeof reading.data?.[activeKey] === "number")
        .map((reading) => ({ at: new Date(reading.recorded_at), value: reading.data[activeKey] })),
    [readings, activeKey]
  );

  const unit = useMemo(
    () => dataPoints.find((point) => point.key === activeKey)?.unit || "",
    [dataPoints, activeKey]
  );

  const currentValues = Object.entries(device?.reported_state || {});

  return (
    <AppShell active="devices">
      <div className="page-head">
        <div>
          <div className="crumbs">
            <Link to="/dashboard">Devices</Link> <span>/</span> <span>{device?.name || "…"}</span>
          </div>
          <h2>{device?.name || "Loading…"}</h2>
          {device && (
            <p className="page-head-note">
              <span className={`status-pill status-${device.status}`}>
                <span className="status-dot" />
                {device.status}
              </span>
              <span className="page-head-sep">·</span>
              last seen {timeAgo(device.last_seen_at)}
              {device.product_name && (
                <>
                  <span className="page-head-sep">·</span>
                  <Link to={`/products/${device.product_id}`}>{device.product_name}</Link>
                </>
              )}
              {device.category && (
                <>
                  <span className="page-head-sep">·</span>
                  {CATEGORY_LABELS[device.category] || device.category}
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {device && (
        <div className="detail-grid">
          <div className="detail-main">
            {controls.length > 0 && (
              <DeviceControls device={device} points={controls} commands={commands} onChange={loadLive} />
            )}

            <div className="chart-card">
              <div className="card-head">
                <h3>History</h3>
                <div className="range-tabs">
                  {RANGES.map((option) => (
                    <button
                      key={option.hours}
                      type="button"
                      className={`range-tab${range === option.hours ? " active" : ""}`}
                      onClick={() => setRange(option.hours)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {keys.length > 1 && (
                <div className="key-chips">
                  {keys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`key-chip${key === activeKey ? " active" : ""}`}
                      onClick={() => setSelectedKey(key)}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              )}

              {loading ? (
                <p className="chart-empty">Loading…</p>
              ) : keys.length === 0 ? (
                <p className="chart-empty">
                  No numeric values reported in this period. Text and true/false values appear in the table below.
                </p>
              ) : (
                <LineChart points={points} unit={unit} />
              )}
            </div>

            <div className="activity-card">
              <div className="card-head">
                <h3>Readings</h3>
                <span className="card-head-note">{readings.length} in this period</span>
              </div>
              {readings.length === 0 ? (
                <p className="activity-empty">Nothing received in this period.</p>
              ) : (
                <ul className="activity-list">
                  {[...readings]
                    .reverse()
                    .slice(0, 25)
                    .map((reading) => (
                      <li key={reading.id} className="reading-row">
                        <span className="reading-time">
                          {new Date(reading.recorded_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                        <span className="activity-values">
                          {Object.entries(reading.data || {}).map(([key, value]) => (
                            <span key={key} className="activity-value">
                              {key} <b>{typeof value === "object" ? JSON.stringify(value) : String(value)}</b>
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            {(controls.length > 0 || commands.length > 0) && (
              <CommandHistory commands={commands} points={dataPoints} />
            )}
          </div>

          <aside className="detail-side">
            <div className="side-card">
              <div className="card-head">
                <h3>Latest values</h3>
              </div>
              {currentValues.length === 0 ? (
                <p className="activity-empty">This device has not reported yet.</p>
              ) : (
                <ul className="value-list">
                  {currentValues.map(([key, value]) => (
                    <li key={key}>
                      <span className="value-key">{key}</span>
                      <span className="value-number">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="side-card">
              <div className="card-head">
                <h3>Device</h3>
              </div>
              <dl className="meta-list">
                <dt>ID</dt>
                <dd className="meta-mono">{device.id}</dd>
                {device.model_number && (
                  <>
                    <dt>Model</dt>
                    <dd>{device.model_number}</dd>
                  </>
                )}
                {device.firmware_version && (
                  <>
                    <dt>Firmware</dt>
                    <dd>{device.firmware_version}</dd>
                  </>
                )}
                {device.description && (
                  <>
                    <dt>Notes</dt>
                    <dd>{device.description}</dd>
                  </>
                )}
              </dl>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
