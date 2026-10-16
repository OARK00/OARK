import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import AlertRuleModal from "./AlertRuleModal";

function conditionText(rule) {
  if (rule.condition === "no_data") return `No data for ${rule.for_minutes} min`;
  return `${rule.data_key} ${rule.condition} ${rule.threshold}`;
}

function scopeText(rule) {
  if (rule.device_id) return rule.device_name || "One device";
  if (rule.product_id) return "Every device of this product";
  return "All devices";
}

// The product page's Alerts tab: rules for the product, for one of its
// devices, or for everyone; and what fired on its devices.
export default function ProductAlerts({ product, devices }) {
  const [rules, setRules] = useState(null);
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const deviceIds = devices.map((d) => d.id).join(",");

  const load = useCallback(() => {
    const ids = new Set(deviceIds ? deviceIds.split(",") : []);
    return Promise.all([api.get("/alerts/rules"), api.get("/alerts/events", { params: { limit: 200 } })]).then(
      ([rulesRes, eventsRes]) => ({
        rules: rulesRes.data.filter(
          (rule) => rule.product_id === product.id || ids.has(rule.device_id) || (!rule.product_id && !rule.device_id)
        ),
        events: eventsRes.data.filter((event) => ids.has(event.device_id)),
      })
    );
  }, [product.id, deviceIds]);

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

  if (error) return <div className="error">{error}</div>;
  if (!rules || !events) return <p className="muted">Loading alerts…</p>;

  return (
    <div className="tab-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Rules for {product.name}</h2>
            <p className="panel-subtitle">Rules for this product, for one of its devices, and for all devices.</p>
          </div>
          <button type="button" className="primary-button" onClick={() => setCreating(true)}>
            + New rule
          </button>
        </div>
        {rules.length === 0 ? (
          <p className="muted">No rule watches this product yet.</p>
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
        <h2>Alerts from its devices</h2>
        <p className="panel-subtitle">From the newest 200 alerts of your company.</p>
        {events.length === 0 ? (
          <p className="muted">Nothing has fired for these devices.</p>
        ) : (
          <ul className="tab-list">
            {events.map((event) => (
              <li key={event.id}>
                <span className="muted">{new Date(event.triggered_at).toLocaleString()}</span>
                <b>{event.device_name}</b>
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
            load().then(show, fail);
          }}
        />
      )}
    </div>
  );
}
