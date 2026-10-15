import { useState } from "react";
import { ACCESS_LABELS } from "../constants/products";
import { pinKind, pinLabel, pinsFor } from "../constants/esp32Pins";

const KIND_HINTS = {
  output: "switched on and off",
  input: "read as on/off",
  analog: "read as a number",
};

function draftFrom(points) {
  return Object.fromEntries(points.map((p) => [p.key, { pin: p.pin ?? null, activeLow: Boolean(p.active_low) }]));
}

// The product's data points, each with the ESP32 GPIO it is wired to.
// Saving updates the product, so every device of it gets the same wiring.
// Remount it (with a key) to start over from the saved pins.
export default function PinPanel({ points, onSave }) {
  const [draft, setDraft] = useState(() => draftFrom(points));
  const [saving, setSaving] = useState(false);

  const changed = points.some((p) => (p.pin ?? null) !== draft[p.key].pin || Boolean(p.active_low) !== draft[p.key].activeLow);
  const usedBy = Object.fromEntries(
    Object.entries(draft)
      .filter(([, value]) => value.pin != null)
      .map(([key, value]) => [value.pin, key])
  );

  function setPin(key, value) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], pin: value === "" ? null : Number(value) } }));
  }

  function setActiveLow(key, value) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], activeLow: value } }));
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(points.map((p) => ({ ...p, pin: draft[p.key].pin, active_low: draft[p.key].activeLow })));
    } finally {
      setSaving(false);
    }
  }

  if (points.length === 0) return null;

  return (
    <div className="pin-panel">
      <ul className="fw-points">
        {points.map((point) => {
          const kind = pinKind(point);
          const value = draft[point.key];
          return (
            <li key={point.key}>
              <span>{point.label}</span>
              <code>{point.key}</code>
              <span className={`access-pill access-${point.access}`}>{ACCESS_LABELS[point.access]}</span>
              {kind ? (
                <div className="pin-choice">
                  <label>
                    <select aria-label={`GPIO for ${point.label}`} value={value.pin ?? ""} onChange={(e) => setPin(point.key, e.target.value)}>
                      <option value="">Not wired</option>
                      {pinsFor(kind).map((pin) => (
                        <option key={pin} value={pin} disabled={usedBy[pin] !== undefined && usedBy[pin] !== point.key}>
                          {pinLabel(pin)}
                          {usedBy[pin] !== undefined && usedBy[pin] !== point.key ? " — in use" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="pin-hint">{KIND_HINTS[kind]}</span>
                  {kind === "output" && value.pin != null && (
                    <label className="pin-low">
                      <input type="checkbox" checked={value.activeLow} onChange={(e) => setActiveLow(point.key, e.target.checked)} />
                      <span>On when LOW (most relay boards)</span>
                    </label>
                  )}
                </div>
              ) : (
                <span className="pin-hint pin-none">No GPIO: set this in your own code</span>
              )}
            </li>
          );
        })}
      </ul>
      {changed && (
        <button type="button" className="primary-button pin-save" onClick={save} disabled={saving}>
          {saving ? "Saving pins…" : "Save pins"}
        </button>
      )}
    </div>
  );
}
