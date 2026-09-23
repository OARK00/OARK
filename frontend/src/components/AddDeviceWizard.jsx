import { useEffect, useState } from "react";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import { CATEGORY_OPTIONS } from "../constants/devices";
import ConnectPanel, { useFirstMessage } from "./DeviceConnect";
import DraftReview from "./DraftReview";
import { ChooserBody } from "./NewProductChooser";
import { TemplateGrid } from "./TemplatePicker";
import WizardSteps from "./WizardSteps";

const STEPS = ["Device", "Connect"];
const STANDALONE = "";

// Step one has four views:
//   choose   -- what kind of device is it: describe / template / own setup
//   draft    -- the AI's proposal, for review; creating it makes the product
//   template -- the template cards, inline; picking one creates the product
//   form     -- name the unit, with the product (if any) already selected
// Someone with no products starts at "choose", because "No product" in a
// dropdown is not an answer to "what is this device". Someone with products
// starts at the form, with the choice one click away for something new.
export default function AddDeviceWizard({ onClose, onCreated, initialProductId = STANDALONE }) {
  const [step, setStep] = useState(0);
  const [view, setView] = useState(null);
  const [products, setProducts] = useState(null);
  const [productId, setProductId] = useState(initialProductId);
  const [justCreated, setJustCreated] = useState(null);
  const [draft, setDraft] = useState(null);
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
        setView(data.length || initialProductId ? "form" : "choose");
      })
      .catch(() => {
        setProducts([]);
        setView("form");
      });
  }, [initialProductId]);

  function update(field) {
    return (e) => setForm((current) => ({ ...current, [field]: e.target.value }));
  }

  function adoptNewProduct(product) {
    setProducts((current) => [...(current || []), product]);
    setProductId(product.id);
    setJustCreated(product.name);
    setView("form");
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
  const hasProducts = Boolean(products?.length);

  return (
    <div className="modal-overlay" onClick={() => !creating && step === 0 && onClose()}>
      <div
        className={`modal-card wizard-card${view === "choose" ? " chooser-card" : ""}${
          view === "draft" ? " wizard-card-wide" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        onClick={(e) => e.stopPropagation()}
      >
        <WizardSteps steps={STEPS} current={step} />

        {step === 0 && view === null && <p className="muted">Loading…</p>}

        {step === 0 && view === "choose" && (
          <>
            <h3 id="wizard-title">Add device</h3>
            <p>First, what kind of device is it? Oark uses this to label its data and reuse it for every unit.</p>
            <ChooserBody
              onDraft={(proposal) => {
                setDraft(proposal);
                setView("draft");
              }}
              onTemplate={() => setView("template")}
              onManual={() => {
                setProductId(STANDALONE);
                setView("form");
              }}
              manualTitle="My own setup"
              manualText="Full freedom. Name it and pick a category now; Oark reads its fields once it reports."
            />
            <div className="modal-actions">
              {hasProducts && (
                <button type="button" className="ghost-button" onClick={() => setView("form")}>
                  ← Back
                </button>
              )}
              <button type="button" className="ghost-button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 0 && view === "draft" && draft && (
          <DraftReview draft={draft} onBack={() => setView("choose")} onCreated={adoptNewProduct} />
        )}

        {step === 0 && view === "template" && (
          <>
            <h3 id="wizard-title">Start from a template</h3>
            <p>Pick the closest match. It becomes a product you can edit later, and this device uses it.</p>
            <TemplateGrid onCreated={adoptNewProduct} />
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setView("choose")}>
                ← Back
              </button>
            </div>
          </>
        )}

        {step === 0 && view === "form" && (
          <form onSubmit={createDevice}>
            <h3 id="wizard-title">Add device</h3>
            <p>
              {justCreated
                ? `Created the product “${justCreated}”. Now give this unit a name.`
                : "Pick what kind of device this is, then give this unit a name."}
            </p>
            <div className="add-device-form">
              <label className="field">
                Product
                <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.model_number ? ` (${p.model_number})` : ""}
                    </option>
                  ))}
                  <option value={STANDALONE}>No product: standalone device</option>
                </select>
                {selectedProduct && (
                  <span className="field-note">
                    {selectedProduct.data_points.length
                      ? `Uses ${selectedProduct.data_points.length} data points from this product.`
                      : "This product has no data points yet."}
                  </span>
                )}
                <button type="button" className="link-button small field-link" onClick={() => setView("choose")}>
                  Something new? Start from a template or your own setup
                </button>
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
              {!productId && (
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
              <button type="submit" className="primary-button" disabled={creating}>
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
