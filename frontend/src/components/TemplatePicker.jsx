import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import { PRODUCT_TEMPLATES } from "../constants/templates";
import { categoryIcon } from "./categoryIcon";

// The template cards on their own, so they can sit inside another window
// (Add device) as well as in their own popup (New product). Creating from a
// template is two calls, deliberately the same two the manual path uses: the
// template is a starting point, not a special kind of product.
// Names are one per company (see backend/app/core/names.py): the same rule
// here, so a card can tell whether its product already exists.
function nameKey(name) {
  return name.trim().split(/\s+/).join(" ").toLowerCase();
}

// A name for a second product of the same kind: "Smart switch 2", or 3, 4...
// whichever is the first one the company does not have yet. Only a
// suggestion: the user can type a better one before creating.
function nextFreeName(base, existing) {
  let n = 2;
  // Keep trying the next number while that name is taken.
  while (existing[nameKey(`${base} ${n}`)]) n = n + 1;
  return `${base} ${n}`;
}

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
      setError(null);
      setNewName(nextFreeName(template.name, existing));
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
    return (
      <div className="template-choice">
        <p className="template-choice-lead">
          You already have <b>{choice.have.name}</b>. What would you like to do?
        </p>
        {error && <div className="error">{error}</div>}

        <div className="template-choice-option">
          <div>
            <div className="template-choice-title">Use it</div>
            <div className="template-choice-text">Most common: this becomes another unit of the product you have.</div>
          </div>
          <button type="button" className="primary-button" onClick={() => onUseExisting(choice.have)} disabled={busy}>
            Use {choice.have.name}
          </button>
        </div>

        <form
          className="template-choice-option"
          onSubmit={(event) => {
            event.preventDefault();
            createFromTemplate(choice.template, newName);
          }}
        >
          <div>
            <div className="template-choice-title">Create another one</div>
            <div className="template-choice-text">A second, separate product with the same data points.</div>
            <label className="field">
              Name
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                required
                maxLength={80}
              />
            </label>
          </div>
          <button type="submit" className="ghost-button" disabled={busy || !newName.trim()}>
            {busy ? "Creating…" : "Create"}
          </button>
        </form>

        <button type="button" className="link-button" onClick={() => setChoice(null)} disabled={busy}>
          ← Back to the Product Library
        </button>
      </div>
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
