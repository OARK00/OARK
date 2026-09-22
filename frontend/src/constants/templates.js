// Ready-made product definitions for the common industrial cases, so a new
// customer can start from something that already matches their hardware
// instead of typing out every field. Creating one makes an ordinary product:
// it can be edited or deleted afterwards like any other.
export const PRODUCT_TEMPLATES = [
  {
    id: "temperature-humidity",
    name: "Temperature & humidity sensor",
    category: "sensor",
    description: "Two-value environment sensor, the common DHT or SHT style unit.",
    summary: "Cold stores, server rooms, greenhouses",
    data_points: [
      { key: "temperature", label: "Temperature", type: "number", unit: "°C", access: "read" },
      { key: "humidity", label: "Humidity", type: "number", unit: "%", min: 0, max: 100, access: "read" },
    ],
  },
  {
    id: "energy-meter",
    name: "Energy meter",
    category: "sensor",
    description: "Single-phase electrical measurements from a meter or CT clamp.",
    summary: "Machines, panels, generators",
    data_points: [
      { key: "voltage", label: "Voltage", type: "number", unit: "V", access: "read" },
      { key: "current", label: "Current", type: "number", unit: "A", access: "read" },
      { key: "power", label: "Power", type: "number", unit: "W", access: "read" },
      { key: "energy", label: "Energy", type: "number", unit: "kWh", access: "read" },
    ],
  },
  {
    id: "tank-level",
    name: "Tank level monitor",
    category: "sensor",
    description: "Level and volume from an ultrasonic or pressure sensor.",
    summary: "Water, diesel, chemicals",
    data_points: [
      { key: "level", label: "Level", type: "number", unit: "%", min: 0, max: 100, access: "read" },
      { key: "volume", label: "Volume", type: "number", unit: "L", access: "read" },
    ],
  },
  {
    id: "machine-status",
    name: "Machine status controller",
    category: "controller",
    description: "Running state, runtime and faults, with a switch that can be controlled.",
    summary: "Pumps, motors, production lines",
    data_points: [
      { key: "running", label: "Running", type: "boolean", access: "write" },
      { key: "runtime_hours", label: "Runtime", type: "number", unit: "h", access: "read" },
      { key: "fault", label: "Fault", type: "string", access: "read" },
    ],
  },
];
