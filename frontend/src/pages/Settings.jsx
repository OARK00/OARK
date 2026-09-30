import { useEffect, useState } from "react";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import AppShell from "../components/AppShell";

// Mirrors the backend's rules (app/modules/auth/schemas.py) so the common
// mistakes are caught before a round trip; the server still decides.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function CompanyPanel() {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  const [canRename, setCanRename] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/orgs/me"), api.get("/auth/me")])
      .then(([org, me]) => {
        setName(org.data.name);
        setSaved(org.data.name);
        setCanRename(me.data.role === "owner" || me.data.role === "admin");
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load your company")))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setDone(false);
    setSaving(true);
    try {
      const { data } = await api.patch("/orgs/me", { name });
      setName(data.name);
      setSaved(data.name);
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, "Could not rename the company"));
    } finally {
      setSaving(false);
    }
  }

  const unchanged = name.trim() === saved;

  return (
    <section className="panel settings-panel">
      <div className="panel-header">
        <h2>Company</h2>
      </div>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <form className="settings-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Company name</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDone(false);
              }}
              maxLength={80}
              required
              disabled={!canRename}
            />
          </label>
          {!canRename && <p className="notice">Only an owner or admin can rename the company.</p>}
          {error && <div className="error">{error}</div>}
          {done && <div className="settings-saved">Saved.</div>}
          {canRename && (
            <div className="settings-actions">
              <button type="submit" className="primary-button" disabled={saving || unchanged || !name.trim()}>
                {saving ? "Saving..." : "Save name"}
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

function PasswordPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  function problem() {
    if (next.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (new TextEncoder().encode(next).length > MAX_PASSWORD_BYTES) {
      return `Use at most ${MAX_PASSWORD_BYTES} bytes (about ${MAX_PASSWORD_BYTES} plain characters).`;
    }
    if (next !== confirm) return "The two new passwords don't match.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setDone(false);
    const local = problem();
    if (local) {
      setError(local);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.post("/auth/password", { current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, "Could not change your password"));
    } finally {
      setSaving(false);
    }
  }

  const type = show ? "text" : "password";

  return (
    <section className="panel settings-panel">
      <div className="panel-header">
        <h2>Password</h2>
        <button type="button" className="link-button small" onClick={() => setShow((v) => !v)}>
          {show ? "Hide passwords" : "Show passwords"}
        </button>
      </div>
      <form className="settings-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Current password</span>
          <input
            type={type}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>New password</span>
          <input
            type={type}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </label>
        <label className="field">
          <span>Repeat new password</span>
          <input
            type={type}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        {error && <div className="error">{error}</div>}
        {done && <div className="settings-saved">Password changed. Use the new one next time you log in.</div>}
        <div className="settings-actions">
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Changing..." : "Change password"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function Settings() {
  return (
    <AppShell active="settings">
      <div className="page-head">
        <div>
          <h2>Settings</h2>
          <p className="page-head-note">Your company's name and your own password.</p>
        </div>
      </div>
      <div className="settings-grid">
        <CompanyPanel />
        <PasswordPanel />
      </div>
    </AppShell>
  );
}
