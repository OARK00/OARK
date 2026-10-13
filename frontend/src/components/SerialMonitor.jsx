import { useEffect, useRef, useState } from "react";
import { cleanChunk, keepRecent } from "./serialText";

const BAUD_RATES = [9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600];
// What Oark's generated code uses: Serial.begin(115200).
const DEFAULT_BAUD = 115200;

// What a board on USB prints, shown in the browser. The browser talks to the
// board directly (Web Serial); nothing goes through Oark's servers. Only
// Chrome and Edge on a computer have it, and the person must pick the port
// in the browser's own box each time.
export default function SerialMonitor() {
  const supported = typeof navigator !== "undefined" && "serial" in navigator;
  const [port, setPort] = useState(null);
  const [baud, setBaud] = useState(DEFAULT_BAUD);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [follow, setFollow] = useState(true);
  const [message, setMessage] = useState(null);
  const [toSend, setToSend] = useState("");
  const reader = useRef(null);
  const screen = useRef(null);

  // Leaving the page while reading: end the loop, which closes the port.
  useEffect(() => {
    return () => {
      reader.current?.cancel().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (follow && screen.current) screen.current.scrollTop = screen.current.scrollHeight;
  }, [output, follow]);

  async function selectPort() {
    setMessage(null);
    try {
      setPort(await navigator.serial.requestPort());
    } catch (err) {
      // NotFoundError: the person closed the box without choosing.
      if (err.name !== "NotFoundError") setMessage("Could not show the list of ports.");
    }
  }

  async function readUntilStopped(openPort) {
    const decoder = new TextDecoder();
    const portReader = openPort.readable.getReader();
    reader.current = portReader;
    try {
      for (;;) {
        const { value, done } = await portReader.read();
        if (done) break;
        // stream: a letter split across two deliveries is finished by the next one.
        const text = cleanChunk(decoder.decode(value, { stream: true }));
        setOutput((shown) => keepRecent(shown + text));
      }
    } catch {
      setMessage("The board was disconnected.");
    } finally {
      reader.current = null;
      portReader.releaseLock();
      await openPort.close().catch(() => {});
      setRunning(false);
    }
  }

  async function start() {
    setMessage(null);
    try {
      await port.open({ baudRate: baud });
    } catch {
      setMessage(
        "Could not open the port. Close any other program that is using it (for example the Arduino IDE serial monitor), then try again."
      );
      return;
    }
    setRunning(true);
    readUntilStopped(port);
  }

  function stop() {
    // The read loop sees "done", then closes the port itself.
    reader.current?.cancel().catch(() => {});
  }

  async function send(e) {
    e.preventDefault();
    const writer = port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(`${toSend}\n`));
      setToSend("");
    } catch {
      setMessage("Could not send that to the board.");
    } finally {
      writer.releaseLock();
    }
  }

  if (!supported) {
    return (
      <section className="serial" aria-label="Serial monitor">
        <h2>Serial monitor</h2>
        <p className="muted">
          This browser cannot talk to a board on USB. Open Oark in Chrome or Edge on a computer to use the serial monitor.
        </p>
      </section>
    );
  }

  return (
    <section className="serial" aria-label="Serial monitor">
      <div className="serial-bar">
        <h2>Serial monitor</h2>
        <button type="button" className="ghost-button" onClick={selectPort} disabled={running}>
          {port ? "Change port" : "Select port"}
        </button>
        <label className="serial-baud">
          <span>Baud</span>
          <select value={baud} onChange={(e) => setBaud(Number(e.target.value))} disabled={running}>
            {BAUD_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}
              </option>
            ))}
          </select>
        </label>
        {running ? (
          <button type="button" className="ghost-button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="button" className="primary-button serial-start" onClick={start} disabled={!port}>
            Start
          </button>
        )}
        <button type="button" className="ghost-button" onClick={() => setOutput("")} disabled={!output}>
          Clear
        </button>
        <label className="serial-follow">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          <span>Follow new lines</span>
        </label>
      </div>

      {message && (
        <div className="error" role="status">
          {message}
        </div>
      )}

      <pre className="serial-screen" ref={screen} aria-live="off" tabIndex={0}>
        {output ||
          (running
            ? "Listening… nothing received yet. Check that the baud rate matches Serial.begin() in your code."
            : port
              ? "Port selected. Press Start."
              : "No serial output yet. Connect a board with USB, then choose Select port.")}
      </pre>

      <form className="serial-send" onSubmit={send}>
        <input
          type="text"
          value={toSend}
          onChange={(e) => setToSend(e.target.value)}
          placeholder={running ? "Type a line to send to the board" : "Start the monitor to send data"}
          aria-label="Text to send to the board"
          disabled={!running}
        />
        <button type="submit" className="ghost-button" disabled={!running || !toSend}>
          Send
        </button>
      </form>
    </section>
  );
}
