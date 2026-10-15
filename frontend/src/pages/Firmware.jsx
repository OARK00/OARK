import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import AppShell from "../components/AppShell";
import CodeEditor from "../components/CodeEditor";
import { arduinoSketch } from "../components/firmwareSnippets";
import CompilePanel from "../components/CompilePanel";
import PinPanel from "../components/PinPanel";
import SerialMonitor from "../components/SerialMonitor";
import "./Firmware.css";

// Shown where a real value goes. The secret is never filled in here: Oark
// shows it once, when the device is created, and does not keep a readable copy.
const ID_PLACEHOLDER = "your-device-id";
const SECRET_PLACEHOLDER = "your-device-secret";

const ID_LINE = /(DEVICE_ID\s*=\s*")[^"\n]*(")/;

function withDeviceId(code, deviceId) {
  return code.replace(ID_LINE, `$1${deviceId || ID_PLACEHOLDER}$2`);
}

function deviceIdIn(code) {
  const found = code.match(/DEVICE_ID\s*=\s*"([^"\n]*)"/);
  return found && found[1] !== ID_PLACEHOLDER ? found[1] : "";
}

function fileName(productName) {
  const safe = productName.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${safe || "oark_device"}.ino`;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Firmware() {
  const { productId } = useParams();
  // Opened from a device's page: start with that device chosen.
  const fromDevice = useSearchParams()[0].get("device");
  const [product, setProduct] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loadError, setLoadError] = useState(null);
  // What is stored on Oark: null when nothing was saved yet.
  const [saved, setSaved] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get(`/products/${productId}`),
      api.get("/devices", { params: { product_id: productId } }),
      api.get(`/products/${productId}/sketch`),
    ]).then(
      ([productRes, devicesRes, sketchRes]) => {
        if (!active) return;
        setProduct(productRes.data);
        setDevices(devicesRes.data);
        setSaved(sketchRes.data.code);
        const opened = sketchRes.data.code ?? arduinoSketch(ID_PLACEHOLDER, SECRET_PLACEHOLDER, productRes.data.data_points);
        // Only a device of this product: the address bar is not trusted.
        const device = devicesRes.data.find((d) => d.id === fromDevice);
        setCode(device ? withDeviceId(opened, device.id) : opened);
      },
      (err) => active && setLoadError(getErrorMessage(err, "Could not load this product's firmware"))
    );
    return () => {
      active = false;
    };
  }, [productId, fromDevice]);

  if (loadError) {
    return (
      <AppShell active="products">
        <section className="panel">
          <div className="error">{loadError}</div>
          <Link to="/products" className="link-button">
            ← Back to products
          </Link>
        </section>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell active="products">
        <p className="muted">Loading firmware…</p>
      </AppShell>
    );
  }

  const points = product.data_points;
  const generated = arduinoSketch(ID_PLACEHOLDER, SECRET_PLACEHOLDER, points);
  // Compared without the device ID: choosing a device is not an edit.
  const baseline = withDeviceId(saved ?? generated, "");
  const edited = withDeviceId(code, "") !== baseline;
  const chosenDevice = deviceIdIn(code);

  function say(message) {
    setError(null);
    setNotice(message);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      say("Copied.");
    } catch {
      setError("Could not copy. Select the code and copy it by hand.");
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.put(`/products/${productId}/sketch`, { code });
      setSaved(data.code);
      // The server takes a pasted secret out: show what was really stored.
      setCode(data.code);
      say("Saved.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not save the code"));
    } finally {
      setBusy(false);
    }
  }

  async function savePins(newPoints) {
    setError(null);
    try {
      const { data } = await api.put(`/products/${productId}/data-points`, { data_points: newPoints });
      setProduct(data);
      if (saved === null && !edited) {
        // Showing the generated code: rebuild it with the new wiring.
        setCode(withDeviceId(arduinoSketch(ID_PLACEHOLDER, SECRET_PLACEHOLDER, data.data_points), chosenDevice));
        say("Pins saved. The code now uses them.");
      } else {
        say("Pins saved. Your own code was not changed: choose Reset to generated code to use the new pins.");
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not save the pins"));
    }
  }

  async function reset() {
    if (!window.confirm("Replace this code with the code Oark generates from the data points?")) return;
    setBusy(true);
    setError(null);
    try {
      if (saved !== null) await api.delete(`/products/${productId}/sketch`);
      setSaved(null);
      setCode(withDeviceId(generated, chosenDevice));
      say("Back to the generated code.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not reset the code"));
    } finally {
      setBusy(false);
    }
  }

  const readings = points.filter((p) => p.access !== "write").length;
  const controls = points.length - readings;

  return (
    <AppShell active="firmware" firmwareTo={`/products/${productId}/firmware`}>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/products">Products</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/products/${productId}`}>{product.name}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Firmware</span>
      </nav>

      <section className="panel fw-studio">
        <header className="fw-header">
          <div className="fw-title">
            <h1>Firmware</h1>
            <p>
              ESP32 code for every {product.name}. Oark writes the connection part; you add your sensor readings.
            </p>
          </div>
          <div className="fw-counts">
            <span>
              <b>{readings}</b> {readings === 1 ? "reading" : "readings"}
            </span>
            <span>
              <b>{controls}</b> {controls === 1 ? "control" : "controls"}
            </span>
          </div>
          <div className="fw-actions">
            <label className="fw-device">
              <span>Device</span>
              <select value={chosenDevice} onChange={(e) => setCode(withDeviceId(code, e.target.value))}>
                <option value="">Not chosen</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="ghost-button" onClick={copy}>
              Copy
            </button>
            <button type="button" className="ghost-button" onClick={() => download(fileName(product.name), code)}>
              Download .ino
            </button>
            <button type="button" className="primary-button fw-save" onClick={save} disabled={busy || !edited}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </header>

        <p className="fw-info">
          Choosing a device fills in its ID. The device secret is never kept here: paste it in place of{" "}
          <code>{SECRET_PLACEHOLDER}</code> after you download the code.
        </p>

        {(error || notice) && (
          <div className={error ? "error" : "fw-notice"} role="status">
            {error || notice}
          </div>
        )}

        <div className="fw-body">
          <CodeEditor value={code} onChange={setCode} label={`Firmware code for ${product.name}`} />

          <aside className="fw-side">
            <h2>Pins</h2>
            <p className="muted">Choose the ESP32 GPIO each data point is wired to. Every {product.name} uses the same wiring.</p>
            {points.length === 0 ? (
              <p className="muted">
                No data points yet, so the code sends one example reading. <Link to={`/products/${productId}`}>Define data points</Link>
              </p>
            ) : (
              <PinPanel
                key={points.map((p) => `${p.key}:${p.pin ?? ""}:${p.active_low ? 1 : 0}`).join("|")}
                points={points}
                onSave={savePins}
              />
            )}
            <button type="button" className="link-button" onClick={reset} disabled={busy || (saved === null && !edited)}>
              Reset to generated code
            </button>
            <p className="fw-saved-state">
              {saved === null ? "Showing the generated code." : "Showing your saved code."}
              {edited && " You have changes that are not saved."}
            </p>
          </aside>
        </div>

        <div className="fw-bottom">
          <CompilePanel productId={productId} code={code} />
          <SerialMonitor />
        </div>
      </section>
    </AppShell>
  );
}
