import { clock, relDay } from '../lib/time';
import { derivedStatus } from './tasks';
import type { ID, ReminderKind, RunwayState } from '../store/types';

/** "Something you own is approaching or past its due time" is one of the three notification
 *  classes. §2.4 This derives those events from due dates — nothing is scheduled or stored
 *  ahead of time, so a due date that moves simply re-arms the reminder. */

/** How long before a due time counts as "approaching". */
export const SOON_MS = 60 * 60 * 1000;

/** A reminder older than this is stale — reopening the app after a week should not replay
 *  last Tuesday's deadlines. */
const STALE_MS = 24 * 60 * 60 * 1000;

export interface PendingReminder {
  taskId: ID;
  kind: ReminderKind;
  key: string;
  text: string;
}

export const reminderKey = (taskId: ID, dueAt: string, kind: ReminderKind) =>
  `${taskId}:${dueAt}:${kind}`;

/** Everything the current user should be told about right now and has not been told yet.
 *  Copy leads with the subject and stops at one sentence. */
export function pendingReminders(
  state: RunwayState,
  userId: ID,
  now = new Date(),
): PendingReminder[] {
  const out: PendingReminder[] = [];

  for (const task of Object.values(state.tasks)) {
    if (task.ownerId !== userId || task.completedAt || !task.dueAt) continue;

    const due = new Date(task.dueAt).getTime();
    const delta = due - now.getTime();

    const consider = (kind: ReminderKind, text: string) => {
      const key = reminderKey(task.id, task.dueAt!, kind);
      if (state.reminders[key]) return;
      out.push({ taskId: task.id, kind, key, text });
    };

    if (delta <= 0) {
      // Past due. Skip anything long gone so a return visit is not a wall of alerts.
      if (-delta > STALE_MS) continue;
      consider('due', `${task.title} is past its due time.`);
    } else if (delta <= SOON_MS) {
      const mins = Math.max(1, Math.round(delta / 60_000));
      consider(
        'soon',
        mins >= 60
          ? `${task.title} is due at ${clock(task.dueAt)}.`
          : `${task.title} is due in ${mins} ${mins === 1 ? 'minute' : 'minutes'}.`,
      );
    }
  }

  // Soonest first, so a capped batch tells the user the most urgent things.
  return out.sort((a, b) => {
    const ta = state.tasks[a.taskId].dueAt ?? '';
    const tb = state.tasks[b.taskId].dueAt ?? '';
    return ta < tb ? -1 : 1;
  });
}

/** The line under a task in the notification list, e.g. "Overdue · Today 17:00". */
export function reminderContext(state: RunwayState, taskId: ID, now = new Date()): string {
  const task = state.tasks[taskId];
  if (!task?.dueAt) return '';
  const status = derivedStatus(task, now);
  return `${status === 'overdue' ? 'Overdue' : 'Due'} · ${relDay(task.dueAt, now)} ${clock(task.dueAt)}`;
}
