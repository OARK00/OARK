import { useEffect, useState } from "react";
import { CheckIcon } from "./icons";

const ROTATE_MS = 12000;

// Each guide is a path through the platform, shown as numbered steps with
// arrows between them. `doneKeys` lets a step tick itself off from real
// account data instead of claiming progress the platform can't see.
export const GUIDES = [
  {
    id: "device",
    title: "Connect a device you already have",
    steps: [
      { label: "Add a device", doneKey: "device_added" },
      { label: "Copy its credentials" },
      { label: "Flash the sketch" },
      { label: "See it report", doneKey: "first_message" },
    ],
    action: { label: "Add a device", kind: "add-device" },
  },
  {
    id: "customise",
    title: "Customise what it measures",
    steps: [
      { label: "Create a product", doneKey: "product_created" },
      { label: "Let Oark read the fields" },
      { label: "Name them and set units" },
      { label: "Every device reuses it" },
    ],
    action: { label: "Go to products", kind: "link", to: "/products" },
  },
  {
    id: "template",
    title: "Start from a ready-made template",
    steps: [
      { label: "Pick a template" },
      { label: "Product is created" },
      { label: "Add your devices" },
      { label: "Data arrives labelled" },
    ],
    action: { label: "Browse templates", kind: "template" },
  },
];

export default function GuideCarousel({ checklist, onAddDevice, renderAction }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => setIndex((current) => (current + 1) % GUIDES.length), ROTATE_MS);
    return () => clearTimeout(timer);
  }, [index, paused]);

  const guide = GUIDES[index];

  return (
    <div
      className="guide-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="card-head">
        <h3>Guides</h3>
        <span className="card-head-note">{guide.title}</span>
      </div>

      <div className="guide-steps">
        {guide.steps.map((step, position) => {
          const done = step.doneKey ? checklist[step.doneKey] : false;
          return (
            <div key={step.label} className="guide-step-wrap">
              <div className={`guide-step${done ? " done" : ""}`}>
                <span className="guide-number">{done ? CheckIcon : position + 1}</span>
                <span className="guide-label">{step.label}</span>
              </div>
              {position < guide.steps.length - 1 && <span className="guide-arrow" aria-hidden="true" />}
            </div>
          );
        })}
      </div>

      <div className="guide-actions">{renderAction(guide.action, onAddDevice)}</div>

      <div className="guide-dots">
        {GUIDES.map((item, position) => (
          <button
            key={item.id}
            type="button"
            className={`guide-dot${position === index ? " active" : ""}`}
            aria-label={item.title}
            onClick={() => {
              setIndex(position);
              setPaused(true);
            }}
          />
        ))}
      </div>
    </div>
  );
}
