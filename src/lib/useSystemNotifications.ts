import { useEffect, useRef } from 'react';
import { useStore } from '../store/StoreContext';
import { pendingReminders } from '../domain/reminders';
import { notificationSupport, showSystemNotification } from './notify';

/** How many system notifications one pass may raise. A user returning to a neglected board
 *  gets the most urgent few, not thirty alerts. The rest still land in the in-app list. */
const MAX_PER_PASS = 3;

/** Two jobs, both driven by the shared clock:
 *
 *  1. Watch the current user's due dates and raise reminders as they approach and pass.
 *  2. Hand any unsurfaced notification for that user to the operating system, exactly once.
 *
 *  Both are effects rather than reducer side-effects, so the store stays pure. */
export function useSystemNotifications(now: Date) {
  const { state, me, dispatch } = useStore();
  const surfacing = useRef(false);

  // 1 — deadlines. Runs on every clock tick; the reminder keys make it idempotent.
  useEffect(() => {
    const due = pendingReminders(state, me.id, now);
    for (const r of due) {
      dispatch({ type: 'notif/remind', taskId: r.taskId, kind: r.kind, text: r.text, key: r.key });
    }
  }, [state, me.id, now, dispatch]);

  // 2 — delivery. Anything unsurfaced and addressed to the signed-in user goes out once.
  //     Keyed on the clock as well as the notification set, because permission can be granted
  //     — or revoked in browser settings — without the store changing at all. Anything
  //     already queued then goes out on the next tick rather than waiting for a new event.
  useEffect(() => {
    if (notificationSupport() !== 'granted' || surfacing.current) return;

    const fresh = Object.values(state.notifications)
      .filter((n) => n.forUserId === me.id && !n.surfaced)
      .sort((a, b) => (a.at < b.at ? -1 : 1));
    if (fresh.length === 0) return;

    surfacing.current = true;
    const batch = fresh.slice(0, MAX_PER_PASS);
    void (async () => {
      for (const n of batch) {
        await showSystemNotification({
          id: n.id,
          title: n.kind === 'assigned' ? 'New task for you' : 'Runway',
          body: n.text,
          taskId: n.taskId,
          // One live notification per task, so a task never stacks up alerts.
          tag: n.taskId ?? n.id,
        });
      }
      // Mark the whole set, not just the batch: the overflow is in the in-app list and
      // should not queue up to fire later.
      dispatch({ type: 'notif/surfaced', ids: fresh.map((n) => n.id) });
      surfacing.current = false;
    })();
  }, [state.notifications, me.id, now, dispatch]);
}
