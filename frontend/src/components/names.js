// Names are one per company (the real rule is on the server, in
// backend/app/core/names.py). The same comparison here lets a name box warn
// while the user is still typing, instead of after they click Create.

// How many free names to offer under a taken one. Two: a real choice, but
// they differ only by a number, so more would just be clutter.
export const SUGGESTION_COUNT = 2;

// "  Smart   Switch " and "smart switch" are the same name.
export function nameKey(name) {
  return name.trim().split(/\s+/).join(" ").toLowerCase();
}

// The names already in use, ready for fast lookups.
export function takenKeys(names) {
  return new Set(names.map(nameKey));
}

export function isTaken(keys, name) {
  return Boolean(name.trim()) && keys.has(nameKey(name));
}

// Free names close to the one typed: "Smart switch" -> "Smart switch 2",
// "Smart switch 3"; "Helmet 4" -> "Helmet 5", "Helmet 6". Numbers already in
// use are skipped.
export function suggestNames(name, keys, count = SUGGESTION_COUNT) {
  const clean = name.trim().split(/\s+/).join(" ");
  if (!clean) return [];
  const numbered = clean.match(/^(.*\S)\s+(\d+)$/);
  const base = numbered ? numbered[1] : clean;
  let n = numbered ? Number(numbered[2]) + 1 : 2;
  const free = [];
  while (free.length < count && n < 100000) {
    const candidate = `${base} ${n}`;
    if (!keys.has(nameKey(candidate))) free.push(candidate);
    n = n + 1;
  }
  return free;
}
