import { ACCESS_OPTIONS, DATA_POINT_TYPES } from "../constants/products";
import { PlusIcon, TrashIcon } from "./icons";

// Editor rows hold form strings; toRows/toPayload convert at the edges.
export function toRows(points) {
  return points.map((p) => ({
    key: p.key,
    label: p.label,
    type: p.type,
    unit: p.unit ?? "",
    min: p.min ?? "",
    max: p.max ?? "",
    access: p.access,
    include: true,
    manual: false,
    sampleCount: p.sample_count ?? null,
    lastValue: p.last_value,
    observedMin: p.observed_min ?? null,
    observedMax: p.observed_max ?? null,
  }));
}

export function toPayload(rows) {
  return rows
    .filter((r) => r.include)
    .map((r) => {
      const isNumber = r.type === "number";
      return {
        key: r.key.trim(),
        label: r.label.trim(),
        type: r.type,
        unit: isNumber && r.unit.trim() ? r.unit.trim() : null,
        min: isNumber && r.min !== "" ? Number(r.min) : null,
        max: isNumber && r.max !== "" ? Number(r.max) : null,
        access: r.access,
      };
    });
}

export function validateRows(rows) {
  const seen = new Set();
  for (const r of rows.filter((row) => row.include)) {
    const name = r.label.trim() || r.key.trim() || "A data point";
    if (!r.key.trim()) return `${name} needs a key: the field name your device sends.`;
    if (!r.label.trim()) return `"${r.key}" needs a name.`;
    if (seen.has(r.key.trim())) return `Two data points use the key "${r.key.trim()}".`;
    seen.add(r.key.trim());
    if (r.type === "number") {
      if (r.min !== "" && Number.isNaN(Number(r.min))) return `${name}: minimum must be a number.`;
      if (r.max !== "" && Number.isNaN(Number(r.max))) return `${name}: maximum must be a number.`;
      if (r.min !== "" && r.max !== "" && Number(r.min) > Number(r.max)) {
        return `${name}: minimum is higher than maximum.`;
      }
    }
  }
  return null;
}

function formatValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function Observation({ row }) {
  if (row.manual) return <span>Added by you</span>;
  if (!row.sampleCount) return <span>Not seen in recent data</span>;
  const range =
    row.observedMin !== null && row.observedMax !== null && row.observedMin !== row.observedMax
      ? ` · range ${row.observedMin}–${row.observedMax}`
      : "";
  return (
    <span>
      Seen {row.sampleCount}× · last <b>{formatValue(row.lastValue)}</b>
      {range}
    </span>
  );
}

export default function DataPointEditor({ rows, onChange }) {
  function updateRow(index, field, value) {
    onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    onChange([
      ...rows,
      {
        key: "",
        label: "",
        type: "number",
        unit: "",
        min: "",
        max: "",
        access: "read",
        include: true,
        manual: true,
        sampleCount: null,
        lastValue: null,
        observedMin: null,
        observedMax: null,
      },
    ]);
  }

  return (
    <div className="dp-editor">
      {rows.length === 0 && (
        <p className="dp-empty">
          Nothing to suggest yet. Add data points by hand, or connect a device and come back.
        </p>
      )}

      {rows.map((row, index) => {
        const id = `dp-${index}`;
        const isNumber = row.type === "number";
        return (
          <div key={id} className={`dp-row ${row.include ? "" : "excluded"}`}>
            <div className="dp-row-head">
              {row.manual ? (
                <button
                  type="button"
                  className="dp-remove"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  aria-label="Remove data point"
                >
                  {TrashIcon}
                </button>
              ) : (
                <input
                  type="checkbox"
                  className="dp-include"
                  checked={row.include}
                  onChange={(e) => updateRow(index, "include", e.target.checked)}
                  aria-label={`Include ${row.label || row.key}`}
                />
              )}
              <input
                className="dp-label"
                value={row.label}
                onChange={(e) => updateRow(index, "label", e.target.value)}
                placeholder="Name, e.g. Temperature"
                aria-label="Data point name"
                disabled={!row.include}
              />
              <select
                className="dp-access"
                value={row.access}
                onChange={(e) => updateRow(index, "access", e.target.value)}
                aria-label="Access"
                disabled={!row.include}
              >
                {ACCESS_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="dp-row-meta">
              {row.manual ? (
                <input
                  className="dp-key-input"
                  value={row.key}
                  onChange={(e) => updateRow(index, "key", e.target.value)}
                  placeholder="key, e.g. temperature"
                  aria-label="Key sent by the device"
                />
              ) : (
                <code className="dp-key">{row.key}</code>
              )}
              <Observation row={row} />
            </div>

            {row.include && (
              <div className="dp-row-fields">
                <label className="dp-field">
                  Type
                  <select value={row.type} onChange={(e) => updateRow(index, "type", e.target.value)}>
                    {DATA_POINT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                {isNumber && (
                  <>
                    <label className="dp-field">
                      Unit
                      <input value={row.unit} onChange={(e) => updateRow(index, "unit", e.target.value)} placeholder="°C" />
                    </label>
                    <label className="dp-field">
                      Min
                      <input
                        inputMode="decimal"
                        value={row.min}
                        onChange={(e) => updateRow(index, "min", e.target.value)}
                        placeholder="none"
                      />
                    </label>
                    <label className="dp-field">
                      Max
                      <input
                        inputMode="decimal"
                        value={row.max}
                        onChange={(e) => updateRow(index, "max", e.target.value)}
                        placeholder="none"
                      />
                    </label>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button type="button" className="dp-add" onClick={addRow}>
        {PlusIcon}
        Add data point
      </button>
    </div>
  );
}
