// "Remember Wi-Fi on this computer": the network name and password are kept
// in this browser only (localStorage) and are never sent to Oark. The device
// secret is never remembered anywhere.

export const WIFI_STORE_KEY = "oark.firmware.wifi";
export const WIFI_PLACEHOLDERS = { WIFI_SSID: "your-wifi-name", WIFI_PASSWORD: "your-wifi-password" };

// The Wi-Fi details worth remembering from the values typed into the code
// ({ WIFI_SSID, WIFI_PASSWORD, ... }), or null when there is nothing real yet.
export function wifiToRemember(values) {
  const ssid = (values.WIFI_SSID || "").trim();
  const password = values.WIFI_PASSWORD ?? "";
  if (!ssid || ssid === WIFI_PLACEHOLDERS.WIFI_SSID) return null;
  if (password === WIFI_PLACEHOLDERS.WIFI_PASSWORD) return null;
  return { ssid, password };
}

export function rememberedWifi() {
  try {
    const stored = JSON.parse(localStorage.getItem(WIFI_STORE_KEY) || "null");
    return stored && typeof stored.ssid === "string" && typeof stored.password === "string" ? stored : null;
  } catch {
    return null; // private window, blocked storage, or a broken value
  }
}

export function storeWifi(wifi) {
  try {
    if (wifi) localStorage.setItem(WIFI_STORE_KEY, JSON.stringify(wifi));
    else localStorage.removeItem(WIFI_STORE_KEY);
  } catch {
    // Storage unavailable: remembering simply does not happen.
  }
}
