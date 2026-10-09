import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";

// Mirrors the backend's COMMAND_TTL: how long a command waits for its device.
const WAIT_MINUTES = 5;
// How long "confirmed" / "not confirmed" stays next to a control.
const OUTCOME_VISIBLE_MS = 60 * 1000;

function formatCommandValue(value, point) {
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") return point?.unit ? `${value} ${point.unit}` : String(value);
  if (value === undefined || value === null) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function recent(iso) {
  return iso && Date.now() - new Date(iso).getTime() < OUTCOME_VISIBLE_MS;
}

function ControlNote({ command, error, isButtons }) {
  if (error) return <p className="control-note control-note-error">{error}</p>;
  if (!command) return null;

  if (command.status === "pending") {
    let text = "Sent · waiting for the device to confirm";
    if (!command.delivered_at) {
      // A button press is never kept for later (it would move the car by
      // itself), so don't promise that it will arrive.
      text = isButtons
        ? "Device isn't connected · this press will be dropped"
        : `Device isn't listening right now · it gets this if it's back within ${WAIT_MINUTES} min`;
    }
    return (
      <p className="control-note control-note-pending">
        <span className="control-spinner" aria-hidden="true" />
        {text}
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

// Values that name a direction are laid out as a pad; anything else becomes
// a plain row of buttons, so the same widget serves a car or a garage door.
const PAD_SLOTS = {
  forward: "up",
  up: "up",
  reverse: "down",
  back: "down",
  backward: "down",
  down: "down",
  left: "left",
  right: "right",
  stop: "center",
};
const PAD_ORDER = [null, "up", null, "left", "center", "right", null, "down", null];
const SLOT_ARROWS = { up: "▲", down: "▼", left: "◀", right: "▶", center: "■" };

function buttonLabel(value) {
  const text = value.replace(/[_-]+/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ButtonsControl({ point, reported, onSend }) {
  const release = point.release_value;
  const [held, setHeld] = useState(null);
  const heldRef = useRef(null);

  function press(value) {
    if (heldRef.current !== null) return;
    // Pressing the release button itself (stop) is a plain tap.
    if (release && value !== release) {
      heldRef.current = value;
      setHeld(value);
    }
    onSend(value);
  }

  const letGo = useCallback(() => {
    if (heldRef.current === null) return;
    heldRef.current = null;
    setHeld(null);
    onSend(release);
  }, [onSend, release]);

  // Switching tab or window mid-press never delivers the pointer's "up",
  // which would leave the car driving: losing focus counts as letting go.
  useEffect(() => {
    window.addEventListener("blur", letGo);
    document.addEventListener("visibilitychange", letGo);
    return () => {
      window.removeEventListener("blur", letGo);
      document.removeEventListener("visibilitychange", letGo);
    };
  }, [letGo]);

  function renderButton(value, slot) {
    const active = held === value || (held === null && reported === value && value !== release);
    return (
      <button
        key={value}
        type="button"
        className={`pad-button${active ? " active" : ""}${slot ? ` pad-${slot}` : ""}`}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          // Keeps the "up" coming to this button even if the finger slides
          // off. It throws when the browser already considers that pointer
          // gone; the press itself must still go out.
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // no capture: pointerup / pointercancel / blur still end the hold
          }
          press(value);
        }}
        onPointerUp={letGo}
        onPointerCancel={letGo}
        onLostPointerCapture={letGo}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault();
            press(value);
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") letGo();
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        {slot && <span aria-hidden="true">{SLOT_ARROWS[slot]}</span>}
        {buttonLabel(value)}
      </button>
    );
  }

  const slots = {};
  const rest = [];
  point.options.forEach((value) => {
    const slot = PAD_SLOTS[value.toLowerCase()];
    if (slot && !slots[slot]) slots[slot] = value;
    else rest.push(value);
  });
  const isPad = ["up", "down", "left", "right"].filter((slot) => slots[slot]).length >= 2;

  return (
    <div className="buttons-control">
      {isPad ? (
        <div className="pad-grid">
          {PAD_ORDER.map((slot, index) =>
            slot && slots[slot] ? renderButton(slots[slot], slot) : <span key={`gap-${index}`} />
          )}
        </div>
      ) : null}
      {(isPad ? rest : point.options).length > 0 && (
        <div className="button-row">{(isPad ? rest : point.options).map((value) => renderButton(value, null))}</div>
      )}
      <p className="buttons-hint">
        {release ? `Hold a button to keep it going. Letting go sends "${release}".` : "Each tap sends once."}
      </p>
    </div>
  );
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

  // Button presses leave strictly one after another: if "stop" could
  // overtake the "forward" it is meant to end, the car would stop and then
  // drive off. Each waits for the previous request to finish, but not for
  // the page to refresh, so letting go reaches the car as soon as possible.
  const queues = useRef({});
  function sendInOrder(point, value) {
    const previous = queues.current[point.key] || Promise.resolve();
    queues.current[point.key] = previous
      .then(() => api.post(`/devices/${device.id}/commands`, { key: point.key, value }))
      .then(() => {
        setErrors((current) => ({ ...current, [point.key]: null }));
        onChange();
      })
      .catch((err) => {
        setErrors((current) => ({ ...current, [point.key]: getErrorMessage(err, "Could not send that command") }));
      });
  }

  return (
    <div className="activity-card controls-card">
      <div className="card-head">
        <h3>Controls</h3>
        <span className="card-head-note">A change counts once the device reports it</span>
      </div>

      {device.status !== "online" && (
        <p className="controls-offline">
          This device is {device.status}.{" "}
          {points.some((point) => point.widget === "buttons")
            ? `Settings wait up to ${WAIT_MINUTES} minutes for it to come back; button presses are dropped after a few seconds, so nothing moves by itself later.`
            : `Commands wait up to ${WAIT_MINUTES} minutes for it to come back, then they're dropped so nothing switches unexpectedly later.`}
        </p>
      )}

      <ul className="control-list">
        {points.map((point) => {
          // Commands arrive newest first, so the first match is the latest.
          const latest = commands.find((command) => command.key === point.key);
          const pending = latest?.status === "pending" ? latest : null;
          const isButtons = point.widget === "buttons" && point.options?.length > 0;
          return (
            <li key={point.key} className={`control-row${isButtons ? " control-row-stacked" : ""}`}>
              <div className="control-label">
                <span className="control-name">{point.label}</span>
                <span className="control-current">
                  Now <b>{formatCommandValue(reported[point.key], point)}</b>
                  {pending && point.type !== "boolean" && !isButtons && (
                    <> → {formatCommandValue(pending.value, point)}</>
                  )}
                </span>
              </div>
              <div className="control-action">
                {isButtons ? (
                  <ButtonsControl
                    point={point}
                    reported={reported[point.key]}
                    onSend={(value) => sendInOrder(point, value)}
                  />
                ) : point.type === "boolean" ? (
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
              <ControlNote command={latest} error={errors[point.key]} isButtons={isButtons} />
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
