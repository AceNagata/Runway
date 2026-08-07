import { useNavigate } from 'react-router-dom';
import { CalendarClock, Plus } from 'lucide-react';
import { Button, ICON, Mono } from '../ui';
import { useStore } from '../../store/StoreContext';
import { derivedStatus, nextScheduled } from '../../domain/tasks';
import { clockRange, relDay } from '../../lib/time';

/** §3 asks for one fixed primary action, reachable without scrolling and never moving.
 *  The spec's action was "Start tracking"; time tracking was removed at the client's
 *  request, so the fixed action is "Add task" — the one thing that is meaningful on every
 *  screen — and the bar still answers "what is next" beside it. */
export function ActionBar({
  now,
  onAddTask,
}: {
  now: Date;
  onAddTask: () => void;
}) {
  const { state, me } = useStore();
  const navigate = useNavigate();
  const next = nextScheduled(state, me.id, now);

  const openCount = Object.values(state.tasks).filter(
    (t) => t.ownerId === me.id && !t.completedAt,
  ).length;

  return (
    <div className="action-bar">
      <CalendarClock size={20} {...ICON} className="faint" />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span className="eyebrow">Up next</span>
        {next ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', minWidth: 0 }}>
            <span className={`dot dot-${derivedStatus(next, now) === 'overdue' ? 'overdue' : 'due'}`} />
            <button
              className="row-title"
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--text-strong)',
              }}
              onClick={() => navigate(`/tasks?task=${next.id}`)}
            >
              {next.title}
            </button>
            {next.scheduledStart && next.scheduledEnd ? (
              <Mono className="faint">
                {relDay(next.scheduledStart, now)} {clockRange(next.scheduledStart, next.scheduledEnd)}
              </Mono>
            ) : (
              next.dueAt && <Mono className="tone-overdue">{relDay(next.dueAt, now)}</Mono>
            )}
          </span>
        ) : (
          <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Nothing scheduled next. Your time is your own.
          </span>
        )}
      </span>

      <Mono className="faint" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
        {openCount} open
      </Mono>
      <Button variant="primary" onClick={onAddTask}>
        <Plus size={16} {...ICON} />
        Add task
      </Button>
    </div>
  );
}
