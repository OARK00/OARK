// Data-point rows: the editor's form strings <-> the API's data points.
// Kept apart from DataPointEditor.jsx so that file exports only a component.

const MAX_BUTTONS = 8;
const MAX_BUTTON_VALUE = 32;

// "forward, reverse, stop" -> ["forward", "reverse", "stop"]
export function parseOptions(text) {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

// Buttons only make sense on a text field Oark can control.
export function canHaveButtons(row) {
  return row.type === "string" && row.access === "write";
}

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
    widget: p.widget ?? "",
    options: (p.options || []).join(", "),
    releaseValue: p.release_value ?? "",
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
      const buttons = canHaveButtons(r) && r.widget === "buttons";
      const options = buttons ? parseOptions(r.options) : [];
      return {
        key: r.key.trim(),
        label: r.label.trim(),
        type: r.type,
        unit: isNumber && r.unit.trim() ? r.unit.trim() : null,
        min: isNumber && r.min !== "" ? Number(r.min) : null,
        max: isNumber && r.max !== "" ? Number(r.max) : null,
        access: r.access,
        widget: buttons ? "buttons" : null,
        options: buttons ? options : null,
        release_value: buttons && options.includes(r.releaseValue) ? r.releaseValue : null,
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
    if (canHaveButtons(r) && r.widget === "buttons") {
      const options = parseOptions(r.options);
      if (options.length === 0) return `${name}: add at least one button, e.g. forward, reverse, stop.`;
      if (options.length > MAX_BUTTONS) return `${name}: at most ${MAX_BUTTONS} buttons.`;
      if (new Set(options).size !== options.length) return `${name}: the same button is listed twice.`;
      if (options.some((option) => option.length > MAX_BUTTON_VALUE)) {
        return `${name}: keep each button value under ${MAX_BUTTON_VALUE} characters.`;
      }
    }
  }
  return null;
}
