import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import CodeEditor from "./CodeEditor";
import CompilePanel from "./CompilePanel";
import { arduinoSketch } from "./firmwareSnippets";
import PinPanel from "./PinPanel";
import SerialMonitor from "./SerialMonitor";
import { rememberedWifi, storeWifi, wifiToRemember } from "./wifiMemory";
import "../pages/Firmware.css";

// Shown where a real value goes. The secret is never filled in here: Oark
// shows it once, when the device is created, and does not keep a readable copy.
const ID_PLACEHOLDER = "your-device-id";
const SECRET_PLACEHOLDER = "your-device-secret";

const ID_LINE = /(DEVICE_ID\s*=\s*")[^"\n]*(")/;

function withDeviceId(code, deviceId) {
  return code.replace(ID_LINE, `$1${deviceId || ID_PLACEHOLDER}$2`);
}

// The values a person types into the code for one board. They are carried
// into newly generated code (after Reset or new pins), so nobody types them
// twice, and they do not count as "changes" to the product's code.
const TYPED_VALUES = ["WIFI_SSID", "WIFI_PASSWORD", "DEVICE_ID", "DEVICE_SECRET"];
const valueLine = (name) => new RegExp(`(\\b${name}\\s*=\\s*")([^"\\n]*)(")`);

function typedValues(code) {
  return Object.fromEntries(TYPED_VALUES.map((name) => [name, code.match(valueLine(name))?.[2]]).filter(([, value]) => value !== undefined));
}

function withTypedValues(code, values) {
  return Object.entries(values).reduce((text, [name, value]) => text.replace(valueLine(name), (_, start, _old, end) => `${start}${value}${end}`), code);
}

function withoutTypedValues(code) {
  return withTypedValues(code, Object.fromEntries(TYPED_VALUES.map((name) => [name, ""])));
}

function withRememberedWifi(code) {
  const wifi = rememberedWifi();
  return wifi ? withTypedValues(code, { WIFI_SSID: wifi.ssid, WIFI_PASSWORD: wifi.password }) : code;
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

// Code, pins, Verify, Upload and the serial monitor for one product.
//
// On a product's firmware page any of its devices can be chosen; inside a
// device's page the device is fixed (`deviceId` + `lockDevice`), and the
// studio stays mounted while other tabs are shown, so the code and the open
// USB port survive switching tabs.
export default function FirmwareStudio({ productId, deviceId = null, lockDevice = false, onLoaded, testPanel = null }) {
  const [remember, setRemember] = useState(() => rememberedWifi() !== null);
  const [product, setProduct] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loadError, setLoadError] = useState(null);
  // What is stored on Oark: null when nothing was saved yet.
  const [saved, setSaved] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  // One USB port for the studio: the serial monitor and Upload take turns.
  const [port, setPort] = useState(null);
  const [uploading, setUploading] = useState(false);
  const monitor = useRef(null);
  const latestOnLoaded = useRef(onLoaded);

  useEffect(() => {
    latestOnLoaded.current = onLoaded;
  }, [onLoaded]);

  // While remembering is on, keep the stored Wi-Fi in step with what is typed.
  useEffect(() => {
    if (!remember || !code) return;
    const wifi = wifiToRemember(typedValues(code));
    if (wifi) storeWifi(wifi);
  }, [code, remember]);

  function toggleRemember(on) {
    setRemember(on);
    storeWifi(on ? wifiToRemember(typedValues(code)) : null);
  }

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
        latestOnLoaded.current?.(productRes.data);
        const opened = sketchRes.data.code ?? arduinoSketch(ID_PLACEHOLDER, SECRET_PLACEHOLDER, productRes.data.data_points);
        // Only a device of this product: the address bar is not trusted.
        const device = devicesRes.data.find((d) => d.id === deviceId);
        setCode(withRememberedWifi(device ? withDeviceId(opened, device.id) : opened));
      },
      (err) => active && setLoadError(getErrorMessage(err, "Could not load this product's firmware"))
    );
    return () => {
      active = false;
    };
  }, [productId, deviceId]);

  if (loadError) {
    return (
      <section className="panel">
        <div className="error">{loadError}</div>
      </section>
    );
  }

  if (!product) return <p className="muted">Loading firmware…</p>;

  const points = product.data_points;
  const generated = arduinoSketch(ID_PLACEHOLDER, SECRET_PLACEHOLDER, points);
  // Compared without the typed values: choosing a device or typing the Wi-Fi
  // is not an edit of the product's code.
  const edited = withoutTypedValues(code) !== withoutTypedValues(saved ?? generated);
  const chosenDevice = deviceIdIn(code);
  const fixedDevice = lockDevice ? devices.find((d) => d.id === deviceId) : null;

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
        setCode(withTypedValues(arduinoSketch(ID_PLACEHOLDER, SECRET_PLACEHOLDER, data.data_points), typedValues(code)));
        say("Pins saved. The code now uses them.");
      } else {
        say("Pins saved. Your own code was not changed: choose Reset to generated code to use the new pins.");
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not save the pins"));
    }
  }

  async function reset() {
    if (!window.confirm("Replace this code with the code Oark generates from the data points and pins? The Wi-Fi details and device secret you typed are kept.")) return;
    setBusy(true);
    setError(null);
    try {
      if (saved !== null) await api.delete(`/products/${productId}/sketch`);
      setSaved(null);
      setCode(withTypedValues(generated, typedValues(code)));
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
          {lockDevice ? (
            <span className="fw-device">
              <span>Device</span>
              <b>{fixedDevice?.name || "this device"}</b>
            </span>
          ) : (
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
          )}
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
        {lockDevice ? "This device's ID is filled in. " : "Choosing a device fills in its ID. "}
        The device secret is never kept here: paste it in place of <code>{SECRET_PLACEHOLDER}</code> before you upload.
      </p>

      <label className="fw-remember">
        <input type="checkbox" checked={remember} onChange={(e) => toggleRemember(e.target.checked)} />
        <span>
          Remember Wi-Fi on this computer <span className="muted">(kept in this browser only, never sent to Oark; not on shared computers)</span>
        </span>
      </label>

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

      {testPanel && (
        <div className="fw-test">
          <p className="fw-test-note">Test: switch the device from here after uploading, and watch the serial monitor below.</p>
          {testPanel}
        </div>
      )}

      <div className="fw-bottom">
        <CompilePanel
          productId={productId}
          code={code}
          port={port}
          onPortChange={setPort}
          releaseMonitor={() => monitor.current?.release()}
          onUploadingChange={setUploading}
        />
        <SerialMonitor ref={monitor} port={port} onPortChange={setPort} locked={uploading} />
      </div>
    </section>
  );
}
