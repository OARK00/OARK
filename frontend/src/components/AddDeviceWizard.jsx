import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import { CATEGORY_OPTIONS } from "../constants/devices";
import ConnectPanel, { useFirstMessage } from "./DeviceConnect";
import WizardSteps from "./WizardSteps";

const STEPS = ["Device", "Connect"];
const STANDALONE = "";

export default function AddDeviceWizard({ onClose, onCreated, initialProductId = STANDALONE }) {
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState(null);
  const [productId, setProductId] = useState(initialProductId);
  const [form, setForm] = useState({ name: "", category: "sensor", description: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  const watch = useFirstMessage(created?.id);

  useEffect(() => {
    api
      .get("/products")
      .then(({ data }) => {
        setProducts(data);
        if (!initialProductId && data.length) setProductId(data[0].id);
      })
      .catch(() => setProducts([]));
  }, [initialProductId]);

  function update(field) {
    return (e) => setForm((current) => ({ ...current, [field]: e.target.value }));
  }

  async function createDevice(e) {
    e.preventDefault();
    if (creating) return;
    setError(null);
    setCreating(true);
    try {
      const { data } = await api.post("/devices", {
        name: form.name.trim(),
        product_id: productId || null,
        category: productId ? null : form.category,
        description: form.description.trim() || null,
      });
      setCreated(data);
      setStep(1);
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create device"));
    } finally {
      setCreating(false);
    }
  }

  const selectedProduct = products?.find((p) => p.id === productId);

  return (
    <div className="modal-overlay" onClick={() => !creating && step === 0 && onClose()}>
      <div
        className="modal-card wizard-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        onClick={(e) => e.stopPropagation()}
      >
        <WizardSteps steps={STEPS} current={step} />

        {step === 0 && (
          <form onSubmit={createDevice}>
            <h3 id="wizard-title">Add device</h3>
            <p>Pick what kind of device this is, then give this unit a name.</p>
            <div className="add-device-form">
              <label className="field">
                Product
                <select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={products === null}>
                  {products === null && <option value={productId}>Loading products…</option>}
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.model_number ? ` (${p.model_number})` : ""}
                    </option>
                  ))}
                  {products !== null && <option value={STANDALONE}>No product: standalone device</option>}
                </select>
                {products?.length === 0 && (
                  <span className="field-note">
                    No products yet. <Link to="/products">Create one</Link> to reuse its data points across devices.
                  </span>
                )}
                {selectedProduct && (
                  <span className="field-note">
                    {selectedProduct.data_points.length
                      ? `Uses ${selectedProduct.data_points.length} data points from this product.`
                      : "This product has no data points yet."}
                  </span>
                )}
              </label>
              <label className="field">
                Name
                <input
                  type="text"
                  placeholder="e.g. Boiler 2, basement"
                  value={form.name}
                  onChange={update("name")}
                  required
                  autoFocus
                />
              </label>
              {!productId && products !== null && (
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
              )}
              <label className="field">
                <span>
                  Description <span className="field-hint">(optional)</span>
                </span>
                <textarea
                  placeholder="e.g. Ceiling mount, west corner of warehouse B"
                  value={form.description}
                  onChange={update("description")}
                />
              </label>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={onClose} disabled={creating}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={creating || products === null}>
                {creating ? "Creating..." : "Create device"}
              </button>
            </div>
          </form>
        )}

        {step === 1 && created && (
          <>
            <h3 id="wizard-title">Connect &ldquo;{created.name}&rdquo;</h3>
            <p>Flash the device with the code below. The secret is shown only once.</p>
            <ConnectPanel created={created} watch={watch} />
            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
