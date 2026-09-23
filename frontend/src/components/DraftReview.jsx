import { useState } from "react";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import { CATEGORY_OPTIONS } from "../constants/devices";
import DataPointEditor, { toPayload, toRows, validateRows } from "./DataPointEditor";

// The AI's proposal, laid out for a person to check. Nothing has been saved
// yet: creating goes through the same two calls as every other product, so
// an AI-drafted product is indistinguishable from a hand-made one afterwards.
export default function DraftReview({ draft, onBack, onCreated }) {
  const [form, setForm] = useState({
    name: draft.name,
    category: draft.category,
    description: draft.description || "",
  });
  const [rows, setRows] = useState(() => toRows(draft.data_points).map((row) => ({ ...row, suggested: true })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function create(event) {
    event.preventDefault();
    const problem = validateRows(rows);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: product } = await api.post("/products", {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || null,
      });
      const { data: saved } = await api.put(`/products/${product.id}/data-points`, {
        data_points: toPayload(rows),
      });
      onCreated(saved);
    } catch (err) {
      setError(getErrorMessage(err, "Could not create the product"));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={create}>
      <h3>Check the draft</h3>
      <p>Drafted from your description. Change anything that isn&rsquo;t right, then create it.</p>

      <div className="add-device-form">
        <div className="field-row">
          <label className="field">
            Product name
            <input type="text" value={form.name} onChange={update("name")} required maxLength={80} />
          </label>
          <label className="field">
            Category
            <select value={form.category} onChange={update("category")}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>
            Description <span className="field-hint">(optional)</span>
          </span>
          <textarea value={form.description} onChange={update("description")} />
        </label>
      </div>

      <DataPointEditor rows={rows} onChange={setRows} />

      {error && <div className="error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={onBack} disabled={saving}>
          ← Back
        </button>
        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? "Creating…" : "Create product"}
        </button>
      </div>
    </form>
  );
}
