import { isTaken, suggestNames } from "./names";

// A name box that checks the name while it is typed: a red line when the
// company already uses it, and free names one click away underneath.
// `keys` comes from takenKeys(); `kind` is "product" or "device".
export default function NameField({ label = "Name", value, onChange, keys, kind, hints = [], ...inputProps }) {
  const taken = isTaken(keys, value);
  // Under a taken name: free names like it. In an empty box: the caller's
  // hints (for example the next unit of the chosen product).
  const suggestions = taken ? suggestNames(value, keys) : value.trim() ? [] : hints;

  return (
    <div className="name-field">
      <label className="field">
        {label}
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={taken ? "input-invalid" : undefined}
          aria-invalid={taken}
          {...inputProps}
        />
      </label>
      {taken && (
        <div className="name-field-warning" role="alert">
          You already have a {kind} with this name.
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="name-field-suggestions">
          <span className="name-field-try">{taken ? "Try" : "Suggested"}</span>
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" className="ai-chip" onClick={() => onChange(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
