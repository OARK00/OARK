import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import AddDeviceWizard from "../components/AddDeviceWizard";
import AppShell from "../components/AppShell";
import DataPointEditor, { toPayload, toRows, validateRows } from "../components/DataPointEditor";
import { categoryIcon } from "../components/icons";
import { CATEGORY_LABELS } from "../constants/devices";
import { ACCESS_LABELS, TYPE_LABELS } from "../constants/products";

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function limitsText(point) {
  if (point.type !== "number") return "—";
  const unit = point.unit ? ` ${point.unit}` : "";
  if (point.min !== null && point.max !== null) return `${point.min}–${point.max}${unit}`;
  if (point.min !== null) return `≥ ${point.min}${unit}`;
  if (point.max !== null) return `≤ ${point.max}${unit}`;
  return "None";
}

// Compares one reported value with its definition. Read-time, like device
// status: nothing is stored, so changing a limit re-checks every device.
function checkValue(point, value) {
  const expected = { number: "number", boolean: "boolean", string: "string" }[point.type];
  if (typeof value !== expected) return { state: "type", note: `expected ${TYPE_LABELS[point.type].toLowerCase()}` };
  if (point.type === "number") {
    if (point.max !== null && value > point.max) return { state: "high", note: `above ${point.max}` };
    if (point.min !== null && value < point.min) return { state: "low", note: `below ${point.min}` };
  }
  return { state: "ok" };
}

function displayValue(point, value) {
  if (point?.type === "boolean" && typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") return `${formatNumber(value)}${point?.unit ? ` ${point.unit}` : ""}`;
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function DeviceReadings({ device, points }) {
  const state = device.reported_state || {};
  const defined = points.filter((p) => p.key in state);
  const undefinedKeys = Object.keys(state).filter((key) => !points.some((p) => p.key === key));

  if (!device.last_seen_at) return <span className="muted">No data yet</span>;

  return (
    <div className="reading-chips">
      {defined.map((point) => {
        const check = checkValue(point, state[point.key]);
        return (
          <span key={point.key} className={`reading-chip reading-${check.state}`} title={check.note}>
            {point.label} <b>{displayValue(point, state[point.key])}</b>
            {check.note && <em>{check.note}</em>}
          </span>
        );
      })}
      {undefinedKeys.map((key) => (
        <span key={key} className="reading-chip reading-undefined" title="Sent by the device but not in this product">
          {key} <b>{displayValue(null, state[key])}</b>
          <em>not defined</em>
        </span>
      ))}
    </div>
  );
}

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState([]);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorError, setEditorError] = useState(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [productRes, devicesRes] = await Promise.all([
        api.get(`/products/${productId}`),
        api.get("/devices", { params: { product_id: productId } }),
      ]);
      setProduct(productRes.data);
      setDevices(devicesRes.data);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Could not load this product"));
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openEditor() {
    setRows([]);
    setEditing(true);
    setEditorBusy(true);
    setEditorError(null);
    try {
      const { data } = await api.get(`/products/${productId}/suggested-data-points`);
      setRows(toRows(data.data_points));
    } catch (err) {
      setRows(toRows(product.data_points));
      setEditorError(getErrorMessage(err, "Could not read recent device data"));
    } finally {
      setEditorBusy(false);
    }
  }

  async function saveDataPoints(e) {
    e.preventDefault();
    const problem = validateRows(rows);
    if (problem) {
      setEditorError(problem);
      return;
    }
    setEditorBusy(true);
    setEditorError(null);
    try {
      const { data } = await api.put(`/products/${productId}/data-points`, { data_points: toPayload(rows) });
      setProduct(data);
      setEditing(false);
    } catch (err) {
      setEditorError(getErrorMessage(err, "Could not save data points"));
    } finally {
      setEditorBusy(false);
    }
  }

  async function deleteProduct() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/products/${productId}`);
      navigate("/products");
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Could not delete product"));
      setDeleting(false);
    }
  }

  if (loadError) {
    return (
      <AppShell active="products">
        <section className="panel">
          <div className="error">{loadError}</div>
          <Link to="/products" className="link-button">
            ← Back to products
          </Link>
        </section>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell active="products">
        <p className="muted">Loading product...</p>
      </AppShell>
    );
  }

  const online = devices.filter((d) => d.status === "online").length;
  const points = product.data_points;

  return (
    <AppShell active="products">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/products">Products</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <section className="panel product-header">
        <div className="product-header-main">
          <span className={`device-icon device-icon-lg device-icon-${product.category || "other"}`}>
            {categoryIcon(product.category)}
          </span>
          <div>
            <h1>{product.name}</h1>
            <div className="product-card-meta">
              {CATEGORY_LABELS[product.category] || "Uncategorized"}
              {product.model_number && <code>{product.model_number}</code>}
            </div>
            {product.description && <p className="product-header-description">{product.description}</p>}
          </div>
        </div>
        <div className="product-header-actions">
          <button type="button" className="ghost-button" onClick={() => setConfirmDelete(true)}>
            Delete product
          </button>
          <button type="button" className="primary-button" onClick={() => setShowAddDevice(true)}>
            + Add device
          </button>
        </div>
      </section>

      <div className="inline-stats">
        <div className="inline-stat">
          <div>
            <span className="inline-stat-value">{devices.length}</span>
            <span className="inline-stat-label">Devices</span>
          </div>
        </div>
        <div className="inline-stat inline-stat-online">
          <div>
            <span className="inline-stat-value">{online}</span>
            <span className="inline-stat-label">Online now</span>
          </div>
        </div>
        <div className="inline-stat">
          <div>
            <span className="inline-stat-value">{points.length}</span>
            <span className="inline-stat-label">Data points</span>
          </div>
        </div>
        <div className="inline-stat">
          <div>
            <span className="inline-stat-value">{points.filter((p) => p.access === "write").length}</span>
            <span className="inline-stat-label">Controllable</span>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Data points</h2>
            <p className="panel-subtitle">What every {product.name} sends. New readings are checked against these.</p>
          </div>
          <button type="button" className="ghost-button" onClick={openEditor}>
            {points.length ? "Edit data points" : "Define data points"}
          </button>
        </div>

        {points.length === 0 ? (
          <p className="muted">
            None yet. Connect a device, then choose <b>Define data points</b>: Oark suggests them from what it sends.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="dp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Type</th>
                  <th>Limits</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.key}>
                    <td className="dp-table-name">{p.label}</td>
                    <td>
                      <code>{p.key}</code>
                    </td>
                    <td>
                      {TYPE_LABELS[p.type]}
                      {p.unit && <span className="muted"> · {p.unit}</span>}
                    </td>
                    <td>{limitsText(p)}</td>
                    <td>
                      <span className={`access-pill access-${p.access}`}>{ACCESS_LABELS[p.access]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Devices</h2>
            <p className="panel-subtitle">Latest reading from each unit, checked against the data points above.</p>
          </div>
        </div>

        {devices.length === 0 ? (
          <p className="muted">No devices use this product yet.</p>
        ) : (
          <ul className="product-devices">
            {devices.map((d) => (
              <li key={d.id} className="product-device">
                <div className="product-device-head">
                  <div className="product-device-name">{d.name}</div>
                  <span className={`status status-${d.status}`}>
                    <span className="status-dot" />
                    {d.status}
                  </span>
                </div>
                <DeviceReadings device={d} points={points} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <div className="modal-overlay">
          <form
            className="modal-card wizard-card wizard-card-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dp-edit-title"
            onSubmit={saveDataPoints}
          >
            <h3 id="dp-edit-title">Data points</h3>
            <p>Suggestions come from what this product's devices recently sent. Untick one to remove it.</p>
            {editorBusy && rows.length === 0 ? (
              <p className="muted">Reading recent device data…</p>
            ) : (
              <DataPointEditor rows={rows} onChange={setRows} />
            )}
            {editorError && <div className="error">{editorError}</div>}
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setEditing(false)} disabled={editorBusy}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={editorBusy}>
                Save data points
              </button>
            </div>
          </form>
        </div>
      )}

      {showAddDevice && (
        <AddDeviceWizard
          initialProductId={product.id}
          onCreated={load}
          onClose={() => {
            setShowAddDevice(false);
            load();
          }}
        />
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Delete product?</h3>
            <p>
              <strong>{product.name}</strong> and its data point definitions will be removed.
              {devices.length > 0 && " Its devices have to be deleted first."}
            </p>
            {deleteError && <div className="error">{deleteError}</div>}
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </button>
              <button className="danger-button" onClick={deleteProduct} disabled={deleting || devices.length > 0}>
                {deleting ? "Deleting..." : "Delete product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
