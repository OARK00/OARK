import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import { PRODUCT_TEMPLATES } from "../constants/templates";
import { categoryIcon } from "./categoryIcon";
import NameField from "./NameField";
import { isTaken, nameKey, takenKeys } from "./names";

// The template cards on their own, so they can sit inside another window
// (Add device) as well as in their own popup (New product). Creating from a
// template is two calls, deliberately the same two the manual path uses: the
// template is a starting point, not a special kind of product.

export function TemplateGrid({ onCreated, onUseExisting = onCreated }) {
  const [creating, setCreating] = useState(null);
  const [error, setError] = useState(null);
  // Set when the user picks a card whose product they already have: they
  // then choose between using that product and making a second one.
  const [choice, setChoice] = useState(null);
  const [newName, setNewName] = useState("");
  // The company's products by name, to offer one that exists instead of
  // making a copy. If this can't be loaded, picking still works: the server
  // refuses a duplicate with a clear message.
  const [existing, setExisting] = useState({});

  useEffect(() => {
    let active = true;
    api
      .get("/products")
      .then(({ data }) => {
        if (active) setExisting(Object.fromEntries(data.map((product) => [nameKey(product.name), product])));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function pick(template) {
    if (creating) return;
    const have = existing[nameKey(template.name)];
    if (have) {
      // The name box opens on the taken name, so the warning and the free
      // names under it explain themselves.
      setError(null);
      setNewName(template.name);
      setChoice({ template, have });
      return;
    }
    createFromTemplate(template, template.name);
  }

  async function createFromTemplate(template, name) {
    if (creating) return;
    setError(null);
    setCreating(template.id);
    try {
      const { data: product } = await api.post("/products", {
        name,
        category: template.category,
        description: template.description,
      });
      const { data: saved } = await api.put(`/products/${product.id}/data-points`, {
        data_points: template.data_points,
      });
      onCreated(saved);
    } catch (err) {
      setError(getErrorMessage(err, "Could not create that product"));
      setCreating(null);
    }
  }

  if (choice) {
    const busy = Boolean(creating);
    const keys = takenKeys(Object.values(existing).map((product) => product.name));
    const blocked = busy || !newName.trim() || isTaken(keys, newName);
    return (
      <form
        className="template-choice"
        onSubmit={(event) => {
          event.preventDefault();
          if (!blocked) createFromTemplate(choice.template, newName);
        }}
      >
        <p className="template-choice-lead">
          <b>{choice.template.name}</b> from the Product Library. Give this product a name.
        </p>
        <NameField
          label="Product name"
          value={newName}
          onChange={setNewName}
          keys={keys}
          kind="product"
          required
          maxLength={80}
          autoFocus
        />
        {error && <div className="error">{error}</div>}

        <div className="template-choice-actions">
          <button type="button" className="link-button" onClick={() => onUseExisting(choice.have)} disabled={busy}>
            Or use your existing “{choice.have.name}” product →
          </button>
          <button type="submit" className="primary-button" disabled={blocked}>
            {busy ? "Creating…" : "Create product"}
          </button>
        </div>

        <button type="button" className="link-button" onClick={() => setChoice(null)} disabled={busy}>
          ← Back to the Product Library
        </button>
      </form>
    );
  }

  return (
    <>
      {error && <div className="error">{error}</div>}
      <div className="template-grid">
        {PRODUCT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="template-card"
            onClick={() => pick(template)}
            disabled={Boolean(creating)}
          >
            <span className="template-icon">{categoryIcon(template.category)}</span>
            <span className="template-name">{template.name}</span>
            <span className="template-summary">{template.summary}</span>
            <span className="template-points">{template.data_points.map((point) => point.label).join(" · ")}</span>
            {existing[nameKey(template.name)] && (
              <span className="template-existing">You already have this.</span>
            )}
            {creating === template.id && <span className="template-creating">Creating…</span>}
          </button>
        ))}
      </div>
    </>
  );
}

export default function TemplatePicker({ onClose }) {
  const navigate = useNavigate();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card wizard-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="template-title">Product Library</h3>
        <p>Each one creates a product with its data points already defined. Edit or delete it afterwards.</p>

        <TemplateGrid onCreated={(product) => navigate(`/products/${product.id}`)} />

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
