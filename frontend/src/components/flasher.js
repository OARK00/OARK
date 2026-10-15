// Writes compiled firmware to a board over USB, in the browser, with
// Espressif's own esptool-js (the same steps as the Arduino IDE's Upload).
// Loaded only when someone uploads: the library is large.

// The chip each board choice is compiled for. Writing ESP32 firmware to an
// ESP32-S3, or ESP8266 firmware to an ESP32, would leave a board that does not
// start, so the chip is checked before anything is written.
const CHIP_NAMES = {
  esp32: "ESP32",
  esp8266: "ESP8266",
};

// Fast enough to write ~1 MB in under half a minute; every USB chip on common
// ESP boards (CP2102, CH340) handles it.
const UPLOAD_BAUD = 460800;

export class WrongChip extends Error {}

// Where in the board's flash memory the program goes. Only the program is
// written, like a normal Arduino IDE upload: the board's own start-up code and
// memory map stay as they are.
export function flashAddress(board) {
  if (board === "esp32") return 0x10000;
  if (board === "esp8266") return 0x0000;
  throw new Error(`Unknown board: ${board}`);
}

// port: a closed Web Serial port. firmware: Uint8Array.
// onProgress(0..1) while writing; onLog(text) for the tool's own messages.
export async function uploadFirmware({ port, board, firmware, onProgress, onLog }) {
  const { ESPLoader, Transport } = await import("esptool-js");
  const transport = new Transport(port, false);
  const loader = new ESPLoader({
    transport,
    baudrate: UPLOAD_BAUD,
    terminal: { clean() {}, writeLine: onLog, write: onLog },
  });
  try {
    // Restarts the board into its download mode and identifies the chip.
    await loader.main();
    const chip = loader.chip.CHIP_NAME;
    if (chip !== CHIP_NAMES[board]) {
      throw new WrongChip(`This board is an ${chip}, but the code was compiled for ${CHIP_NAMES[board]}. Choose ${chip} as the board, then Verify again.`);
    }
    await loader.writeFlash({
      fileArray: [{ data: firmware, address: flashAddress(board) }],
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (_fileIndex, written, total) => onProgress(total ? written / total : 0),
    });
    // Restart into the new program.
    await loader.after("hard_reset");
  } finally {
    await transport.disconnect().catch(() => {});
  }
}
