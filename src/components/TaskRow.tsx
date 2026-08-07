import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { Avatar, Check2, Chip, ICON, Mono } from './ui';
import { derivedStatus, STATUS_TONE } from '../domain/tasks';
import { clockRange, clock, lateness, relDay } from '../lib/time';
import { useStore } from '../store/StoreContext';
import type { StatusTone, Task } from '../store/types';

/** How the time column reads for a task, and in which tone. Every colour here is
 *  paired with text that says the same thing. */
export function timeRead(task: Task, now = new Date()): { text: string; tone: StatusTone } {
  if (task.completedAt) return { text: `Done ${clock(task.completedAt)}`, tone: 'done' };
  const status = derivedStatus(task, now);
  if (status === 'overdue') return { text: lateness(task.dueAt!, now), tone: 'overdue' };
  if (task.scheduledStart && task.scheduledEnd) {
    return {
      text: clockRange(task.scheduledStart, task.scheduledEnd),
      tone: status === 'due-today' ? 'due' : 'idle',
    };
  }
  if (task.dueAt) {
    const day = relDay(task.dueAt, now);
    return {
      text: status === 'due-today' ? clock(task.dueAt) : `${day} ${clock(task.dueAt)}`,
      tone: status === 'due-today' ? 'due' : 'idle',
    };
  }
  return { text: 'No due date', tone: 'idle' };
}

export function TaskRow({
  task,
  now,
  selected,
  cursor,
  onOpen,
  onToggle,
  showFolder = true,
  showTag = true,
}: {
  task: Task;
  now: Date;
  selected?: boolean;
  cursor?: boolean;
  onOpen: () => void;
  onToggle: () => void;
  showFolder?: boolean;
  showTag?: boolean;
}) {
  const { state } = useStore();
  const done = !!task.completedAt;
  const status = derivedStatus(task, now);
  const tone = STATUS_TONE[status];
  const time = timeRead(task, now);
  const owner = state.users[task.ownerId];
  const folder = task.folderId ? state.folders[task.folderId] : null;

  // The one flourish: the strike wipes left-to-right, then the row settles at 40%.
  const wasDone = useRef(done);
  const [wiping, setWiping] = useState(false);
  useEffect(() => {
    if (done && !wasDone.current) {
      setWiping(true);
      const id = window.setTimeout(() => setWiping(false), 220);
      wasDone.current = done;
      return () => clearTimeout(id);
    }
    wasDone.current = done;
  }, [done]);

  return (
    <div
      className={`row ${selected ? 'selected' : ''} ${cursor ? 'cursor' : ''} ${done ? 'done' : ''}`}
      role="button"
      tabIndex={-1}
      aria-label={task.title}
      onClick={onOpen}
      data-task-id={task.id}
    >
      {!done && tone !== 'idle' && <span className={`folder-tab folder-tab--narrow tab-${tone}`} />}
      <div className="check">
        <Check2
          checked={done}
          onChange={onToggle}
          label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        />
        <span className="row-main">
          <span className="row-title">
            {task.title}
            <span className={`strike ${wiping ? 'on' : done ? 'settled' : ''}`} />
          </span>
          {showFolder && (folder || task.sourceNoteId) && (
            <span className="row-sub">
              {folder && (
                <>
                  <span className={`dot dot-${folder.tone}`} />
                  {folder.name}
                </>
              )}
              {task.sourceNoteId && state.notes[task.sourceNoteId] && (
                <>
                  <FileText size={12} {...ICON} />
                  From a note
                </>
              )}
            </span>
          )}
        </span>
      </div>

      {showTag && (
        <span className="sr-only">{`Status: ${status}`}</span>
      )}
      {showTag && status !== 'done' && status !== 'scheduled' && (
        <Chip tone={tone}>{status === 'overdue' ? 'Overdue' : status === 'due-today' ? 'Due today' : 'Unscheduled'}</Chip>
      )}
      <Mono className={`row-time tone-${time.tone}`}>{time.text}</Mono>
      {owner && <Avatar user={owner} size="xs" />}
    </div>
  );
}
