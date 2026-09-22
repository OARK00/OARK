import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import AppShell from "../components/AppShell";
import AddDeviceWizard from "../components/AddDeviceWizard";
import { CheckIcon } from "../components/icons";

const REFRESH_MS = 30000;

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

function Checklist({ checklist }) {
  const steps = [
    { key: "product_created", label: "Define a product", hint: "What your devices measure", to: "/products" },
    { key: "device_added", label: "Add a device", hint: "One physical unit", to: null },
    { key: "first_message", label: "Receive first message", hint: "Flash it and power on", to: null },
  ];
  const done = steps.filter((step) => checklist[step.key]).length;

  return (
    <div className="side-card">
      <div className="card-head">
        <h3>Getting started</h3>
        <span className="card-head-note">
          {done}/{steps.length}
        </span>
      </div>
      <ol className="checklist">
        {steps.map((step, index) => {
          const complete = checklist[step.key];
          return (
            <li key={step.key} className={`checklist-item${complete ? " done" : ""}`}>
              <span className="checklist-mark">{complete ? CheckIcon : index + 1}</span>
              <span>
                <span className="checklist-label">
                  {step.to && !complete ? <Link to={step.to}>{step.label}</Link> : step.label}
                </span>
                <span className="checklist-hint">{step.hint}</span>
              </span>
            </li>
          );
        })}
      </ol>
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
        <p className="activity-empty">Nothing has reported yet.</p>
      ) : (
        <ul className="activity-list">
          {devices.map((device) => {
            const values = Object.entries(device.reported_state || {}).slice(0, 3);
            return (
              <li key={device.id} className="activity-row">
                <span className={`status-dot ${device.status}`} />
                <span className="activity-name">{device.name}</span>
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

            <MessagesChart series={data.messages.series} />
            <RecentActivity devices={data.recent_devices} />
          </div>

          <aside className="overview-side">
            <Checklist checklist={data.checklist} />
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
