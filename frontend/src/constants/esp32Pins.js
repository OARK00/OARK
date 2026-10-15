// ESP32 GPIOs Oark offers, the same lists the backend checks
// (backend/app/modules/products/schemas.py). Left out: 6-11 (flash chip)
// and 1 and 3 (the USB serial line used for uploading and the monitor).
export const USABLE_PINS = [0, 2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39];
// No output driver: these can only read.
const INPUT_ONLY_PINS = new Set([34, 35, 36, 39]);
// Analog readings with Wi-Fi on: ADC1 only (Wi-Fi takes over ADC2).
const ANALOG_PINS = new Set([32, 33, 34, 35, 36, 39]);

// Notes shown next to pins that work but need care.
const PIN_NOTES = {
  0: "boot button",
  2: "built-in LED on most boards",
  5: "must be high at boot",
  12: "must be low at boot",
  15: "must be high at boot",
};

// What a pin would do for a data point, or null if it cannot have one.
export function pinKind(point) {
  if (point.type === "boolean") return point.access === "write" ? "output" : "input";
  if (point.type === "number" && point.access === "read") return "analog";
  return null;
}

export function pinsFor(kind) {
  if (kind === "output") return USABLE_PINS.filter((pin) => !INPUT_ONLY_PINS.has(pin));
  if (kind === "analog") return USABLE_PINS.filter((pin) => ANALOG_PINS.has(pin));
  return USABLE_PINS;
}

export function pinLabel(pin) {
  return PIN_NOTES[pin] ? `GPIO ${pin} (${PIN_NOTES[pin]})` : `GPIO ${pin}`;
}
