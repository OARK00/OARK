import { useState } from "react";
import { Link } from "react-router-dom";
import { categoryIcon } from "./icons";
import { CATEGORY_LABELS } from "../constants/devices";

function timeAgo(iso) {
  if (!iso) return "never reported";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function Counts({ items }) {
  return (
    <div className="console-counts">
      {items.map((item) => (
        <div key={item.label} className="console-count">
          <span className="console-count-label">{item.label}</span>
          <span className={`console-count-value${item.tone ? ` ${item.tone}` : ""}`}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// The console block from Tuya's overview, in Oark's terms: tabs across the
// top, counts for the selected area, then the most recent items as cards,
// so the overview is a way in rather than a dead end.
export default function WorkspaceConsole({ data, onAddDevice }) {
  const [tab, setTab] = useState("devices");

  const tabs = [
    { id: "devices", label: "Devices" },
    { id: "products", label: "Products" },
    { id: "alerts", label: "Alerts" },
  ];

  return (
    <div className="console-card">
      <div className="console-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`console-tab${tab === item.id ? " active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === "alerts" && <span className="soon-badge">Soon</span>}
          </button>
        ))}
      </div>

      {tab === "devices" && (
        <div className="console-body">
          <div className="console-head">
            <Counts
              items={[
                { label: "Total", value: data.devices.total },
                { label: "Online", value: data.devices.online, tone: "good" },
                { label: "Never reported", value: data.never_reported ?? 0, tone: "warn" },
              ]}
            />
            <div className="console-actions">
              <button type="button" className="primary-button" onClick={onAddDevice}>
                Add a device
              </button>
              <Link to="/dashboard" className="ghost-button">
                All devices
              </Link>
            </div>
          </div>

          {data.recent_devices.length === 0 ? (
            // Keeping the card grid, with placeholders, so an empty tab has
            // the same shape as a full one instead of collapsing to a line.
            <div className="console-cards">
              <button type="button" className="console-ghost action" onClick={onAddDevice}>
                <span className="console-ghost-plus">+</span>
                Add your first device
              </button>
              <div className="console-ghost" aria-hidden="true">
                <span className="console-ghost-line" />
                <span className="console-ghost-line short" />
              </div>
              <div className="console-ghost" aria-hidden="true">
                <span className="console-ghost-line" />
                <span className="console-ghost-line short" />
              </div>
            </div>
          ) : (
            <div className="console-cards">
              {data.recent_devices.slice(0, 3).map((device) => (
                <Link key={device.id} to={`/devices/${device.id}`} className="console-item">
                  <span className={`console-item-dot ${device.status}`} />
                  <span className="console-item-name">{device.name}</span>
                  <span className="console-item-note">{timeAgo(device.last_seen_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "products" && (
        <div className="console-body">
          <div className="console-head">
            <Counts
              items={[
                { label: "Products", value: data.products },
                { label: "Devices assigned", value: (data.recent_products || []).reduce((sum, p) => sum + p.device_count, 0) },
              ]}
            />
            <div className="console-actions">
              <Link to="/products?new=1" className="primary-button console-link-button">
                New product
              </Link>
              <Link to="/products" className="ghost-button">
                All products
              </Link>
            </div>
          </div>

          {(data.recent_products || []).length === 0 ? (
            <div className="console-cards">
              <Link to="/products?new=1" className="console-ghost action">
                <span className="console-ghost-plus">+</span>
                Define your first product
              </Link>
              <div className="console-ghost" aria-hidden="true">
                <span className="console-ghost-line" />
                <span className="console-ghost-line short" />
              </div>
              <div className="console-ghost" aria-hidden="true">
                <span className="console-ghost-line" />
                <span className="console-ghost-line short" />
              </div>
            </div>
          ) : (
            <div className="console-cards">
              {data.recent_products.slice(0, 3).map((product) => (
                <Link key={product.id} to={`/products/${product.id}`} className="console-item">
                  <span className="console-item-icon">{categoryIcon(product.category)}</span>
                  <span className="console-item-name">{product.name}</span>
                  <span className="console-item-note">
                    {product.device_count} {product.device_count === 1 ? "device" : "devices"} ·{" "}
                    {product.data_points} data points
                    {product.category ? ` · ${CATEGORY_LABELS[product.category] || product.category}` : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "alerts" && (
        <div className="console-body">
          <p className="activity-empty">
            Alerts will watch your data and tell you when something crosses a limit — a cold store warming up, a
            device that stopped reporting — by email first, then SMS.
          </p>
        </div>
      )}
    </div>
  );
}
