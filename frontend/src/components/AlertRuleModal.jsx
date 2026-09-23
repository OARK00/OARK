import { useEffect, useState } from "react";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";

const CONDITIONS = [
  { value: "above", label: "Goes above", hint: "Fires when the value is higher than the limit" },
  { value: "below", label: "Goes below", hint: "Fires when the value is lower than the limit" },
  { value: "no_data", label: "Stops reporting", hint: "Fires when nothing arrives for a while" },
];

export default function AlertRuleModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    condition: "above",
    scope: "all",
    scopeId: "",
    data_key: "",
    threshold: "",
    for_minutes: 30,
    cooldown_minutes: 15,
  });
  const [devices, setDevices] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/devices").then(({ data }) => setDevices(data)).catch(() => setDevices([]));
    api.get("/products").then(({ data }) => setProducts(data)).catch(() => setProducts([]));
  }, []);

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      condition: form.condition,
      cooldown_minutes: Number(form.cooldown_minutes),
      device_id: form.scope === "device" ? form.scopeId : null,
      product_id: form.scope === "product" ? form.scopeId : null,
    };
    if (form.condition === "no_data") {
      payload.for_minutes = Number(form.for_minutes);
    } else {
      payload.data_key = form.data_key.trim();
      payload.threshold = Number(form.threshold);
    }

    try {
      await api.post("/alerts/rules", payload);
      onCreated();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create the rule"));
    } finally {
      setSaving(false);
    }
  }

  const isNoData = form.condition === "no_data";
  const condition = CONDITIONS.find((c) => c.value === form.condition);

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div
        className="modal-card wizard-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-title"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={save}>
          <h3 id="rule-title">New alert rule</h3>
          <p>Oark checks every reading as it arrives, and checks for silence once a minute.</p>

          <div className="add-device-form">
            <label className="field">
              Name
              <input
                type="text"
                placeholder="e.g. Cold store too warm"
                value={form.name}
                onChange={update("name")}
                required
                autoFocus
              />
            </label>

            <label className="field">
              When the device
              <select value={form.condition} onChange={update("condition")}>
                {CONDITIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <span className="field-note">{condition?.hint}</span>
            </label>

            {!isNoData && (
              <div className="field-row-limit">
                <label className="field">
                  Field
                  <input
                    type="text"
                    placeholder="temperature"
                    value={form.data_key}
                    onChange={update("data_key")}
                    required
                  />
                  <span className="field-note">Exactly as the device sends it.</span>
                </label>
                <label className="field">
                  Limit
                  <input
                    type="number"
                    step="any"
                    placeholder="8"
                    value={form.threshold}
                    onChange={update("threshold")}
                    required
                  />
                </label>
              </div>
            )}

            {isNoData && (
              <label className="field">
                After how long without data
                <select value={form.for_minutes} onChange={update("for_minutes")}>
                  <option value={10}>10 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={360}>6 hours</option>
                  <option value={1440}>1 day</option>
                </select>
              </label>
            )}

            <label className="field">
              Applies to
              <select
                value={form.scope}
                onChange={(event) => setForm((c) => ({ ...c, scope: event.target.value, scopeId: "" }))}
              >
                <option value="all">Every device</option>
                <option value="product">All devices of one product</option>
                <option value="device">One device</option>
              </select>
            </label>

            {form.scope === "product" && (
              <label className="field">
                Product
                <select value={form.scopeId} onChange={update("scopeId")} required>
                  <option value="">Choose a product…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {form.scope === "device" && (
              <label className="field">
                Device
                <select value={form.scopeId} onChange={update("scopeId")} required>
                  <option value="">Choose a device…</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              Stay quiet after firing
              <select value={form.cooldown_minutes} onChange={update("cooldown_minutes")}>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={60}>1 hour</option>
                <option value={240}>4 hours</option>
              </select>
              <span className="field-note">So one fault doesn&rsquo;t send a hundred alerts.</span>
            </label>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Creating…" : "Create rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
