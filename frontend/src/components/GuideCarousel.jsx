import { useEffect, useState } from "react";
import { CheckIcon } from "./icons";

const ROTATE_MS = 12000;

// Each guide is a path through the platform, shown as numbered steps with
// arrows between them. `doneKeys` lets a step tick itself off from real
// account data instead of claiming progress the platform can't see.
export const GUIDES = [
  {
    id: "connect",
    title: "Connect your first device",
    steps: [
      { label: "Define a product", doneKey: "product_created" },
      { label: "Add a device", doneKey: "device_added" },
      { label: "Flash the sketch" },
      { label: "See it report", doneKey: "first_message" },
    ],
    action: { label: "Add a device", kind: "add-device" },
  },
  {
    id: "history",
    title: "Read what your devices recorded",
    steps: [
      { label: "Open a device" },
      { label: "Pick a time range" },
      { label: "Switch between fields" },
      { label: "Spot the trend" },
    ],
    action: { label: "Go to devices", kind: "link", to: "/dashboard" },
  },
  {
    id: "secure",
    title: "Keep the fleet secure",
    steps: [
      { label: "Each device, own login" },
      { label: "Reset a leaked secret" },
      { label: "Delete to revoke access" },
      { label: "Watch what stops reporting" },
    ],
    action: { label: "Go to devices", kind: "link", to: "/dashboard" },
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
