import { dayDiff, startOfDay } from '../lib/time';
import type { ID, RunwayState, StatusTone, Task } from '../store/types';

/** Status is derived wherever it can be: a task past its due time with no completion is
 *  overdue without anyone setting it so. §2.2 */
export type DerivedStatus = 'done' | 'overdue' | 'due-today' | 'scheduled' | 'unscheduled';

export function derivedStatus(task: Task, now = new Date()): DerivedStatus {
  if (task.completedAt) return 'done';
  if (task.dueAt) {
    const due = new Date(task.dueAt);
    if (due.getTime() < now.getTime()) return 'overdue';
    if (dayDiff(due, now) === 0) return 'due-today';
    return 'scheduled';
  }
  return task.scheduledStart ? 'scheduled' : 'unscheduled';
}

/** Status is never carried by colour alone — every tone pairs with this label. §7 */
export const STATUS_LABEL: Record<DerivedStatus, string> = {
  done: 'Done',
  overdue: 'Overdue',
  'due-today': 'Due today',
  scheduled: 'Scheduled',
  unscheduled: 'Unscheduled',
};

export const STATUS_TONE: Record<DerivedStatus, StatusTone> = {
  done: 'done',
  overdue: 'overdue',
  'due-today': 'due',
  scheduled: 'idle',
  unscheduled: 'idle',
};

export function isToday(iso: string | null, now = new Date()): boolean {
  return iso ? dayDiff(new Date(iso), now) === 0 : false;
}

/** Due or scheduled today. Home shows these plus overdue items and nothing else
 *  past-dated. §3 */
export function isOnToday(task: Task, now = new Date()): boolean {
  return isToday(task.dueAt, now) || isToday(task.scheduledStart, now);
}

export type TaskGroupId = 'overdue' | 'today' | 'later' | 'unscheduled' | 'done';

export const GROUP_LABEL: Record<TaskGroupId, string> = {
  overdue: 'Overdue',
  today: 'Today',
  later: 'Later',
  unscheduled: 'Unscheduled',
  done: 'Done',
};

export function groupOf(task: Task, now = new Date()): TaskGroupId {
  const s = derivedStatus(task, now);
  if (s === 'done') return 'done';
  if (s === 'overdue') return 'overdue';
  if (s === 'due-today') return 'today';
  if (s === 'unscheduled') return 'unscheduled';
  return isToday(task.scheduledStart, now) ? 'today' : 'later';
}

/** Overdue first, then by the time they land, then by title. */
export function sortTasks(a: Task, b: Task): number {
  const key = (t: Task) =>
    t.dueAt ?? t.scheduledStart ?? '9999-12-31T00:00:00.000Z';
  const ka = key(a);
  const kb = key(b);
  if (ka !== kb) return ka < kb ? -1 : 1;
  return a.title.localeCompare(b.title);
}

export function taskList(state: RunwayState, ids: Iterable<ID>): Task[] {
  const out: Task[] = [];
  for (const id of ids) {
    const t = state.tasks[id];
    if (t) out.push(t);
  }
  return out.sort(sortTasks);
}

/** What the user is on next: their next scheduled block from today onward, else the most
 *  urgent overdue task. Null when they own nothing waiting. */
export function nextScheduled(
  state: RunwayState,
  userId: ID,
  now = new Date(),
): Task | null {
  const mine = Object.values(state.tasks).filter(
    (t) => t.ownerId === userId && !t.completedAt,
  );
  const upcoming = mine
    .filter((t) => t.scheduledStart && new Date(t.scheduledStart) >= startOfDay(now))
    .sort((a, b) => (a.scheduledStart! < b.scheduledStart! ? -1 : 1));
  if (upcoming.length) return upcoming[0];
  const overdue = mine.filter((t) => derivedStatus(t, now) === 'overdue').sort(sortTasks);
  if (overdue.length) return overdue[0];
  return null;
}

/** A scheduled task cannot be placed on the calendar without a due date. §2.2 */
export function scheduleBlockedReason(task: Task): string | null {
  return task.dueAt
    ? null
    : 'This task needs a due date before you can schedule it.';
}

/** Side-by-side lanes for overlapping blocks — overlaps are permitted, never blocked. §2.3 */
export function layoutDay(tasks: Task[]): Array<{ task: Task; lane: number; lanes: number }> {
  const blocks = tasks
    .filter((t) => t.scheduledStart && t.scheduledEnd)
    .sort((a, b) => (a.scheduledStart! < b.scheduledStart! ? -1 : 1));
  const laneEnds: number[] = [];
  const placed = blocks.map((task) => {
    const start = new Date(task.scheduledStart!).getTime();
    const end = new Date(task.scheduledEnd!).getTime();
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    return { task, lane, start, end };
  });
  // Cluster width: every block in an overlapping run shares the same lane count.
  return placed.map((p) => {
    const overlapping = placed.filter((q) => q.start < p.end && q.end > p.start);
    const lanes = Math.max(...overlapping.map((q) => q.lane)) + 1;
    return { task: p.task, lane: p.lane, lanes };
  });
}

/** Chain of custody, oldest first. Hand-off does not clear the originator. §4 */
export function custodyChain(state: RunwayState, task: Task): Array<{ userId: ID; at: string }> {
  const chain: Array<{ userId: ID; at: string }> = [
    { userId: task.originatorId, at: task.createdAt },
  ];
  for (const e of task.history) {
    if ((e.type === 'assigned' || e.type === 'reassigned') && e.toUserId) {
      if (chain[chain.length - 1].userId !== e.toUserId) {
        chain.push({ userId: e.toUserId, at: e.at });
      }
    }
  }
  // A removed member drops out of the display chain; the history keeps the record.
  return chain.filter((link) => !!state.users[link.userId]);
}
