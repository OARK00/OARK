export const DATA_POINT_TYPES = [
  { value: "number", label: "Number" },
  { value: "boolean", label: "On / off" },
  { value: "string", label: "Text" },
];

export const ACCESS_OPTIONS = [
  { value: "read", label: "Reported" },
  { value: "write", label: "Controllable" },
];

export const TYPE_LABELS = Object.fromEntries(DATA_POINT_TYPES.map((t) => [t.value, t.label]));
export const ACCESS_LABELS = Object.fromEntries(ACCESS_OPTIONS.map((a) => [a.value, a.label]));
