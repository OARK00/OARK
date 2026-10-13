// Text handling for the serial monitor, kept apart from the screen so it
// can be reasoned about (and tested) without a board.

// A board that prints ten lines a second fills the page's memory within the
// hour. Only the newest lines are kept; older ones scroll away for good.
export const MAX_LINES = 2000;

// Boards end lines with "\r\n"; the page only needs the "\n".
export function cleanChunk(text) {
  return text.replaceAll("\r", "");
}

// The text to keep after new output arrived: at most MAX_LINES lines.
export function keepRecent(text) {
  const lines = text.split("\n");
  if (lines.length <= MAX_LINES) return text;
  return lines.slice(-MAX_LINES).join("\n");
}
