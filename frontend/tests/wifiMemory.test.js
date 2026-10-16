// What "Remember Wi-Fi on this computer" keeps. The risks: remembering the
// example text instead of a real network, and ever remembering a secret.
import assert from "node:assert/strict";
import test from "node:test";
import { WIFI_PLACEHOLDERS, wifiToRemember } from "../src/components/wifiMemory.js";

test("a real network name and password are remembered", () => {
  assert.deepEqual(wifiToRemember({ WIFI_SSID: "Office 2.4", WIFI_PASSWORD: "p@ss 123" }), { ssid: "Office 2.4", password: "p@ss 123" });
});

test("the example text is not a network", () => {
  assert.equal(wifiToRemember({ ...WIFI_PLACEHOLDERS }), null);
  assert.equal(wifiToRemember({ WIFI_SSID: WIFI_PLACEHOLDERS.WIFI_SSID, WIFI_PASSWORD: "real-password" }), null);
});

test("a real name with the example password is not finished yet", () => {
  assert.equal(wifiToRemember({ WIFI_SSID: "Office", WIFI_PASSWORD: WIFI_PLACEHOLDERS.WIFI_PASSWORD }), null);
});

test("an empty name is not a network", () => {
  assert.equal(wifiToRemember({ WIFI_SSID: "", WIFI_PASSWORD: "x" }), null);
  assert.equal(wifiToRemember({ WIFI_SSID: "   ", WIFI_PASSWORD: "x" }), null);
  assert.equal(wifiToRemember({}), null);
});

test("an open network (no password) is remembered", () => {
  assert.deepEqual(wifiToRemember({ WIFI_SSID: "Cafe", WIFI_PASSWORD: "" }), { ssid: "Cafe", password: "" });
});

test("the device secret and ID are never part of what is remembered", () => {
  const kept = wifiToRemember({ WIFI_SSID: "Office", WIFI_PASSWORD: "pw", DEVICE_ID: "id-1", DEVICE_SECRET: "s3cret" });
  assert.deepEqual(Object.keys(kept).sort(), ["password", "ssid"]);
  assert.ok(!JSON.stringify(kept).includes("s3cret"));
});
