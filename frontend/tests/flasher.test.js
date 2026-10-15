// Where Upload writes firmware. A wrong address here does not show as an
// error: it writes over the board's start-up code, and the board stops
// starting. So the exact values are pinned by a test.
import assert from "node:assert/strict";
import test from "node:test";
import { flashAddress } from "../src/components/flasher.js";

test("ESP32 programs go after the start-up code and memory map", () => {
  assert.equal(flashAddress("esp32"), 0x10000);
});

test("ESP32 never writes over the start-up code (0x1000) or memory map (0x8000)", () => {
  assert.notEqual(flashAddress("esp32"), 0x1000);
  assert.notEqual(flashAddress("esp32"), 0x8000);
});

test("ESP8266 firmware is a complete image from the start", () => {
  assert.equal(flashAddress("esp8266"), 0x0);
});

test("an unknown board is refused instead of guessed", () => {
  assert.throws(() => flashAddress("esp32s3"));
  assert.throws(() => flashAddress(""));
});
