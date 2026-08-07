import { useNavigate } from 'react-router-dom';
import { BellOff } from 'lucide-react';
import { Button, EmptyState, ICON, Mono, useEscape } from '../ui';
import { AlertSetting } from './AlertSetting';
import { useStore } from '../../store/StoreContext';
import { reminderContext } from '../../domain/reminders';
import { relDay, clock } from '../../lib/time';
import type { NotificationKind } from '../../store/types';

/** Three event classes only, leading with the actor, two sentences maximum,
 *  read-state per user, clearable in bulk. §2.4 */
const KIND_TONE: Record<NotificationKind, string> = {
  assigned: 'dot-accent',
  due: 'dot-due',
  'handed-off-changed': 'dot-done',
};

export function NotificationsPopover({ onClose }: { onClose: () => void }) {
  const { state, me, dispatch } = useStore();
  const navigate = useNavigate();
  useEscape(onClose);

  const mine = Object.values(state.notifications)
    .filter((n) => n.forUserId === me.id)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 12);

  const unread = mine.filter((n) => !n.read).length;

  return (
    <div
      className="popover"
      style={{ top: 'calc(100% + var(--sp-3))', right: 0, width: 360 }}
      role="dialog"
      aria-label="Notifications"
    >
      <div className="popover-head">
        <span className="eyebrow">Notifications</span>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'notif/read-all' })}>
            Mark all read
          </Button>
        )}
      </div>

      {mine.length === 0 ? (
        <EmptyState icon={<BellOff size={24} {...ICON} />} line="Nothing new. You'll hear about work coming your way." />
      ) : (
        <div className="rows">
          {mine.map((n) => (
            <button
              key={n.id}
              className={`notif ${n.read ? 'read' : ''}`}
              onClick={() => {
                dispatch({ type: 'notif/read', id: n.id });
                if (n.taskId && state.tasks[n.taskId]) navigate(`/tasks?task=${n.taskId}`);
                onClose();
              }}
            >
              <span className={`dot ${KIND_TONE[n.kind]}`} style={{ marginTop: 6 }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', minWidth: 0 }}>
                <span className="notif-text">{n.text}</span>
                <Mono className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                  {n.kind === 'due' && n.taskId && state.tasks[n.taskId]
                    ? reminderContext(state, n.taskId)
                    : `${relDay(n.at)} ${clock(n.at)}`}
                </Mono>
              </span>
            </button>
          ))}
        </div>
      )}

      <AlertSetting />
    </div>
  );
}
