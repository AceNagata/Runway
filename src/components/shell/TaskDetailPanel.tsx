import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarClock, FileText, Trash2, UserPlus, X } from 'lucide-react';
import {
  Avatar,
  Button,
  Check2,
  ConfirmDialog,
  ICON,
  IconButton,
  Mono,
  StatusBadge,
  useEscape,
  useToast,
} from '../ui';
import { HandOffDialog, RescheduleDialog } from './TaskDialogs';
import { useStore, useDebouncedCallback } from '../../store/StoreContext';
import { custodyChain, derivedStatus, STATUS_LABEL, STATUS_TONE } from '../../domain/tasks';
import { handoffTargets } from '../../domain/org';
import { absDateShort, clock, clockRange, relDay, relDayTime } from '../../lib/time';
import type { Task, TaskEvent } from '../../store/types';

/** Contextual detail opens in a fixed right-hand panel rather than a new route, so the
 *  list behind it stays in place. §6.1 On mobile this same component is a full route. */

const EVENT_COPY: Record<TaskEvent['type'], string> = {
  created: 'raised this',
  assigned: 'handed it to',
  reassigned: 'handed it to',
  scheduled: 'put it on the calendar',
  unscheduled: 'took it off the calendar',
  'due-changed': 'moved the due date',
  completed: 'closed it',
  reopened: 'reopened it',
};

export function TaskDetailPanel({
  task,
  now,
  onClose,
  /** On mobile the same component is a full route, so it lays out in the centre column
   *  instead of a fixed right-hand panel. §6.2 */
  asRoute = false,
}: {
  task: Task;
  now: Date;
  onClose: () => void;
  asRoute?: boolean;
}) {
  const { state, me, dispatch } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [handingOff, setHandingOff] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [body, setBody] = useState(task.body);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEscape(onClose);

  useEffect(() => setBody(task.body), [task.id, task.body]);

  const saveBody = useDebouncedCallback(
    (value: string) => dispatch({ type: 'task/update', id: task.id, patch: { body: value } }),
    600,
  );

  const status = derivedStatus(task, now);
  const tone = STATUS_TONE[status];
  const owner = state.users[task.ownerId];
  const folder = task.folderId ? state.folders[task.folderId] : null;
  const chain = custodyChain(state, task);
  const canHandOff = handoffTargets(state, task).length > 0;
  const sourceNote = task.sourceNoteId ? state.notes[task.sourceNoteId] : null;
  const done = !!task.completedAt;

  return (
    <aside
      className={asRoute ? 'task-route' : 'panel'}
      aria-label="Task detail"
    >
      <div className="panel-body">
        <div className="panel-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', minWidth: 0 }}>
            <span className="eyebrow">Task detail</span>
            <h2 className="h2" style={{ textWrap: 'pretty' }}>
              {task.title}
            </h2>
          </div>
          <IconButton label={asRoute ? 'Back to tasks' : 'Close task detail'} small onClick={onClose}>
            {asRoute ? <ArrowLeft size={20} {...ICON} /> : <X size={20} {...ICON} />}
          </IconButton>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
          <Check2
            checked={done}
            onChange={() =>
              dispatch({ type: done ? 'task/reopen' : 'task/complete', id: task.id })
            }
            label={done ? 'Reopen this task' : 'Complete this task'}
          />
          <StatusBadge tone={tone}>{STATUS_LABEL[status]}</StatusBadge>
          {task.priority === 'high' && <StatusBadge tone="overdue">High priority</StatusBadge>}
        </div>

        {/* Definition through fill and a hairline seam, never a container border. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            background: 'var(--line-hairline)',
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
          }}
        >
          <DetailRow label="Due">
            {task.dueAt ? (
              <Mono className={status === 'overdue' ? 'tone-overdue' : ''}>
                {relDayTime(task.dueAt, now)}
              </Mono>
            ) : (
              <span className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
                No due date
              </span>
            )}
          </DetailRow>
          <DetailRow label="Scheduled">
            {task.scheduledStart && task.scheduledEnd ? (
              <Mono>
                {relDay(task.scheduledStart, now)} {clockRange(task.scheduledStart, task.scheduledEnd)}
              </Mono>
            ) : (
              <span className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
                Not on the calendar
              </span>
            )}
          </DetailRow>
          <DetailRow label="Owner">
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
              <Avatar user={owner} size="xs" decorative />
              <span style={{ fontSize: "var(--fs-sm)" }}>{owner.name}</span>
            </span>
          </DetailRow>
          <DetailRow label="Folder">
            {folder ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', fontSize: 'var(--fs-sm)' }}>
                <span className={`dot dot-${folder.tone}`} />
                {folder.name}
              </span>
            ) : (
              <span className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
                No folder
              </span>
            )}
          </DetailRow>
          <DetailRow label="Raised">
            <Mono>{relDayTime(task.createdAt, now)}</Mono>
          </DetailRow>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <span className="eyebrow">Notes</span>
          <textarea
            ref={bodyRef}
            className="textarea"
            placeholder="Context the owner will need"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              saveBody(e.target.value);
            }}
          />
          {sourceNote && (
            <button
              className="folder-link"
              onClick={() => navigate(`/notes/${sourceNote.id}`)}
              style={{ minHeight: 32 }}
            >
              <FileText size={16} {...ICON} />
              From {sourceNote.title || 'an untitled note'}
            </button>
          )}
        </div>

        {/* The chain of custody stays on the task and is visible to everyone in it. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <span className="eyebrow">Hand-off</span>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-4)',
              background: 'var(--surface-card)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--sp-5)',
            }}
          >
            {chain.map((link, i) => {
              const u = state.users[link.userId];
              if (!u) return null;
              return (
                <div
                  key={`${link.userId}-${link.at}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-4)',
                    paddingLeft: i === 0 ? 0 : 'var(--sp-5)',
                    borderLeft: i === 0 ? 'none' : '1px solid var(--line-soft)',
                  }}
                >
                  {i > 0 && <ArrowRight size={16} {...ICON} className="faint" />}
                  <Avatar user={u} size="xs" decorative />
                  <span style={{ fontSize: "var(--fs-sm)" }}>{u.name}</span>
                  {i === 0 && <span className="caption">raised it</span>}
                  <Mono className="faint" style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)' }}>
                    {absDateShort(link.at)}
                  </Mono>
                </div>
              );
            })}
          </div>
        </div>

        {/* History is append-only: this is the audit trail, read top-down. */}
        <details>
          <summary
            className="eyebrow"
            style={{ cursor: 'pointer', listStyle: 'none', marginBottom: 'var(--sp-4)' }}
          >
            History · {task.history.length} events
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {[...task.history].reverse().map((e) => {
              const actor = state.users[e.actorId];
              const to = e.toUserId ? state.users[e.toUserId] : null;
              return (
                <div key={e.id} style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'baseline' }}>
                  <Mono className="faint" style={{ fontSize: 'var(--fs-xs)', flex: '0 0 74px' }}>
                    {absDateShort(e.at)} {clock(e.at)}
                  </Mono>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    {actor?.name.split(' ')[0] ?? 'Someone'} {EVENT_COPY[e.type]}
                    {to ? ` ${to.name}` : ''}
                    {e.detail ? ` — ${e.detail}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </details>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <Button
              variant="primary"
              full
              disabled={!canHandOff}
              onClick={() => setHandingOff(true)}
            >
              <UserPlus size={16} {...ICON} />
              Hand off
            </Button>
            <Button variant="secondary" onClick={() => setRescheduling(true)}>
              <CalendarClock size={16} {...ICON} />
              {task.scheduledStart ? 'Reschedule' : 'Schedule'}
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <Button variant="ghost" full onClick={() => navigate('/schedule')}>
              <CalendarClock size={16} {...ICON} />
              Open the week
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(true)} aria-label="Delete task">
              <Trash2 size={16} {...ICON} />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {handingOff && <HandOffDialog task={task} onClose={() => setHandingOff(false)} />}
      {rescheduling && <RescheduleDialog task={task} onClose={() => setRescheduling(false)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete this task"
          consequence={`${task.title} and its ${task.history.length} history events go with it. ${
            task.originatorId !== me.id
              ? `${state.users[task.originatorId]?.name ?? 'The person who raised it'} loses the record too. `
              : ''
          }This cannot be undone.`}
          confirmLabel="Delete task"
          onConfirm={() => {
            dispatch({ type: 'task/delete', id: task.id });
            toast(`Deleted ${task.title}.`);
            onClose();
          }}
          onClose={() => setDeleting(false)}
        />
      )}
    </aside>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--sp-5)',
        padding: 'var(--sp-5) var(--sp-6)',
        background: 'var(--surface-card)',
      }}
    >
      <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
        {label}
      </span>
      {children}
    </div>
  );
}
