export const CATEGORY_OPTIONS = [
  { value: "sensor", label: "Sensor" },
  { value: "controller", label: "Controller" },
  { value: "gateway", label: "Gateway" },
  { value: "other", label: "Other" },
];

export const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c.label]));

export const MQTT_HOST = "h1106116.ala.asia-southeast1.emqxsl.com";
export const MQTT_PORT = 8883;
