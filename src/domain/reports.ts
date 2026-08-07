import { addDays, startOfDay } from '../lib/time';
import { derivedStatus } from './tasks';
import { subtreeIds } from './org';
import type { ID, RunwayState } from '../store/types';

/** Measures are derived from task history, never entered by hand. §5
 *  Every measure here is computed client-side, so a single user's own range is instant. */

export interface RangeMeasures {
  closed: number;
  opened: number;
  /** Closed before their due time, over closed tasks that had a due time. */
  onTimeRate: number | null;
  onTimeClosed: number;
  onTimeEligible: number;
  openLoad: { overdue: number; due: number; unscheduled: number };
  /** Local-day buckets across the range, oldest first. */
  byDay: Array<{ day: Date; closed: number; opened: number }>;
  perPerson: Array<{
    userId: ID;
    closed: number;
    overdue: number;
    onTimeRate: number | null;
  }>;
}

export type Subject =
  | { kind: 'self' }
  | { kind: 'person'; userId: ID }
  | { kind: 'subtree' };

export function subjectUserIds(
  state: RunwayState,
  viewerId: ID,
  subject: Subject,
): Set<ID> {
  if (subject.kind === 'self') return new Set([viewerId]);
  if (subject.kind === 'person') {
    // Access follows the same tree rule as hand-off: you can report on people below you.
    return subtreeIds(state, viewerId).has(subject.userId)
      ? new Set([subject.userId])
      : new Set<ID>();
  }
  return subtreeIds(state, viewerId);
}

export function measure(
  state: RunwayState,
  userIds: Set<ID>,
  from: Date,
  to: Date,
  now = new Date(),
): RangeMeasures {
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t <= to.getTime();
  };

  let closed = 0;
  let opened = 0;
  let onTimeClosed = 0;
  let onTimeEligible = 0;
  const openLoad = { overdue: 0, due: 0, unscheduled: 0 };

  const dayKeys: number[] = [];
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) dayKeys.push(d.getTime());
  const closedByDay = new Map<number, number>(dayKeys.map((k) => [k, 0]));
  const openedByDay = new Map<number, number>(dayKeys.map((k) => [k, 0]));

  const perPerson = new Map<
    ID,
    { closed: number; overdue: number; onTime: number; eligible: number }
  >();
  for (const id of userIds) {
    perPerson.set(id, { closed: 0, overdue: 0, onTime: 0, eligible: 0 });
  }

  for (const task of Object.values(state.tasks)) {
    const mine = userIds.has(task.ownerId);
    const row = perPerson.get(task.ownerId);

    // Opened / closed come off the append-only history, not off current fields.
    for (const ev of task.history) {
      if (!userIds.has(ev.actorId) && !(ev.toUserId && userIds.has(ev.toUserId))) continue;
      if (!inRange(ev.at)) continue;
      if (ev.type !== 'created' && ev.type !== 'reopened') continue;
      opened += 1;
      const key = startOfDay(new Date(ev.at)).getTime();
      if (openedByDay.has(key)) openedByDay.set(key, (openedByDay.get(key) ?? 0) + 1);
    }

    if (task.completedAt && inRange(task.completedAt) && mine) {
      closed += 1;
      if (row) row.closed += 1;
      const key = startOfDay(new Date(task.completedAt)).getTime();
      if (closedByDay.has(key)) closedByDay.set(key, (closedByDay.get(key) ?? 0) + 1);
      if (task.dueAt) {
        onTimeEligible += 1;
        if (row) row.eligible += 1;
        if (new Date(task.completedAt) <= new Date(task.dueAt)) {
          onTimeClosed += 1;
          if (row) row.onTime += 1;
        }
      }
    }

    if (mine && !task.completedAt) {
      const s = derivedStatus(task, now);
      if (s === 'overdue') {
        openLoad.overdue += 1;
        if (row) row.overdue += 1;
      } else if (s === 'unscheduled') openLoad.unscheduled += 1;
      else openLoad.due += 1;
    }
  }

  return {
    closed,
    opened,
    onTimeRate: onTimeEligible ? onTimeClosed / onTimeEligible : null,
    onTimeClosed,
    onTimeEligible,
    openLoad,
    byDay: dayKeys.map((k) => ({
      day: new Date(k),
      closed: closedByDay.get(k) ?? 0,
      opened: openedByDay.get(k) ?? 0,
    })),
    perPerson: [...perPerson.entries()]
      .map(([userId, r]) => ({
        userId,
        closed: r.closed,
        overdue: r.overdue,
        onTimeRate: r.eligible ? r.onTime / r.eligible : null,
      }))
      .sort((a, b) => b.closed - a.closed),
  };
}

/** The home region: last seven days for one user, computed on the spot. §3 */
export function lastSevenDays(state: RunwayState, userId: ID, now = new Date()) {
  const to = now;
  const from = startOfDay(addDays(now, -6));
  return measure(state, new Set([userId]), from, to, now);
}

export const pct = (rate: number | null): string =>
  rate === null ? '—' : `${Math.round(rate * 100)}%`;
