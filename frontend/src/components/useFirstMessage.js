import { useEffect, useState } from "react";
import api from "../api/client";

const POLL_INTERVAL_MS = 3000;

// Decides, after each check, whether the Connect step should check again.
// `device` is the latest device from GET /devices/{id}, or null if that
// request failed. `startedAt` is when waiting began (a Date.now() timestamp).
function shouldKeepPolling(device, startedAt) {
  if (device?.last_seen_at) return false;
  if (Date.now() - startedAt > 10 * 60 * 1000) return false;
  return true;
}

// Watches a newly created device until its first message arrives.
export function useFirstMessage(deviceId) {
  const [device, setDevice] = useState(null);
  const [waiting, setWaiting] = useState(true);
  const [pollRun, setPollRun] = useState(0);

  useEffect(() => {
    if (!deviceId) return;
    const startedAt = Date.now();
    let cancelled = false;
    let timer;

    async function check() {
      let latest = null;
      try {
        const { data } = await api.get(`/devices/${deviceId}`);
        latest = data;
      } catch {
        // A failed check is handed to shouldKeepPolling as null.
      }
      if (cancelled) return;
      if (latest) setDevice(latest);
      if (shouldKeepPolling(latest, startedAt)) {
        timer = setTimeout(check, POLL_INTERVAL_MS);
      } else {
        setWaiting(false);
      }
    }

    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deviceId, pollRun]);

  return {
    device,
    waiting,
    connected: Boolean(device?.last_seen_at),
    // "Waiting" starts true; only a retry needs to switch it back on.
    retry: () => {
      setWaiting(true);
      setPollRun((n) => n + 1);
    },
  };
}
