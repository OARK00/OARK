import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import AlertRuleModal from "./AlertRuleModal";

function conditionText(rule) {
  if (rule.condition === "no_data") return `No data for ${rule.for_minutes} min`;
  return `${rule.data_key} ${rule.condition} ${rule.threshold}`;
}

// The same order the alert engine uses: one device, else its product, else everyone.
function scopeText(rule) {
  if (rule.device_id) return "This device";
  if (rule.product_id) return `Every ${rule.product_name || "device of this product"}`;
  return "All devices";
}

// A rule applies to this device when it names it, names its product, or names nobody.
function appliesTo(rule, device) {
  if (rule.device_id) return rule.device_id === device.id;
  if (rule.product_id) return rule.product_id === device.product_id;
  return true;
}

// The device page's Alerts tab: the rules that watch this device, and what
// they found. Rules are created and edited on the Alerts page as before.
export default function DeviceAlerts({ device }) {
  const [rules, setRules] = useState(null);
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  // Runs again whenever the page refreshes the device, so this tab stays as
  // current as the rest of the page.
  const load = useCallback(
    () =>
      Promise.all([
        api.get("/alerts/rules"),
        api.get("/alerts/events", { params: { device_id: device.id, limit: 50 } }),
      ]).then(([rulesRes, eventsRes]) => ({
        rules: rulesRes.data.filter((rule) => appliesTo(rule, device)),
        events: eventsRes.data,
      })),
    [device]
  );

  function show(data) {
    setRules(data.rules);
    setEvents(data.events);
    setError(null);
  }

  function fail(err) {
    setError(getErrorMessage(err, "Could not load the alerts"));
  }

  useEffect(() => {
    let active = true;
    load().then(
      (data) => active && show(data),
      (err) => active && fail(err)
    );
    return () => {
      active = false;
    };
  }, [load]);

  function reload() {
    load().then(show, fail);
  }

  if (error) return <div className="error">{error}</div>;
  if (!rules || !events) return <p className="muted">Loading alerts…</p>;

  return (
    <div className="tab-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Rules watching this device</h2>
            <p className="panel-subtitle">Rules for this device, for its product, and for all devices.</p>
          </div>
          <button type="button" className="primary-button" onClick={() => setCreating(true)}>
            + New rule
          </button>
        </div>
        {rules.length === 0 ? (
          <p className="muted">No rule watches this device yet.</p>
        ) : (
          <ul className="tab-list">
            {rules.map((rule) => (
              <li key={rule.id}>
                <b>{rule.name}</b>
                <span>{conditionText(rule)}</span>
                <span className="muted">{scopeText(rule)}</span>
                {!rule.enabled && <span className="soon-badge">Off</span>}
              </li>
            ))}
          </ul>
        )}
        <Link to="/alerts" className="link-button">
          Manage all rules on the Alerts page →
        </Link>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Alerts from this device</h2>
            <p className="panel-subtitle">The newest 50.</p>
          </div>
        </div>
        {events.length === 0 ? (
          <p className="muted">Nothing has fired for this device.</p>
        ) : (
          <ul className="tab-list">
            {events.map((event) => (
              <li key={event.id}>
                <span className="muted">{new Date(event.triggered_at).toLocaleString()}</span>
                <b>{event.rule_name}</b>
                <span>{event.message}</span>
                {!event.acknowledged_at && <span className="soon-badge">New</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {creating && (
        <AlertRuleModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
