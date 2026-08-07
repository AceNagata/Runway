import { useState } from 'react';
import { Inbox } from 'lucide-react';
import {
  Avatar,
  Button,
  Dialog,
  EmptyState,
  Field,
  ICON,
  Input,
  Mono,
  Select,
  useToast,
} from '../ui';
import { useStore } from '../../store/StoreContext';
import { handoffTargets, subtree } from '../../domain/org';
import { scheduleBlockedReason } from '../../domain/tasks';
import { atHour, clock, fromLocalInput, relDay, toLocalInput } from '../../lib/time';
import type { Task } from '../../store/types';

/* Buttons are verb-first and specific; errors state the problem and the fix. */

export function AddTaskDialog({
  onClose,
  presetFolderId,
  presetDueAt,
}: {
  onClose: () => void;
  presetFolderId?: string | null;
  presetDueAt?: string | null;
}) {
  const { state, me, dispatch } = useStore();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [folderId, setFolderId] = useState(presetFolderId ?? '');
  const [ownerId, setOwnerId] = useState(me.id);
  const [dueAt, setDueAt] = useState(
    toLocalInput(presetDueAt ?? atHour(new Date(), 17)),
  );
  const [priority, setPriority] = useState<Task['priority']>('mid');
  const [error, setError] = useState<string | null>(null);

  // You can assign to anyone in your subtree; ownership never moves sideways or up.
  const assignable = subtree(state, me.id);

  const submit = () => {
    if (!title.trim()) {
      setError('A task needs a title before you can add it.');
      return;
    }
    dispatch({
      type: 'task/create',
      draft: {
        title: title.trim(),
        body: body.trim(),
        folderId: folderId || null,
        ownerId,
        dueAt: fromLocalInput(dueAt),
        priority,
      },
    });
    toast(
      ownerId === me.id
        ? `Added ${title.trim()}.`
        : `Added ${title.trim()} and assigned it to ${state.users[ownerId].name}.`,
    );
    onClose();
  };

  return (
    <Dialog
      title="Add task"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Add task
          </Button>
        </>
      }
    >
      <Field label="Title">
        <Input
          value={title}
          placeholder="What needs doing"
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </Field>

      <Field label="Body" hint="Optional. Context the owner will need.">
        <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'var(--sp-5)' }}>
        <Field label="Due" hint="A task with no due date lives in the unscheduled bucket.">
          <Input
            type="datetime-local"
            className="input-mono"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </Field>
        <Field label="Owner">
          <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {assignable.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === me.id ? `${u.name} (you)` : u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Folder">
          <Select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">No folder</option>
            {Object.values(state.folders).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task['priority'])}
          >
            <option value="high">High</option>
            <option value="mid">Medium</option>
            <option value="low">Low</option>
          </Select>
        </Field>
      </div>

      {error && (
        <p className="tone-overdue" style={{ fontSize: 'var(--fs-sm)' }}>
          {error}
        </p>
      )}
    </Dialog>
  );
}

/** Hand-off moves ownership down the tree. No accept step: the task appears in their
 *  list immediately and the due date travels with it. §4 */
export function HandOffDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const targets = handoffTargets(state, task);
  const [toUserId, setToUserId] = useState(targets[0]?.id ?? '');

  return (
    <Dialog
      title="Hand off"
      onClose={onClose}
      actions={
        targets.length > 0 && (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                dispatch({ type: 'task/handoff', id: task.id, toUserId });
                toast(`Handed ${task.title} to ${state.users[toUserId].name}.`);
                onClose();
              }}
            >
              Assign to {state.users[toUserId]?.name.split(' ')[0]}
            </Button>
          </>
        )
      }
    >
      {targets.length === 0 ? (
        <EmptyState
          icon={<Inbox size={24} {...ICON} />}
          line={`${state.users[task.ownerId].name} has nobody reporting to them, so this task has nowhere to go down.`}
        />
      ) : (
        <>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
            {task.dueAt
              ? `The due date travels with the task — it stays at ${clock(task.dueAt)} ${relDay(task.dueAt).toLowerCase()}. You stay on the chain of custody.`
              : 'This task has no due date. You stay on the chain of custody either way.'}
          </p>
          <div className="rows">
            {targets.map((u) => (
              <div
                key={u.id}
                className={`row ${u.id === toUserId ? 'selected' : ''}`}
                onClick={() => setToUserId(u.id)}
              >
                <Avatar user={u} size="sm" decorative />
                <span className="row-main">
                  <span className="row-title">{u.name}</span>
                  <span className="row-sub">{u.role}</span>
                </span>
                <Mono className="faint">
                  {
                    Object.values(state.tasks).filter((t) => t.ownerId === u.id && !t.completedAt)
                      .length
                  }{' '}
                  open
                </Mono>
              </div>
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
}

/** Same write as dragging the block in the calendar. §2.3 */
export function RescheduleDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const blocked = scheduleBlockedReason(task);
  const base = task.scheduledStart ?? task.dueAt ?? atHour(new Date(), 9);
  const [start, setStart] = useState(toLocalInput(base));
  const [minutes, setMinutes] = useState(
    task.scheduledStart && task.scheduledEnd
      ? Math.round(
          (new Date(task.scheduledEnd).getTime() - new Date(task.scheduledStart).getTime()) / 60_000,
        )
      : 60,
  );

  return (
    <Dialog
      title={task.scheduledStart ? 'Reschedule' : 'Put it on the calendar'}
      onClose={onClose}
      actions={
        !blocked && (
          <>
            {task.scheduledStart && (
              <Button
                variant="ghost"
                onClick={() => {
                  dispatch({ type: 'task/unschedule', id: task.id });
                  toast(`Took ${task.title} off the calendar.`);
                  onClose();
                }}
              >
                Take it off the calendar
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => {
                const startIso = fromLocalInput(start);
                if (!startIso) return;
                const endIso = new Date(new Date(startIso).getTime() + minutes * 60_000).toISOString();
                dispatch({ type: 'task/schedule', id: task.id, startIso, endIso });
                toast(`Scheduled ${task.title} for ${clock(startIso)} ${relDay(startIso).toLowerCase()}.`);
                onClose();
              }}
            >
              Save schedule
            </Button>
          </>
        )
      }
    >
      {blocked ? (
        <p className="tone-overdue" style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5 }}>
          {blocked}
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'var(--sp-5)' }}>
          <Field label="Starts">
            <Input
              type="datetime-local"
              className="input-mono"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="Length">
            <Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} minutes` : `${m / 60} ${m === 60 ? 'hour' : 'hours'}`}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
    </Dialog>
  );
}
