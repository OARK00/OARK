import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import AppShell from "../components/AppShell";
import AlertRuleModal from "../components/AlertRuleModal";
import { TrashIcon } from "../components/icons";

const REFRESH_MS = 30000;

function describe(rule) {
  if (rule.condition === "no_data") return `No data for ${rule.for_minutes} min`;
  const word = rule.condition === "above" ? "above" : "below";
  return `${rule.data_key} ${word} ${rule.threshold}`;
}

function scopeOf(rule) {
  if (rule.device_name) return rule.device_name;
  if (rule.product_name) return `All ${rule.product_name}`;
  return "Every device";
}

function when(iso) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Alerts() {
  const [tab, setTab] = useState("history");
  const [rules, setRules] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [rulesResponse, eventsResponse] = await Promise.all([
        api.get("/alerts/rules"),
        api.get("/alerts/events", { params: { limit: 100 } }),
      ]);
      setRules(rulesResponse.data);
      setEvents(eventsResponse.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load alerts"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  async function toggleRule(rule) {
    await api.patch(`/alerts/rules/${rule.id}`, { enabled: !rule.enabled });
    load();
  }

  async function deleteRule(rule) {
    await api.delete(`/alerts/rules/${rule.id}`);
    load();
  }

  async function acknowledgeAll() {
    await api.post("/alerts/events/acknowledge");
    load();
  }

  const unseen = events.filter((event) => !event.acknowledged_at).length;

  return (
    <AppShell active="alerts">
      <div className="page-head">
        <div>
          <h2>Alerts</h2>
          <p className="page-head-note">
            Rules watch your data as it arrives. Silence is checked once a minute.
          </p>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          + New rule
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="console-card">
        <div className="console-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "history"}
            className={`console-tab${tab === "history" ? " active" : ""}`}
            onClick={() => setTab("history")}
          >
            History
            {unseen > 0 && <span className="unseen-badge">{unseen}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "rules"}
            className={`console-tab${tab === "rules" ? " active" : ""}`}
            onClick={() => setTab("rules")}
          >
            Rules <span className="console-tab-count">{rules.length}</span>
          </button>
        </div>

        <div className="console-body">
          {tab === "history" && (
            <>
              {unseen > 0 && (
                <div className="console-head">
                  <span className="muted">
                    {unseen} new since you last looked
                  </span>
                  <button type="button" className="ghost-button" onClick={acknowledgeAll}>
                    Mark all as seen
                  </button>
                </div>
              )}

              {loading ? (
                <p className="muted">Loading…</p>
              ) : events.length === 0 ? (
                <div className="empty-state">
                  <h3>Nothing has gone wrong</h3>
                  <p>
                    When a rule fires it lands here, with the device, the value and the time. Rules are
                    checked on every reading, so this is the first place a problem shows up.
                  </p>
                  {rules.length === 0 && (
                    <button className="primary-button" onClick={() => setCreating(true)}>
                      + Create your first rule
                    </button>
                  )}
                </div>
              ) : (
                <ul className="activity-list">
                  {events.map((event) => (
                    <li key={event.id} className={`alert-row${event.acknowledged_at ? "" : " unseen"}`}>
                      <span className="alert-time">{when(event.triggered_at)}</span>
                      <Link to={`/devices/${event.device_id}`} className="alert-device">
                        {event.device_name}
                      </Link>
                      <span className="alert-message">{event.message}</span>
                      <span className="alert-rule">{event.rule_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "rules" && (
            <>
              {rules.length === 0 ? (
                <div className="empty-state">
                  <h3>No rules yet</h3>
                  <p>
                    A rule is one sentence: a field, a limit, and which devices it applies to. Start with the
                    thing that would cost you money if nobody noticed.
                  </p>
                  <button className="primary-button" onClick={() => setCreating(true)}>
                    + Create your first rule
                  </button>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rule</th>
                        <th>Condition</th>
                        <th>Applies to</th>
                        <th>Quiet for</th>
                        <th>Enabled</th>
                        <th className="cell-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => (
                        <tr key={rule.id}>
                          <td className="cell-device-name">{rule.name}</td>
                          <td>
                            <code className="rule-condition">{describe(rule)}</code>
                          </td>
                          <td>{scopeOf(rule)}</td>
                          <td className="cell-muted">{rule.cooldown_minutes} min</td>
                          <td>
                            <button
                              type="button"
                              className={`toggle${rule.enabled ? " on" : ""}`}
                              role="switch"
                              aria-checked={rule.enabled}
                              aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                              onClick={() => toggleRule(rule)}
                            >
                              <span className="toggle-knob" />
                            </button>
                          </td>
                          <td className="cell-actions">
                            <div className="row-actions">
                              <button
                                type="button"
                                className="row-action danger"
                                title="Delete rule"
                                aria-label={`Delete ${rule.name}`}
                                onClick={() => deleteRule(rule)}
                              >
                                {TrashIcon}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {creating && <AlertRuleModal onClose={() => setCreating(false)} onCreated={load} />}
    </AppShell>
  );
}
