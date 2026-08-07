/** The Runway mark: six lights on a 48-unit grid, stepping up in three columns.
 *  7-unit lights on a 4.5-unit gutter, radius 1.5, opacity stepping 30 / 60 / 100.
 *  The opacity ramp *is* the mark — the lights are never re-coloured per column, never
 *  rotated, never stretched. Taken verbatim from the brand sheet. */

const LIGHTS: Array<[number, number, number]> = [
  [7, 9, 0.3],
  [7, 20.5, 0.6],
  [7, 32, 1],
  [20.5, 20.5, 0.6],
  [20.5, 32, 1],
  [34, 32, 1],
];

export function Mark({
  size = 22,
  fill = 'var(--accent)',
}: {
  size?: number;
  fill?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {LIGHTS.map(([x, y, o]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" rx="1.5" fill={fill} opacity={o} />
      ))}
    </svg>
  );
}

/** Mark plus wordmark. `Runway` in Manrope 800 at -0.02em — there is no logotype artwork
 *  beyond this, so the wordmark is always live type. */
export function Wordmark({ size = 16, markSize = 22 }: { size?: number; markSize?: number }) {
  return (
    <>
      <Mark size={markSize} />
      <span className="wordmark" style={{ fontSize: size }}>
        Runway
      </span>
    </>
  );
}
