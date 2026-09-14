import { useEffect, useState } from "react";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import { CATEGORY_OPTIONS, MQTT_HOST, MQTT_PORT } from "../constants/devices";
import { CheckIcon, CopyIcon } from "./icons";

const STEPS = ["Basic info", "Technical details", "Connect"];
const POLL_INTERVAL_MS = 3000;

const EMPTY_FORM = {
  name: "",
  category: "sensor",
  description: "",
  modelNumber: "",
  firmwareVersion: "",
};

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
                  {key} <b>{String(value)}</b>
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
        <div className="connect-status-text">
          Check the device's Wi-Fi, host, topic and secret, then check again.
        </div>
        <button type="button" className="ghost-button connect-status-retry" onClick={onRetry}>
          Check again
        </button>
      </div>
    </div>
  );
}

export default function AddDeviceWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [device, setDevice] = useState(null);
  const [waiting, setWaiting] = useState(true);
  const [pollRun, setPollRun] = useState(0);

  function update(field) {
    return (e) => setForm((current) => ({ ...current, [field]: e.target.value }));
  }

  async function createDevice(e) {
    e.preventDefault();
    if (creating) return;
    setError(null);
    setCreating(true);
    try {
      const { data } = await api.post("/devices", {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || null,
        model_number: form.modelNumber.trim() || null,
        firmware_version: form.firmwareVersion.trim() || null,
      });
      setCreated(data);
      setStep(2);
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create device"));
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!created) return;
    const startedAt = Date.now();
    let cancelled = false;
    let timer;
    setWaiting(true);

    async function check() {
      let latest = null;
      try {
        const { data } = await api.get(`/devices/${created.id}`);
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
  }, [created, pollRun]);

  const onConnectStep = step === 2;

  return (
    <div className="modal-overlay" onClick={() => !creating && !onConnectStep && onClose()}>
      <div
        className="modal-card wizard-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        onClick={(e) => e.stopPropagation()}
      >
        <ol className="wizard-steps">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`wizard-step ${i === step ? "current" : ""} ${i < step ? "done" : ""}`}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="wizard-step-bar" />
              <span className="wizard-step-label">
                {i < step ? CheckIcon : <span className="wizard-step-num">{i + 1}</span>}
                {label}
              </span>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep(1);
            }}
          >
            <h3 id="wizard-title">Add device</h3>
            <p>What is this device, and where does it live?</p>
            <div className="add-device-form">
              <label className="field">
                Name
                <input
                  type="text"
                  placeholder="e.g. Warehouse Temp Sensor"
                  value={form.name}
                  onChange={update("name")}
                  required
                  autoFocus
                />
              </label>
              <label className="field">
                Category
                <select value={form.category} onChange={update("category")}>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>
                  Description <span className="field-hint">(optional)</span>
                </span>
                <textarea
                  placeholder="e.g. Ceiling mount, west corner of warehouse B"
                  value={form.description}
                  onChange={update("description")}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="primary-button">
                Next
              </button>
            </div>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={createDevice}>
            <h3 id="wizard-title">Technical details</h3>
            <p>Both are optional, but they help you tell hardware revisions apart later.</p>
            <div className="add-device-form">
              <div className="field-row">
                <label className="field">
                  Model number
                  <input
                    type="text"
                    placeholder="e.g. ESP32-DevKitC"
                    value={form.modelNumber}
                    onChange={update("modelNumber")}
                    autoFocus
                  />
                </label>
                <label className="field">
                  Firmware version
                  <input
                    type="text"
                    placeholder="e.g. 1.0.0"
                    value={form.firmwareVersion}
                    onChange={update("firmwareVersion")}
                  />
                </label>
              </div>
              <div className="field">
                Connection
                <div className="field-static">
                  MQTT over TLS
                  <span className="field-static-note">
                    {MQTT_HOST}:{MQTT_PORT}
                  </span>
                </div>
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setStep(0)} disabled={creating}>
                Back
              </button>
              <button type="submit" className="primary-button" disabled={creating}>
                {creating ? "Creating..." : "Create device"}
              </button>
            </div>
          </form>
        )}

        {onConnectStep && created && (
          <>
            <h3 id="wizard-title">Connect &ldquo;{created.name}&rdquo;</h3>
            <p>Configure your device with these details. The secret is shown only once — save it now.</p>

            <ConnectionStatus device={device} waiting={waiting} onRetry={() => setPollRun((n) => n + 1)} />

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

            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
