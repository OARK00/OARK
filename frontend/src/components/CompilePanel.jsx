import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import { uploadFirmware, WrongChip } from "./flasher";

const BOARDS = [
  { value: "esp32", label: "ESP32" },
  { value: "esp8266", label: "ESP8266" },
];
// A compile takes about 20 s, plus up to ~30 s when the compiler has to wake
// up. Asking every 2 s keeps the wait short without flooding the server.
const POLL_MS = 2000;
// The server gives up on a compile after 4 minutes; the page waits a little
// longer before saying something went wrong.
const GIVE_UP_MS = 6 * 60 * 1000;

function sizeText(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

// The last few lines esptool printed: enough to see where an upload stopped.
const LOG_LINES = 6;

// Verify: compile the code in the editor on Oark's compile service, the way
// the Arduino IDE's Verify button does on a computer. Upload: write the
// compiled firmware to a board on USB, through the page's serial port, which
// it borrows from the serial monitor (releaseMonitor) for the duration.
export default function CompilePanel({ productId, code, port, onPortChange, releaseMonitor, onUploadingChange }) {
  const [board, setBoard] = useState("esp32");
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const [upload, setUpload] = useState(null); // {state, progress, message, log}
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const running = job?.status === "running";
  const uploading = upload?.state === "running";

  // The seconds counter, so a 20-second wait does not look frozen.
  useEffect(() => {
    if (!running) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [running]);

  async function waitFor(jobId, since) {
    while (alive.current) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      if (!alive.current) return;
      if (Date.now() - since > GIVE_UP_MS) {
        setJob((current) => current && { ...current, status: "failed", output: "No answer from the compiler. Try again." });
        return;
      }
      try {
        const { data } = await api.get(`/products/${productId}/compile/${jobId}`);
        if (!alive.current) return;
        setJob(data);
        if (data.status !== "running") return;
      } catch {
        // One missed check is not a failure; the next one tries again.
      }
    }
  }

  async function uploadToBoard() {
    if (!("serial" in navigator)) {
      setUpload({ state: "failed", progress: 0, message: "Uploading needs Chrome or Edge on a computer.", log: [] });
      return;
    }
    let target = port;
    if (!target) {
      try {
        target = await navigator.serial.requestPort();
        onPortChange(target);
      } catch {
        return; // the person closed the port list
      }
    }
    const log = [];
    const addLog = (text) => {
      const line = String(text).trim();
      if (!line || !alive.current) return;
      log.push(line);
      setUpload((current) => current && { ...current, log: log.slice(-LOG_LINES) });
    };
    setUpload({ state: "running", progress: 0, message: "Getting the firmware…", log: [] });
    onUploadingChange(true);
    try {
      await releaseMonitor();
      const { data } = await api.get(`/products/${productId}/compile/${job.id}/firmware`, { responseType: "arraybuffer" });
      setUpload((current) => ({ ...current, message: "Connecting to the board…" }));
      await uploadFirmware({
        port: target,
        board: job.board,
        firmware: new Uint8Array(data),
        onLog: addLog,
        onProgress: (fraction) =>
          alive.current && setUpload((current) => ({ ...current, progress: fraction, message: `Writing firmware… ${Math.round(fraction * 100)}%` })),
      });
      if (alive.current) {
        setUpload({
          state: "succeeded",
          progress: 1,
          message: "Uploaded. The board restarted with the new code. Press Start in the Serial monitor to see it run.",
          log: log.slice(-LOG_LINES),
        });
      }
    } catch (err) {
      if (!alive.current) return;
      const message =
        err instanceof WrongChip
          ? err.message
          : err?.response
            ? getErrorMessage(err, "Could not get the firmware")
            : "The upload did not finish. Check the USB cable, close other programs using the port, and try again. If it keeps failing, hold the board's BOOT button while you press Upload.";
      setUpload({ state: "failed", progress: 0, message, log: log.slice(-LOG_LINES) });
    } finally {
      onUploadingChange(false);
    }
  }

  async function verify() {
    setError(null);
    setUpload(null);
    const since = Date.now();
    try {
      const { data } = await api.post(`/products/${productId}/compile`, { code, board });
      setStartedAt(since);
      setNow(since);
      setJob(data);
      waitFor(data.id, since);
    } catch (err) {
      setJob(null);
      setError(getErrorMessage(err, "Could not start the compile"));
    }
  }

  const seconds = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;

  return (
    <section className="compile" aria-label="Compile">
      <div className="compile-bar">
        <h2>Compile</h2>
        <label className="compile-board">
          <span>Board</span>
          <select value={board} onChange={(e) => setBoard(e.target.value)} disabled={running}>
            {BOARDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="primary-button compile-verify"
          onClick={verify}
          disabled={running || uploading || !code.trim()}
        >
          {running ? "Compiling…" : "Verify"}
        </button>
        <button
          type="button"
          className="ghost-button compile-upload"
          onClick={uploadToBoard}
          disabled={job?.status !== "succeeded" || uploading}
          title={job?.status === "succeeded" ? "Write this firmware to the board on USB" : "Verify first: Upload sends the compiled firmware"}
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>

      {error && (
        <div className="error" role="status">
          {error}
        </div>
      )}

      <p className={`compile-status compile-${job?.status || "idle"}`} role="status">
        {!job && "Press Verify to check that this code compiles. It takes about 20 seconds."}
        {running && `Compiling for ${board === "esp32" ? "ESP32" : "ESP8266"}… ${seconds} s`}
        {job?.status === "succeeded" &&
          `Compiled successfully${job.firmware_bytes ? `: firmware is ${sizeText(job.firmware_bytes)}` : ""}.`}
        {job?.status === "failed" && "The code did not compile. The compiler's message is below."}
      </p>

      {upload && (
        <div className={`upload upload-${upload.state}`} role="status">
          <p>{upload.message}</p>
          {upload.state === "running" && (
            <div className="upload-bar" aria-hidden="true">
              <span style={{ width: `${Math.round(upload.progress * 100)}%` }} />
            </div>
          )}
          {upload.log.length > 0 && <pre className="upload-log">{upload.log.join("\n")}</pre>}
        </div>
      )}

      {job?.output && <pre className="compile-output">{job.output}</pre>}
    </section>
  );
}
