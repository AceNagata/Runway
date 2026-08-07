/** Timestamps are stored UTC and rendered in the viewing user's zone. §7
 *  Dates are relative near the present and absolute beyond it; times use an en dash. */

const EN_DASH = '–';

export const nowIso = () => new Date().toISOString();

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dayDiff(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86_400_000);
}

/** Monday-first week containing `d`. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const shift = (x.getDay() + 6) % 7;
  return addDays(x, -shift);
}

export function isoWeek(d: Date): number {
  const t = startOfDay(d);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const week1 = new Date(t.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((t.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `07.08.2026` — the absolute form, always set in mono. */
export function absDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** `07.08` — absolute, short. */
export function absDateShort(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

/** `09:00` */
export function clock(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `09:00 – 11:00` */
export function clockRange(startIso: string, endIso: string): string {
  return `${clock(startIso)} ${EN_DASH} ${clock(endIso)}`;
}

/** `01.08 – 07.08.2026` */
export function dateRange(startIso: string, endIso: string): string {
  return `${absDateShort(startIso)} ${EN_DASH} ${absDate(endIso)}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const weekdayShort = (iso: string | Date) =>
  WEEKDAYS[(typeof iso === 'string' ? new Date(iso) : iso).getDay()];

/** Today, Tomorrow, Yesterday, then a weekday inside the next/last six days,
 *  then the absolute form. */
export function relDay(iso: string | Date, from = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const diff = dayDiff(d, from);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return weekdayShort(d);
  if (diff < -1 && diff > -7) return weekdayShort(d);
  return absDate(d);
}

/** `Today, 10:15` / `05.08.2026, 17:00` */
export function relDayTime(iso: string, from = new Date()): string {
  return `${relDay(iso, from)}, ${clock(iso)}`;
}

/** `2 days late` / `in 2 hours` — exact, unqualified, carrying its noun. */
export function lateness(dueIso: string, from = new Date()): string {
  const due = new Date(dueIso);
  const days = dayDiff(from, due);
  if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'} late`;
  const mins = Math.round((from.getTime() - due.getTime()) / 60_000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    return `${h} ${h === 1 ? 'hour' : 'hours'} late`;
  }
  if (mins > 0) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} late`;
  const ahead = -mins;
  if (ahead >= 1440) {
    const d = Math.round(ahead / 1440);
    return `in ${d} ${d === 1 ? 'day' : 'days'}`;
  }
  if (ahead >= 60) {
    const h = Math.round(ahead / 60);
    return `in ${h} ${h === 1 ? 'hour' : 'hours'}`;
  }
  return `in ${ahead} ${ahead === 1 ? 'minute' : 'minutes'}`;
}

export function partOfDay(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

/** `Friday morning` — the home eyebrow. */
export function greetingEyebrow(d = new Date()): string {
  const long = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${long[d.getDay()]} ${partOfDay(d)}`;
}

/** `<input type="datetime-local">` speaks local wall-clock; storage speaks UTC. These two
 *  are the only places the two representations meet. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Compose a UTC ISO stamp from a local day plus an hour offset. */
export function atHour(day: Date, hour: number, minute = 0): string {
  const d = startOfDay(day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
