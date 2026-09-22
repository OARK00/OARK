import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import { PRODUCT_TEMPLATES } from "../constants/templates";
import { categoryIcon } from "./icons";

// Creating from a template is two calls, deliberately the same two the
// manual path uses: the template is a starting point, not a special kind of
// product the rest of the app has to know about.
export default function TemplatePicker({ onClose }) {
  const [creating, setCreating] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function useTemplate(template) {
    if (creating) return;
    setError(null);
    setCreating(template.id);
    try {
      const { data: product } = await api.post("/products", {
        name: template.name,
        category: template.category,
        description: template.description,
      });
      await api.put(`/products/${product.id}/data-points`, { data_points: template.data_points });
      navigate(`/products/${product.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not create that product"));
      setCreating(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !creating && onClose()}>
      <div
        className="modal-card wizard-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="template-title">Start from a template</h3>
        <p>Each one creates a product with its data points already defined. Edit or delete it afterwards.</p>

        {error && <div className="error">{error}</div>}

        <div className="template-grid">
          {PRODUCT_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className="template-card"
              onClick={() => useTemplate(template)}
              disabled={Boolean(creating)}
            >
              <span className="template-icon">{categoryIcon(template.category)}</span>
              <span className="template-name">{template.name}</span>
              <span className="template-summary">{template.summary}</span>
              <span className="template-points">
                {template.data_points.map((point) => point.label).join(" · ")}
              </span>
              {creating === template.id && <span className="template-creating">Creating…</span>}
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={Boolean(creating)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
