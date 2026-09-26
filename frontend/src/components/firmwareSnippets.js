import { MQTT_HOST, MQTT_PORT } from "../constants/devices";

// When a device has no product yet, the snippets show one example reading.
const EXAMPLE_POINTS = [{ key: "temperature", type: "number", access: "read" }];

// A data point key is the exact name in the JSON ("Temp C" is allowed), so
// the C++ variable gets its own safe name while the JSON keeps the key.
function cppName(key, taken) {
  const words = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let name = words
    .map((word, i) => (i === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)))
    .join("");
  if (!name || /^[0-9]/.test(name)) name = `v${name}`;
  let unique = name;
  for (let n = 2; taken.has(unique); n += 1) unique = `${name}${n}`;
  taken.add(unique);
  return unique;
}

function cString(text) {
  return JSON.stringify(text);
}

function withNames(dataPoints) {
  const points = dataPoints && dataPoints.length > 0 ? dataPoints : EXAMPLE_POINTS;
  const taken = new Set(["mqtt", "net", "report", "applyOutputs", "onCommand", "connectOark", "lastReport"]);
  return points.map((point) => ({ ...point, name: cppName(point.key, taken) }));
}

const CPP_TYPES = { boolean: "bool", number: "float", string: "String" };
const CPP_DEFAULTS = { boolean: "false", number: "0", string: '""' };
const CPP_CHECKS = { boolean: "bool", number: "float", string: "const char*" };

export function arduinoSketch(deviceId, secret, dataPoints) {
  const points = withNames(dataPoints);
  const controls = points.filter((p) => p.access === "write");
  const readings = points.filter((p) => p.access !== "write");

  const readingLines = readings
    .map((p) => `  data[${cString(p.key)}] = ${CPP_DEFAULTS[p.type] || "0"};   // replace with your ${p.label || p.key} reading`)
    .join("\n");

  const controlParts = controls.length
    ? {
        state: `// What Oark can change. Oark sends new values; applyOutputs() acts on them.
${controls.map((p) => `${CPP_TYPES[p.type] || "float"} ${p.name} = ${CPP_DEFAULTS[p.type] || "0"};`).join("\n")}

void applyOutputs() {
  // Drive your hardware from the values above, for example:
  // digitalWrite(RELAY_PIN, ${controls.find((p) => p.type === "boolean")?.name || "someSwitch"} ? HIGH : LOW);
}

`,
        report: controls.map((p) => `  data[${cString(p.key)}] = ${p.name};`).join("\n"),
        handler: `
// Oark sends {"desired": {...}} to this device's commands topic when someone
// changes a control. Reporting the new values is the confirmation Oark waits for.
void onCommand(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, length)) return;   // not JSON: ignore it
  JsonObject desired = doc["desired"];
${controls
  .map((p) => {
    const read = p.type === "string" ? `desired[${cString(p.key)}].as<const char*>()` : `desired[${cString(p.key)}]`;
    return `  if (desired[${cString(p.key)}].is<${CPP_CHECKS[p.type] || "float"}>()) ${p.name} = ${read};`;
  })
  .join("\n")}
  applyOutputs();
  report();   // confirm straight away instead of waiting for the next report
}
`,
        connect: `
  mqtt.setCallback(onCommand);`,
        subscribe: `
      mqtt.subscribe(commandsTopic, 1);`,
        setup: `
  applyOutputs();`,
      }
    : { state: "", report: "", handler: "", connect: "", subscribe: "", setup: "" };

  const reportLines = [readingLines, controlParts.report].filter(Boolean).join("\n");

  return `#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>   // Library Manager: "PubSubClient" by Nick O'Leary
#include <ArduinoJson.h>    // Library Manager: "ArduinoJson" by Benoit Blanchon

const char* WIFI_SSID     = "your-wifi-name";
const char* WIFI_PASSWORD = "your-wifi-password";

// From Oark. The secret is shown only once -- keep it in the device only.
const char* DEVICE_ID     = "${deviceId}";
const char* DEVICE_SECRET = "${secret}";

WiFiClientSecure net;
PubSubClient mqtt(net);
char telemetryTopic[96];
char commandsTopic[96];
unsigned long lastReport = 0;

${controlParts.state}void report() {
  JsonDocument doc;
  doc["secret"] = DEVICE_SECRET;
  JsonObject data = doc["data"].to<JsonObject>();
${reportLines}

  char payload[768];
  serializeJson(doc, payload, sizeof(payload));
  mqtt.publish(telemetryTopic, payload);
}
${controlParts.handler}
void connectOark() {
  mqtt.setServer("${MQTT_HOST}", ${MQTT_PORT});
  mqtt.setBufferSize(1024);   // the default 256 bytes is too small for most reports${controlParts.connect}
  while (!mqtt.connected()) {
    Serial.print("Connecting to Oark... ");
    if (mqtt.connect(DEVICE_ID, DEVICE_ID, DEVICE_SECRET)) {
      Serial.println("connected");${controlParts.subscribe}
    } else {
      Serial.println(mqtt.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  snprintf(telemetryTopic, sizeof(telemetryTopic), "oark/devices/%s/telemetry", DEVICE_ID);
  snprintf(commandsTopic, sizeof(commandsTopic), "oark/devices/%s/commands", DEVICE_ID);
${controlParts.setup}
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  net.setInsecure();   // TLS without checking the broker's certificate
  connectOark();
}

void loop() {
  if (!mqtt.connected()) connectOark();
  mqtt.loop();   // keep this running: it is what receives commands

  // No delay() here: a device asleep in delay() hears nothing from Oark.
  if (millis() - lastReport >= 10000) {   // every 10 seconds
    lastReport = millis();
    report();
  }
}`;
}

const PY_DEFAULTS = { boolean: "False", number: "0", string: '""' };

export function pythonSnippet(deviceId, secret, dataPoints) {
  const points = withNames(dataPoints);
  const controls = points.filter((p) => p.access === "write");
  const readings = points.filter((p) => p.access !== "write");
  const readingDict = readings.map((p) => `${JSON.stringify(p.key)}: ${PY_DEFAULTS[p.type] || "0"}`).join(", ");

  if (controls.length === 0) {
    return `import json, ssl, time
import paho.mqtt.client as mqtt   # pip install paho-mqtt

DEVICE_ID = "${deviceId}"
DEVICE_SECRET = "${secret}"

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=DEVICE_ID)
client.username_pw_set(DEVICE_ID, DEVICE_SECRET)
client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
client.connect("${MQTT_HOST}", ${MQTT_PORT})
client.loop_start()

while True:
    data = {${readingDict}}   # replace with your readings
    body = json.dumps({"secret": DEVICE_SECRET, "data": data})
    client.publish(f"oark/devices/{DEVICE_ID}/telemetry", body, qos=1)
    time.sleep(10)`;
  }

  const stateDict = controls.map((p) => `    ${JSON.stringify(p.key)}: ${PY_DEFAULTS[p.type] || "0"},`).join("\n");

  return `import json, ssl, time
import paho.mqtt.client as mqtt   # pip install paho-mqtt

DEVICE_ID = "${deviceId}"
DEVICE_SECRET = "${secret}"

# What Oark can change. Oark sends new values; apply() acts on them.
controls = {
${stateDict}
}


def apply():
    pass   # drive your hardware from controls[...] here


def report(client):
    data = {${readingDict ? `${readingDict}, ` : ""}**controls}   # replace the readings with real ones
    body = json.dumps({"secret": DEVICE_SECRET, "data": data})
    client.publish(f"oark/devices/{DEVICE_ID}/telemetry", body, qos=1)


def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe(f"oark/devices/{DEVICE_ID}/commands", qos=1)


def on_message(client, userdata, message):
    # Oark sends {"desired": {...}}. Reporting the new values confirms them.
    desired = json.loads(message.payload).get("desired", {})
    controls.update({key: value for key, value in desired.items() if key in controls})
    apply()
    report(client)


client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=DEVICE_ID)
client.username_pw_set(DEVICE_ID, DEVICE_SECRET)
client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
client.on_connect = on_connect
client.on_message = on_message
client.connect("${MQTT_HOST}", ${MQTT_PORT})
client.loop_start()

while True:
    report(client)
    time.sleep(10)`;
}
