import { useEffect, useState } from "react";
import api from "../api/client";
import { MQTT_HOST, MQTT_PORT } from "../constants/devices";
import { CheckIcon, CopyIcon } from "./icons";

const POLL_INTERVAL_MS = 3000;

function useCopy(value) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (permissions, non-HTTPS contexts) --
      // leave the button as-is rather than crash.
    }
  }

  return { copied, copy };
}

function CopyField({ label, value, hint }) {
  const { copied, copy } = useCopy(value);

  return (
    <div className="copy-field">
      <span className="copy-field-label">{label}</span>
      <div className="copy-field-row">
        <code>{value}</code>
        <button type="button" className="copy-field-button" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? CheckIcon : CopyIcon}
        </button>
      </div>
      {hint && <span className="field-note">{hint}</span>}
    </div>
  );
}

function CodeBlock({ code, language }) {
  const { copied, copy } = useCopy(code);

  return (
    <div className="code-block">
      <div className="code-block-bar">
        <span className="code-block-language">{language}</span>
        <button type="button" className="code-block-copy" onClick={copy}>
          {copied ? CheckIcon : CopyIcon}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Decides, after each check, whether the Connect step should check again.
// `device` is the latest device from GET /devices/{id}, or null if that
// request failed. `startedAt` is when waiting began (a Date.now() timestamp).
function shouldKeepPolling(device, startedAt) {
  if (device?.last_seen_at) return false;
  if (Date.now() - startedAt > 10 * 60 * 1000) return false;
  return true;
}

// Watches a newly created device until its first message arrives.
export function useFirstMessage(deviceId) {
  const [device, setDevice] = useState(null);
  const [waiting, setWaiting] = useState(true);
  const [pollRun, setPollRun] = useState(0);

  useEffect(() => {
    if (!deviceId) return;
    const startedAt = Date.now();
    let cancelled = false;
    let timer;
    setWaiting(true);

    async function check() {
      let latest = null;
      try {
        const { data } = await api.get(`/devices/${deviceId}`);
        latest = data;
      } catch {
        // A failed check is handed to shouldKeepPolling as null.
      }
      if (cancelled) return;
      if (latest) setDevice(latest);
      if (shouldKeepPolling(latest, startedAt)) {
        timer = setTimeout(check, POLL_INTERVAL_MS);
      } else {
        setWaiting(false);
      }
    }

    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deviceId, pollRun]);

  return {
    device,
    waiting,
    connected: Boolean(device?.last_seen_at),
    retry: () => setPollRun((n) => n + 1),
  };
}

function ConnectionStatus({ device, waiting, onRetry }) {
  if (device?.last_seen_at) {
    const values = Object.entries(device.reported_state || {});
    return (
      <div className="connect-status connected" role="status">
        <span className="connect-status-dot" />
        <div>
          <div className="connect-status-title">First message received</div>
          <div className="connect-status-text">
            {new Date(device.last_seen_at).toLocaleTimeString()} · the device is connected and reporting.
          </div>
          {values.length > 0 && (
            <div className="connect-status-values">
              {values.map(([key, value]) => (
                <span key={key} className="connect-status-value">
                  {key} <b>{typeof value === "object" ? JSON.stringify(value) : String(value)}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="connect-status waiting" role="status">
        <span className="connect-status-dot" />
        <div>
          <div className="connect-status-title">Waiting for first message…</div>
          <div className="connect-status-text">
            Flash the sketch below and power the device on. This updates by itself.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="connect-status stopped" role="status">
      <span className="connect-status-dot" />
      <div>
        <div className="connect-status-title">No message yet</div>
        <div className="connect-status-text">Check the device's Wi-Fi and that the ID and secret were copied whole.</div>
        <button type="button" className="ghost-button connect-status-retry" onClick={onRetry}>
          Check again
        </button>
      </div>
    </div>
  );
}

function arduinoSketch(deviceId, secret) {
  return `#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>   // Library Manager: "PubSubClient" by Nick O'Leary

const char* WIFI_SSID     = "your-wifi-name";
const char* WIFI_PASSWORD = "your-wifi-password";

// From Oark. The secret is shown only once -- keep it in the device only.
const char* DEVICE_ID     = "${deviceId}";
const char* DEVICE_SECRET = "${secret}";

WiFiClientSecure net;
PubSubClient mqtt(net);

void connectOark() {
  mqtt.setServer("${MQTT_HOST}", ${MQTT_PORT});
  while (!mqtt.connected()) {
    Serial.print("Connecting to Oark... ");
    if (mqtt.connect(DEVICE_ID, DEVICE_ID, DEVICE_SECRET)) {
      Serial.println("connected");
    } else {
      Serial.println(mqtt.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  net.setInsecure();   // TLS without checking the broker's certificate
  connectOark();
}

void loop() {
  if (!mqtt.connected()) connectOark();
  mqtt.loop();

  float temperature = 24.5;   // replace with your sensor reading

  char topic[96];
  snprintf(topic, sizeof(topic), "oark/devices/%s/telemetry", DEVICE_ID);

  char payload[192];
  snprintf(payload, sizeof(payload),
           "{\\"secret\\":\\"%s\\",\\"data\\":{\\"temperature\\":%.1f}}",
           DEVICE_SECRET, temperature);

  mqtt.publish(topic, payload);
  delay(10000);   // every 10 seconds
}`;
}

function pythonSnippet(deviceId, secret) {
  return `import json, ssl, time
import paho.mqtt.client as mqtt   # pip install paho-mqtt

DEVICE_ID = "${deviceId}"
DEVICE_SECRET = "${secret}"

client = mqtt.Client(client_id=DEVICE_ID)
client.username_pw_set(DEVICE_ID, DEVICE_SECRET)
client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
client.connect("${MQTT_HOST}", ${MQTT_PORT})
client.loop_start()

while True:
    body = json.dumps({"secret": DEVICE_SECRET, "data": {"temperature": 24.5}})
    client.publish(f"oark/devices/{DEVICE_ID}/telemetry", body, qos=1)
    time.sleep(10)`;
}

const TABS = [
  { id: "esp32", label: "ESP32 / Arduino" },
  { id: "python", label: "Python" },
  { id: "manual", label: "Any MQTT client" },
];

// `created` holds the device's secret, which the API returns only when a
// device is created or its credentials are reset. `watch` is optional: the
// live status only makes sense for a device that hasn't reported yet.
export default function ConnectPanel({ created, watch }) {
  const [tab, setTab] = useState("esp32");

  return (
    <>
      {watch && <ConnectionStatus device={watch.device} waiting={watch.waiting} onRetry={watch.retry} />}

      <div className="connection-fields">
        <CopyField label="Device ID" value={created.id} />
        <CopyField
          label="Device secret"
          value={created.secret}
          hint="Shown only once. Anyone holding it can report as this device."
        />
      </div>

      <div className="setup-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`setup-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "esp32" && (
        <>
          <p className="setup-note">Paste into Arduino IDE, fill in your Wi-Fi, and upload. Everything else is filled in.</p>
          <CodeBlock language="Arduino C++" code={arduinoSketch(created.id, created.secret)} />
        </>
      )}

      {tab === "python" && (
        <>
          <p className="setup-note">For a Raspberry Pi, a gateway, or testing from a laptop.</p>
          <CodeBlock language="Python" code={pythonSnippet(created.id, created.secret)} />
        </>
      )}

      {tab === "manual" && (
        <>
          <p className="setup-note">Connection details for a client you write yourself.</p>
          <div className="connection-fields">
            <CopyField label="Host" value={MQTT_HOST} />
            <CopyField label="Port (TLS)" value={String(MQTT_PORT)} />
            <CopyField label="Username" value={created.id} hint="The device ID is the username." />
            <CopyField label="Password" value={created.secret} />
            <CopyField label="Publish topic" value={`oark/devices/${created.id}/telemetry`} />
          </div>
          <div className="connection-payload">
            <span className="copy-field-label">Message body</span>
            <pre>{`{
  "secret": "<device secret>",
  "data": { "temperature": 24.5, "humidity": 61 }
}`}</pre>
          </div>
        </>
      )}
    </>
  );
}
