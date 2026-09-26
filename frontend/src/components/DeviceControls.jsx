import { useState } from "react";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";

// Mirrors the backend's COMMAND_TTL: how long a command waits for its device.
const WAIT_MINUTES = 5;
// How long "confirmed" / "not confirmed" stays next to a control.
const OUTCOME_VISIBLE_MS = 60 * 1000;

export function formatCommandValue(value, point) {
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") return point?.unit ? `${value} ${point.unit}` : String(value);
  if (value === undefined || value === null) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function recent(iso) {
  return iso && Date.now() - new Date(iso).getTime() < OUTCOME_VISIBLE_MS;
}

function ControlNote({ command, error }) {
  if (error) return <p className="control-note control-note-error">{error}</p>;
  if (!command) return null;

  if (command.status === "pending") {
    return (
      <p className="control-note control-note-pending">
        <span className="control-spinner" aria-hidden="true" />
        {command.delivered_at
          ? "Sent · waiting for the device to confirm"
          : `Device isn't listening right now · it gets this if it's back within ${WAIT_MINUTES} min`}
      </p>
    );
  }
  if (command.status === "applied" && recent(command.resolved_at)) {
    return <p className="control-note control-note-ok">Confirmed by the device</p>;
  }
  if (command.status === "expired" && recent(command.resolved_at || command.expires_at)) {
    return (
      <p className="control-note control-note-error">
        Not confirmed in time. The device may be offline, or its firmware doesn't handle commands yet.
      </p>
    );
  }
  return null;
}

function BooleanControl({ point, reported, pending, busy, onSend }) {
  // While a command is on its way, the switch shows where it is going.
  const on = pending ? pending.value === true : reported === true;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={point.label}
      className={`toggle control-toggle${on ? " on" : ""}${pending ? " pending" : ""}`}
      disabled={busy}
      onClick={() => onSend(!on)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

function ValueControl({ point, busy, onSend }) {
  const [text, setText] = useState("");
  const isNumber = point.type === "number";

  function submit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    onSend(isNumber ? Number(text) : text);
    setText("");
  }

  return (
    <form className="control-input" onSubmit={submit}>
      <input
        type={isNumber ? "number" : "text"}
        step="any"
        min={point.min ?? undefined}
        max={point.max ?? undefined}
        maxLength={isNumber ? undefined : 64}
        value={text}
        placeholder={isNumber && point.min != null && point.max != null ? `${point.min}–${point.max}` : "New value"}
        onChange={(event) => setText(event.target.value)}
        aria-label={`New ${point.label}`}
      />
      {isNumber && point.unit && <span className="control-unit">{point.unit}</span>}
      <button type="submit" className="ghost-button" disabled={busy || !text.trim()}>
        Set
      </button>
    </form>
  );
}

export default function DeviceControls({ device, points, commands, onChange }) {
  const [busyKey, setBusyKey] = useState(null);
  const [errors, setErrors] = useState({});
  const reported = device.reported_state || {};

  async function send(point, value) {
    setBusyKey(point.key);
    setErrors((current) => ({ ...current, [point.key]: null }));
    try {
      await api.post(`/devices/${device.id}/commands`, { key: point.key, value });
      await onChange();
    } catch (err) {
      setErrors((current) => ({ ...current, [point.key]: getErrorMessage(err, "Could not send that command") }));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="activity-card controls-card">
      <div className="card-head">
        <h3>Controls</h3>
        <span className="card-head-note">A change counts once the device reports it</span>
      </div>

      {device.status !== "online" && (
        <p className="controls-offline">
          This device is {device.status}. Commands wait up to {WAIT_MINUTES} minutes for it to come back, then they're
          dropped so nothing switches unexpectedly later.
        </p>
      )}

      <ul className="control-list">
        {points.map((point) => {
          // Commands arrive newest first, so the first match is the latest.
          const latest = commands.find((command) => command.key === point.key);
          const pending = latest?.status === "pending" ? latest : null;
          return (
            <li key={point.key} className="control-row">
              <div className="control-label">
                <span className="control-name">{point.label}</span>
                <span className="control-current">
                  Now <b>{formatCommandValue(reported[point.key], point)}</b>
                  {pending && point.type !== "boolean" && (
                    <> → {formatCommandValue(pending.value, point)}</>
                  )}
                </span>
              </div>
              <div className="control-action">
                {point.type === "boolean" ? (
                  <BooleanControl
                    point={point}
                    reported={reported[point.key]}
                    pending={pending}
                    busy={busyKey === point.key}
                    onSend={(value) => send(point, value)}
                  />
                ) : (
                  <ValueControl point={point} busy={busyKey === point.key} onSend={(value) => send(point, value)} />
                )}
              </div>
              <ControlNote command={latest} error={errors[point.key]} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const STATUS_LABELS = {
  pending: "Waiting",
  applied: "Confirmed",
  expired: "Not confirmed",
  superseded: "Replaced",
};

export function CommandHistory({ commands, points }) {
  const byKey = Object.fromEntries(points.map((point) => [point.key, point]));
  return (
    <div className="activity-card">
      <div className="card-head">
        <h3>Command history</h3>
        <span className="card-head-note">Who changed what, and whether the device did it</span>
      </div>
      {commands.length === 0 ? (
        <p className="activity-empty">No commands sent to this device yet.</p>
      ) : (
        <ul className="activity-list">
          {commands.map((command) => (
            <li key={command.id} className="command-row">
              <span className="reading-time">
                {new Date(command.created_at).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="command-what">
                {byKey[command.key]?.label || command.key} →{" "}
                <b>{formatCommandValue(command.value, byKey[command.key])}</b>
              </span>
              <span className={`command-status command-status-${command.status}`}>
                {STATUS_LABELS[command.status] || command.status}
              </span>
              <span className="command-who">{command.sent_by || "removed user"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
