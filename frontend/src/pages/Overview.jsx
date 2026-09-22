import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import AddDeviceWizard from "../components/AddDeviceWizard";
import { CheckIcon } from "../components/icons";

const REFRESH_MS = 30000;

// Platform news, the way Tuya's overview carries announcements: the page
// stays useful on an account that has no data of its own yet.
const WHATS_NEW = [
  { date: "22 Sep", text: "Device history charts over 1 hour, 24 hours or 7 days" },
  { date: "22 Sep", text: "Login protection: repeated wrong passwords are now blocked" },
  { date: "21 Sep", text: "Every device gets its own broker credentials" },
];

function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function trendLabel(current, previous) {
  if (!previous) return current ? "first messages today" : "no messages yet";
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return "same as yesterday";
  return `${change > 0 ? "▲" : "▼"} ${Math.abs(change)}% vs yesterday`;
}

function StatTile({ label, value, note, tone }) {
  return (
    <div className={`stat-tile${tone ? ` ${tone}` : ""}`}>
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value">{value}</span>
      {note && <span className="stat-tile-note">{note}</span>}
    </div>
  );
}

function Hero({ email, onAddDevice }) {
  const name = (email || "").split("@")[0];

  return (
    <div className="hero-card">
      <div className="hero-text">
        <span className="hero-eyebrow">Oark platform</span>
        <h3>Welcome back{name ? `, ${name}` : ""}</h3>
        <p>
          Connect devices over MQTT, watch live telemetry, and manage every unit from one place. Each device
          gets its own credentials, so one leak can never speak for the rest.
        </p>
        <div className="hero-actions">
          <button type="button" className="primary-button" onClick={onAddDevice}>
            Add a device
          </button>
          <Link to="/products" className="ghost-button">
            Define a product
          </Link>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <svg viewBox="0 0 200 120" width="100%" height="120">
          <circle cx="100" cy="60" r="22" className="hero-core" />
          <circle cx="100" cy="60" r="34" className="hero-ring" />
          <circle cx="100" cy="60" r="48" className="hero-ring faint" />
          {[
            [30, 30],
            [170, 32],
            [34, 94],
            [168, 92],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <line x1="100" y1="60" x2={x} y2={y} className="hero-link" />
              <circle cx={x} cy={y} r="7" className="hero-node" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// The numbered strip Tuya uses for its tutorials: steps left to right with
// arrows between them, ticking themselves off as the account progresses.
function QuickStart({ checklist, onAddDevice }) {
  const steps = [
    { key: "product_created", title: "Define a product", text: "What your devices measure" },
    { key: "device_added", title: "Add a device", text: "One physical unit, own credentials" },
    { key: "first_message", title: "See it report", text: "Paste the sketch, power it on" },
  ];
  const done = steps.filter((step) => checklist[step.key]).length;
  if (done === steps.length) return null;

  return (
    <div className="quickstart-card">
      <div className="card-head">
        <h3>Quick start</h3>
        <span className="card-head-note">
          {done} of {steps.length} done
        </span>
      </div>
      <div className="quickstart-strip">
        {steps.map((step, index) => (
          <div key={step.key} className="quickstart-step-wrap">
            <div className={`quickstart-step${checklist[step.key] ? " done" : ""}`}>
              <span className="quickstart-mark">{checklist[step.key] ? CheckIcon : index + 1}</span>
              <span className="quickstart-title">{step.title}</span>
              <span className="quickstart-text">{step.text}</span>
            </div>
            {index < steps.length - 1 && <span className="quickstart-arrow" aria-hidden="true" />}
          </div>
        ))}
      </div>
      <div className="quickstart-actions">
        <button type="button" className="primary-button" onClick={onAddDevice}>
          Get started
        </button>
        <Link to="/products" className="ghost-button">
          Products
        </Link>
      </div>
    </div>
  );
}

function MessagesChart({ series }) {
  const max = Math.max(...series.map((point) => point.count), 0);

  return (
    <div className="chart-card">
      <div className="card-head">
        <h3>Messages received</h3>
        <span className="card-head-note">last 24 hours</span>
      </div>
      <div className="chart-body">
        <div className="chart-axis">
          <span>{max}</span>
          <span>0</span>
        </div>
        <div className="chart-bars">
          {series.map((point) => (
            <div
              key={point.hour}
              className={`chart-bar${point.count ? "" : " empty"}`}
              style={{ height: max ? `${Math.max((point.count / max) * 100, 2)}%` : "2%" }}
              title={`${new Date(point.hour).toLocaleTimeString([], { hour: "2-digit" })} · ${point.count}`}
            />
          ))}
        </div>
      </div>
      <div className="chart-footer">
        <span>24 hours ago</span>
        <span>now</span>
      </div>
      {max === 0 && <p className="chart-empty">No messages yet. They appear here as soon as a device reports.</p>}
    </div>
  );
}

function RecentActivity({ devices }) {
  return (
    <div className="activity-card">
      <div className="card-head">
        <h3>Recent activity</h3>
        <Link to="/dashboard" className="card-head-link">
          All devices
        </Link>
      </div>
      {devices.length === 0 ? (
        <p className="activity-empty">Nothing has reported yet. Your devices appear here as they connect.</p>
      ) : (
        <ul className="activity-list">
          {devices.map((device) => {
            const values = Object.entries(device.reported_state || {}).slice(0, 3);
            return (
              <li key={device.id} className="activity-row">
                <span className={`status-dot ${device.status}`} />
                <Link to={`/devices/${device.id}`} className="activity-name">
                  {device.name}
                </Link>
                <span className="activity-values">
                  {values.length === 0
                    ? "—"
                    : values.map(([key, value]) => (
                        <span key={key} className="activity-value">
                          {key} <b>{typeof value === "object" ? JSON.stringify(value) : String(value)}</b>
                        </span>
                      ))}
                </span>
                <span className="activity-time">{timeAgo(device.last_seen_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const { email } = useAuth();
  const navigate = useNavigate();

  async function load() {
    try {
      const { data } = await api.get("/overview");
      setData(data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load the overview"));
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <AppShell active="overview">
      <div className="page-head">
        <div>
          <h2>Overview</h2>
          <p className="page-head-note">Your fleet at a glance, updated every 30 seconds.</p>
        </div>
        <button className="primary-button" onClick={() => setAdding(true)}>
          + Add device
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {data && (
        <div className="overview-grid">
          <div className="overview-main">
            <Hero email={email} onAddDevice={() => setAdding(true)} />

            <div className="stat-row">
              <StatTile label="Devices" value={data.devices.total} note={`${data.products} products`} />
              <StatTile label="Online" value={data.devices.online} tone="good" note="reported in last 2 min" />
              <StatTile
                label="Not reporting"
                value={data.devices.stale + data.devices.offline}
                tone={data.devices.stale + data.devices.offline ? "warn" : undefined}
                note={`${data.devices.stale} stale · ${data.devices.offline} offline`}
              />
              <StatTile
                label="Messages 24h"
                value={data.messages.last_24h.toLocaleString()}
                note={trendLabel(data.messages.last_24h, data.messages.previous_24h)}
              />
            </div>

            <QuickStart checklist={data.checklist} onAddDevice={() => setAdding(true)} />
            <MessagesChart series={data.messages.series} />
            <RecentActivity devices={data.recent_devices} />
          </div>

          <aside className="overview-side">
            <div className="side-card">
              <div className="card-head">
                <h3>What&rsquo;s new</h3>
              </div>
              <ul className="news-list">
                {WHATS_NEW.map((item) => (
                  <li key={item.text}>
                    <span className="news-date">{item.date}</span>
                    <span className="news-text">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="side-card">
              <div className="card-head">
                <h3>Resources</h3>
              </div>
              <ul className="resource-list">
                <li>
                  <button type="button" className="link-button" onClick={() => setAdding(true)}>
                    Connect a device
                  </button>
                </li>
                <li>
                  <button type="button" className="link-button" onClick={() => navigate("/products")}>
                    Define a product
                  </button>
                </li>
                <li>
                  <a href="mailto:dev@oark.in">Contact support</a>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      )}

      {adding && <AddDeviceWizard onClose={() => setAdding(false)} onCreated={load} />}
    </AppShell>
  );
}
