/** Data viz is single-hue: a 1.5px accent stroke over a ≤14% accent area fill, mono axis
 *  labels in --text-faint, and no gridlines beyond one hairline baseline. Gauges are an
 *  accent arc on an --ink-3 track. There is no categorical palette in this product. */

export function Sparkline({
  values,
  labels,
  height = 132,
  ariaLabel,
}: {
  values: number[];
  labels?: string[];
  height?: number;
  ariaLabel: string;
}) {
  const w = 640;
  const h = 150;
  const pad = 16;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pt = (v: number, i: number) => {
    const x = pad + i * step;
    const y = h - 14 - (v / max) * (h - 42);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  };
  const line = values.map((v, i) => pt(v, i)).join(' L ');
  const area = `M ${line} L ${(w - pad).toFixed(1)} ${h} L ${pad} ${h} Z`;

  return (
    <>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="chart"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
      >
        <path d={area} fill="color-mix(in srgb, var(--accent) 14%, transparent)" />
        <path
          d={`M ${line}`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={`M 0 ${h - 1} H ${w}`}
          stroke="var(--line-hairline)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {labels && (
        <div className="chart-axis">
          {labels.map((l, i) => (
            <span key={`${l}-${i}`}>{l}</span>
          ))}
        </div>
      )}
    </>
  );
}

export function Gauge({
  rate,
  caption,
  size = 168,
}: {
  /** 0–1, or null when nothing in the range was eligible. */
  rate: number | null;
  caption: string;
  size?: number;
}) {
  const r = 50;
  const circumference = 2 * Math.PI * r;
  const filled = rate === null ? 0 : Math.max(0, Math.min(1, rate)) * circumference;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${caption}: ${rate === null ? 'no data' : `${Math.round(rate * 100)}%`}`}
    >
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--ink-3)" strokeWidth="10" />
      {rate !== null && (
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(1)} ${circumference.toFixed(1)}`}
          transform="rotate(-90 60 60)"
        />
      )}
      <text
        x="60"
        y="58"
        textAnchor="middle"
        fill="var(--text-strong)"
        fontFamily="var(--font-mono)"
        fontSize="24"
      >
        {rate === null ? '—' : `${Math.round(rate * 100)}%`}
      </text>
      <text
        x="60"
        y="76"
        textAnchor="middle"
        fill="var(--text-faint)"
        fontFamily="var(--font-core)"
        fontSize="9"
        letterSpacing="1.4"
      >
        {caption.toUpperCase()}
      </text>
    </svg>
  );
}

/** Open load, split by overdue / due / unscheduled. The three status hues appear here
 *  only as thin segments, each paired with its own label below. */
export function LoadBar({
  overdue,
  due,
  unscheduled,
}: {
  overdue: number;
  due: number;
  unscheduled: number;
}) {
  const total = overdue + due + unscheduled;
  const w = (n: number) => (total ? `${(n / total) * 100}%` : '0%');
  return (
    <div
      className="load-bar"
      role="img"
      aria-label={`${overdue} overdue, ${due} due, ${unscheduled} unscheduled`}
    >
      <span className="load-seg" style={{ width: w(overdue), background: 'var(--status-overdue)' }} />
      <span className="load-seg" style={{ width: w(due), background: 'var(--status-due)' }} />
      <span className="load-seg" style={{ width: w(unscheduled), background: 'var(--status-idle)' }} />
    </div>
  );
}
