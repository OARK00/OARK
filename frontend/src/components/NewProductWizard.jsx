import { useEffect, useState } from "react";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import { CATEGORY_OPTIONS } from "../constants/devices";
import ConnectPanel, { useFirstMessage } from "./DeviceConnect";
import DataPointEditor, { toPayload, toRows, validateRows } from "./DataPointEditor";
import WizardSteps from "./WizardSteps";

const STEPS = ["Basics", "Test device", "Data points"];

// `onFinish(productId)` runs once a product exists and the wizard closes.
export default function NewProductWizard({ onClose, onFinish }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", category: "sensor", modelNumber: "", description: "" });
  const [product, setProduct] = useState(null);
  const [deviceName, setDeviceName] = useState("");
  const [created, setCreated] = useState(null);
  const [rows, setRows] = useState([]);
  const [suggestionInfo, setSuggestionInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const watch = useFirstMessage(created?.id);

  function update(field) {
    return (e) => setForm((current) => ({ ...current, [field]: e.target.value }));
  }

  function close() {
    if (product) onFinish(product.id);
    else onClose();
  }

  async function createProduct(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post("/products", {
        name: form.name.trim(),
        category: form.category,
        model_number: form.modelNumber.trim() || null,
        description: form.description.trim() || null,
      });
      setProduct(data);
      setDeviceName(`${data.name} test unit`);
      setStep(1);
    } catch (err) {
      setError(getErrorMessage(err, "Could not create product"));
    } finally {
      setBusy(false);
    }
  }

  async function createTestDevice(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post("/devices", { name: deviceName.trim(), product_id: product.id });
      setCreated(data);
    } catch (err) {
      setError(getErrorMessage(err, "Could not create test device"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (step !== 2 || !product) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    api
      .get(`/products/${product.id}/suggested-data-points`)
      .then(({ data }) => {
        if (cancelled) return;
        setRows(toRows(data.data_points));
        setSuggestionInfo({ readings: data.reading_count });
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err, "Could not read the device's data")))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [step, product]);

  async function saveDataPoints(e) {
    e.preventDefault();
    const problem = validateRows(rows);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.put(`/products/${product.id}/data-points`, { data_points: toPayload(rows) });
      onFinish(product.id);
    } catch (err) {
      setError(getErrorMessage(err, "Could not save data points"));
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => step === 0 && !busy && onClose()}>
      <div
        className={`modal-card wizard-card ${step === 2 ? "wizard-card-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-wizard-title"
        onClick={(e) => e.stopPropagation()}
      >
        <WizardSteps steps={STEPS} current={step} />

        {step === 0 && (
          <form onSubmit={createProduct}>
            <h3 id="product-wizard-title">New product</h3>
            <p>A product is a type of device you build. Define it once, then add as many devices of it as you need.</p>
            <div className="add-device-form">
              <label className="field">
                Product name
                <input
                  type="text"
                  placeholder="e.g. Boiler Monitor"
                  value={form.name}
                  onChange={update("name")}
                  required
                  maxLength={80}
                  autoFocus
                />
              </label>
              <div className="field-row">
                <label className="field">
                  Category
                  <select value={form.category} onChange={update("category")}>
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>
                    Model number <span className="field-hint">(optional)</span>
                  </span>
                  <input type="text" placeholder="e.g. BM-100" value={form.modelNumber} onChange={update("modelNumber")} />
                </label>
              </div>
              <label className="field">
                <span>
                  Description <span className="field-hint">(optional)</span>
                </span>
                <textarea
                  placeholder="What does it measure or control?"
                  value={form.description}
                  onChange={update("description")}
                />
              </label>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? "Creating..." : "Next"}
              </button>
            </div>
          </form>
        )}

        {step === 1 && !created && (
          <form onSubmit={createTestDevice}>
            <h3 id="product-wizard-title">Connect a test device</h3>
            <p>
              Connect one real <b>{product.name}</b> and let it send a few messages. Oark reads what it sends and
              suggests the data points for you.
            </p>
            <div className="add-device-form">
              <label className="field">
                Test device name
                <input type="text" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} required autoFocus />
              </label>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={close} disabled={busy}>
                Skip, define later
              </button>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? "Creating..." : "Create test device"}
              </button>
            </div>
          </form>
        )}

        {step === 1 && created && (
          <>
            <h3 id="product-wizard-title">Connect &ldquo;{created.name}&rdquo;</h3>
            <p>Configure the board with these details. The secret is shown only once — save it now.</p>
            <ConnectPanel created={created} watch={watch} />
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={close}>
                Skip, define later
              </button>
              <button type="button" className="primary-button" onClick={() => setStep(2)} disabled={!watch.connected}>
                {watch.connected ? "Next: data points" : "Waiting for data…"}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <form onSubmit={saveDataPoints}>
            <h3 id="product-wizard-title">Confirm data points</h3>
            <p>
              {suggestionInfo?.readings
                ? `Based on ${suggestionInfo.readings} ${suggestionInfo.readings === 1 ? "message" : "messages"} from your test device. `
                : ""}
              Check the names and types, then add units and safe limits where they matter.
            </p>
            {busy && !suggestionInfo ? (
              <p className="muted">Reading the device's data…</p>
            ) : (
              <DataPointEditor rows={rows} onChange={setRows} />
            )}
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={close} disabled={busy}>
                Skip, define later
              </button>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy && suggestionInfo ? "Saving..." : "Save product"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
