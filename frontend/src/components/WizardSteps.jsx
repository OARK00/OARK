import { CheckIcon } from "./icons";

export default function WizardSteps({ steps, current }) {
  return (
    <ol className="wizard-steps" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((label, i) => (
        <li
          key={label}
          className={`wizard-step ${i === current ? "current" : ""} ${i < current ? "done" : ""}`}
          aria-current={i === current ? "step" : undefined}
        >
          <span className="wizard-step-bar" />
          <span className="wizard-step-label">
            {i < current ? CheckIcon : <span className="wizard-step-num">{i + 1}</span>}
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}
