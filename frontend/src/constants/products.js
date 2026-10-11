export const DATA_POINT_TYPES = [
  { value: "number", label: "Number" },
  { value: "boolean", label: "On / off" },
  { value: "string", label: "Text" },
];

export const ACCESS_OPTIONS = [
  { value: "read", label: "Reported" },
  { value: "write", label: "Controllable" },
];

// "Build Your Own" is the product form (DraftReview) opened empty. Defined
// once: Add device and the Products page both open it with exactly this.
export const BUILD_YOUR_OWN = {
  draft: { name: "", category: "sensor", description: "", data_points: [] },
  title: "Build Your Own",
  intro:
    "Full freedom: name the product and add its fields and controls, including buttons. You can also leave the fields for later: Oark suggests them once the device reports.",
};

export const TYPE_LABELS = Object.fromEntries(DATA_POINT_TYPES.map((t) => [t.value, t.label]));
export const ACCESS_LABELS = Object.fromEntries(ACCESS_OPTIONS.map((a) => [a.value, a.label]));
