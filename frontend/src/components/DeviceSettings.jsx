import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import ConnectPanel from "./DeviceConnect";

// The device page's Settings tab: its ID, a new secret, and deleting it.
// The same actions as the icons in the Devices table.
export default function DeviceSettings({ device }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(null); // "reset" | "delete"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [newCredentials, setNewCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(device.id);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function resetCredentials() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post(`/devices/${device.id}/credentials`);
      setConfirm(null);
      setNewCredentials(data);
    } catch (err) {
      setError(getErrorMessage(err, "Could not reset credentials"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteDevice() {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/devices/${device.id}`);
      navigate("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, "Could not delete device"));
      setBusy(false);
    }
  }

  return (
    <div className="tab-stack">
      <section className="panel">
        <h2>Device ID</h2>
        <p className="panel-subtitle">Goes into the firmware as DEVICE_ID.</p>
        <div className="settings-row">
          <code className="meta-mono">{device.id}</code>
          <button type="button" className="ghost-button" onClick={copyId}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Device secret</h2>
        <p className="panel-subtitle">
          Oark shows a secret only once. If it was lost or shared, make a new one: the old one stops working at once, so
          the board disconnects until its firmware has the new secret.
        </p>
        <button type="button" className="ghost-button" onClick={() => setConfirm("reset")}>
          Reset credentials
        </button>
      </section>

      <section className="panel settings-danger">
        <h2>Delete device</h2>
        <p className="panel-subtitle">Removes {device.name}, its history and its secret. This can't be undone.</p>
        <button type="button" className="danger-button" onClick={() => setConfirm("delete")}>
          Delete device
        </button>
      </section>

      {confirm && (
        <div className="modal-overlay" onClick={() => !busy && setConfirm(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{confirm === "reset" ? "Reset credentials?" : "Delete device?"}</h3>
            <p>
              {confirm === "reset" ? (
                <>
                  <strong>{device.name}</strong> gets a new secret. The current one stops working immediately.
                </>
              ) : (
                <>
                  <strong>{device.name}</strong> will be permanently removed and its secret revoked.
                </>
              )}
            </p>
            {error && <div className="error modal-error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setConfirm(null)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={confirm === "reset" ? resetCredentials : deleteDevice}
                disabled={busy}
              >
                {busy ? "Working…" : confirm === "reset" ? "Reset credentials" : "Delete device"}
              </button>
            </div>
          </div>
        </div>
      )}

      {newCredentials && (
        <div className="modal-overlay">
          <div className="modal-card wizard-card" role="dialog" aria-modal="true" aria-labelledby="new-creds-title">
            <h3 id="new-creds-title">New credentials for &ldquo;{newCredentials.name}&rdquo;</h3>
            <p>Put these on the board. The secret is shown only once — save it now.</p>
            <ConnectPanel created={newCredentials} />
            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={() => setNewCredentials(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
