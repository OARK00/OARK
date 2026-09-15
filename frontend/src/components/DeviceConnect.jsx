import { useEffect, useState } from "react";
import api from "../api/client";
import { MQTT_HOST, MQTT_PORT } from "../constants/devices";
import { CheckIcon, CopyIcon } from "./icons";

const POLL_INTERVAL_MS = 3000;

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (permissions, non-HTTPS contexts) --
      // leave the button as-is rather than crash.
    }
  }

  return (
    <div className="copy-field">
      <span className="copy-field-label">{label}</span>
      <div className="copy-field-row">
        <code>{value}</code>
        <button type="button" className="copy-field-button" onClick={handleCopy} aria-label={`Copy ${label}`}>
          {copied ? CheckIcon : CopyIcon}
        </button>
      </div>
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
            Put these details on your device and power it on. This updates by itself.
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
        <div className="connect-status-text">Check the device's Wi-Fi, host, topic and secret, then check again.</div>
        <button type="button" className="ghost-button connect-status-retry" onClick={onRetry}>
          Check again
        </button>
      </div>
    </div>
  );
}

// `created` is the POST /devices response: the only time the secret is known.
export default function ConnectPanel({ created, watch }) {
  return (
    <>
      <ConnectionStatus device={watch.device} waiting={watch.waiting} onRetry={watch.retry} />

      <div className="connection-fields">
        <CopyField label="Device ID" value={created.id} />
        <CopyField label="Device secret" value={created.secret} />
        <CopyField label="MQTT host" value={MQTT_HOST} />
        <CopyField label="MQTT port" value={String(MQTT_PORT)} />
        <CopyField label="Publish topic" value={`oark/devices/${created.id}/telemetry`} />
      </div>

      <div className="connection-payload">
        <span className="copy-field-label">Payload format</span>
        <pre>{`{
  "secret": "<device secret>",
  "data": { "temperature": 24.5, "humidity": 61 }
}`}</pre>
      </div>
    </>
  );
}
