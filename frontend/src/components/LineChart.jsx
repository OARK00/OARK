const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 180;

function niceRange(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    // A flat line drawn across the middle reads better than one pinned to
    // the floor of the chart, and shows that the value simply isn't moving.
    const pad = Math.abs(min) * 0.1 || 1;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}

function formatValue(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

// points: [{ at: Date, value: number }] in time order, oldest first.
export default function LineChart({ points, unit }) {
  if (points.length === 0) {
    return <p className="chart-empty">No readings in this period.</p>;
  }

  const values = points.map((point) => point.value);
  const [low, high] = niceRange(values);
  const firstTime = points[0].at.getTime();
  const lastTime = points[points.length - 1].at.getTime();
  const span = Math.max(lastTime - firstTime, 1);

  const x = (point) => ((point.at.getTime() - firstTime) / span) * VIEW_WIDTH;
  const y = (point) => VIEW_HEIGHT - ((point.value - low) / (high - low)) * VIEW_HEIGHT;

  const line = points.map((point) => `${x(point).toFixed(1)},${y(point).toFixed(1)}`).join(" ");
  const area = `0,${VIEW_HEIGHT} ${line} ${VIEW_WIDTH},${VIEW_HEIGHT}`;
  const latest = points[points.length - 1];

  return (
    <div className="line-chart">
      <div className="line-chart-scale">
        <span>
          {formatValue(high)}
          {unit ? ` ${unit}` : ""}
        </span>
        <span>
          {formatValue(low)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div className="line-chart-plot">
        {/* preserveAspectRatio="none" lets the chart fill any width; the
            stroke stays 2px because of vector-effect. */}
        <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" role="img">
          <polygon className="line-chart-area" points={area} />
          <polyline className="line-chart-line" points={line} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="line-chart-times">
          <span>{points[0].at.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          <span>
            latest <b>{formatValue(latest.value)}{unit ? ` ${unit}` : ""}</b>
          </span>
          <span>{latest.at.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>
    </div>
  );
}
