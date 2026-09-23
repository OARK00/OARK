import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage } from "../api/errors";
import DraftReview from "./DraftReview";
import { PlusIcon } from "./icons";

const EXAMPLES = [
  "A cold store freezer with a door sensor",
  "An energy meter on a production line",
  "A water tank with a level sensor",
  "A pump that reports whether it is running",
];

const MIN_DESCRIPTION = 8;

const SparkIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </svg>
);

const TemplateIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M17.5 14v7M14 17.5h7" />
  </svg>
);

// Whether this platform has an AI provider configured. Asked once, so the
// box shows as usable or as coming soon instead of offering a button that
// can only fail.
function useDraftAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    api
      .get("/products/draft/status")
      .then(({ data }) => setAvailable(Boolean(data.available)))
      .catch(() => setAvailable(false));
  }, []);
  return available;
}

function DescribeBox({ onDraft }) {
  const available = useDraftAvailable();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const enabled = available && Boolean(onDraft);
  const ready = enabled && !busy && text.trim().length >= MIN_DESCRIPTION;

  async function generate() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post("/products/draft", { description: text.trim() });
      onDraft(data);
    } catch (err) {
      setError(getErrorMessage(err, "Could not draft that. Try describing what the device measures."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-box" aria-disabled={!enabled}>
      <div className="ai-box-head">
        <span className="ai-box-title">
          {SparkIcon}
          Describe your device
        </span>
        {!enabled && <span className="soon-badge">Soon</span>}
      </div>
      <p className="ai-box-note">
        Oark will draft its name, category and data points from one sentence. You can edit everything afterwards.
      </p>
      <div className="ai-box-input">
        <textarea
          placeholder="e.g. A cold store freezer with a door sensor…"
          rows={2}
          maxLength={500}
          value={text}
          disabled={!enabled || busy}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) generate();
          }}
        />
        <button type="button" className="primary-button" disabled={!ready} onClick={generate}>
          {SparkIcon}
          {busy ? "Drafting…" : "Generate"}
        </button>
      </div>
      <div className="ai-box-examples">
        <span className="ai-box-examples-label">Try one</span>
        {EXAMPLES.map((example) =>
          enabled ? (
            <button key={example} type="button" className="ai-chip" onClick={() => setText(example)} disabled={busy}>
              {example}
            </button>
          ) : (
            <span key={example} className="ai-chip">
              {example}
            </span>
          )
        )}
      </div>
      {error && <div className="error ai-box-error">{error}</div>}
    </div>
  );
}

// The three ways to say what kind of device something is, in the shape the
// reference platforms use: describing it is the front door, with a template
// and a fully manual setup as the two ways around it. Used on its own for
// New product, and as the first step of Add device.
export function ChooserBody({
  onTemplate,
  onManual,
  onDraft,
  manualTitle = "Set up manually",
  manualText = "Full freedom. Connect a test device and Oark reads its fields, or define them yourself.",
}) {
  return (
    <>
      <DescribeBox onDraft={onDraft} />

      <div className="chooser-divider">
        <span>or</span>
      </div>

      <div className="chooser-options">
        <button type="button" className="chooser-option" onClick={onTemplate}>
          <span className="chooser-option-icon">{TemplateIcon}</span>
          <span className="chooser-option-title">Start from a template</span>
          <span className="chooser-option-text">
            Ready-made for common hardware: temperature, energy, tank level, machine status. One click.
          </span>
        </button>

        <button type="button" className="chooser-option" onClick={onManual}>
          <span className="chooser-option-icon">{PlusIcon}</span>
          <span className="chooser-option-title">{manualTitle}</span>
          <span className="chooser-option-text">{manualText}</span>
        </button>
      </div>
    </>
  );
}

export default function NewProductChooser({ onClose, onTemplate, onManual }) {
  const [draft, setDraft] = useState(null);
  const navigate = useNavigate();

  return (
    <div className="modal-overlay" onClick={() => !draft && onClose()}>
      <div
        className={`modal-card wizard-card ${draft ? "wizard-card-wide" : "chooser-card"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chooser-title"
        onClick={(event) => event.stopPropagation()}
      >
        {draft ? (
          <DraftReview
            draft={draft}
            onBack={() => setDraft(null)}
            onCreated={(product) => navigate(`/products/${product.id}`)}
          />
        ) : (
          <>
            <h3 id="chooser-title">New product</h3>
            <p>A product is a type of device. Define it once, and every device of that type reuses it.</p>

            <ChooserBody onTemplate={onTemplate} onManual={onManual} onDraft={setDraft} />

            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
