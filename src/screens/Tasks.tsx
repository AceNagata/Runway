import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Inbox, Plus, X } from 'lucide-react';
import { Button, Card, EmptyState, Eyebrow, ICON, Mono, Tabs } from '../components/ui';
import { TaskRow } from '../components/TaskRow';
import { useStore } from '../store/StoreContext';
import { visibleTaskIds } from '../domain/org';
import { GROUP_LABEL, groupOf, taskList, type TaskGroupId } from '../domain/tasks';
import type { Task } from '../store/types';

type TabId = 'all' | 'mine' | 'handed' | 'unscheduled' | 'done';

const GROUP_ORDER: TaskGroupId[] = ['overdue', 'today', 'later', 'unscheduled', 'done'];

/** Full keyboard reach for list navigation and task completion. §7 */
const KEY_HELP = 'Use ↑ ↓ to move, space to complete, enter to open, escape to close.';

export function Tasks({
  now,
  selectedId,
  onOpenTask,
  onCloseTask,
  onAddTask,
}: {
  now: Date;
  selectedId: string | null;
  onOpenTask: (id: string) => void;
  onCloseTask: () => void;
  onAddTask: () => void;
}) {
  const { state, me, dispatch } = useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<TabId>('all');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const folderId = params.get('folder');
  const groupFilter = params.get('group') as TaskGroupId | null;
  const folder = folderId ? state.folders[folderId] : null;

  const visible = useMemo(() => {
    const ids = visibleTaskIds(state, me.id);
    return taskList(state, ids);
  }, [state, me.id]);

  const filtered = useMemo(() => {
    let out = visible;
    if (folderId) out = out.filter((t) => t.folderId === folderId);
    if (groupFilter) out = out.filter((t) => groupOf(t, now) === groupFilter);
    if (tab === 'mine') out = out.filter((t) => t.ownerId === me.id);
    if (tab === 'handed')
      // Work you raised that somebody else now owns — the reason the originator stays on it.
      out = out.filter((t) => t.originatorId === me.id && t.ownerId !== me.id);
    if (tab === 'unscheduled') out = out.filter((t) => !t.completedAt && !t.dueAt);
    if (tab === 'done') out = out.filter((t) => t.completedAt);
    else out = out.filter((t) => !t.completedAt || groupFilter === 'done');
    return out;
  }, [visible, folderId, groupFilter, tab, me.id, now]);

  const groups = useMemo(() => {
    const map = new Map<TaskGroupId, Task[]>();
    for (const t of filtered) {
      const g = groupOf(t, now);
      map.set(g, [...(map.get(g) ?? []), t]);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ id: g, rows: map.get(g)! }));
  }, [filtered, now]);

  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  useEffect(() => {
    if (cursor > flat.length - 1) setCursor(Math.max(0, flat.length - 1));
  }, [flat.length, cursor]);

  // Keyboard reach: the list owns the arrow keys while it has focus within.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (!flat.length) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, flat.length - 1));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === ' ') {
        e.preventDefault();
        const t = flat[cursor];
        if (t) dispatch({ type: t.completedAt ? 'task/reopen' : 'task/complete', id: t.id });
      } else if (e.key === 'Enter') {
        const t = flat[cursor];
        if (t) onOpenTask(t.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flat, cursor, dispatch, onOpenTask]);

  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-task-id="${flat[cursor]?.id}"]`,
    );
    row?.scrollIntoView({ block: 'nearest' });
  }, [cursor, flat]);

  const counts = {
    all: visible.filter((t) => !t.completedAt).length,
    mine: visible.filter((t) => t.ownerId === me.id && !t.completedAt).length,
    handed: visible.filter((t) => t.originatorId === me.id && t.ownerId !== me.id && !t.completedAt)
      .length,
    unscheduled: visible.filter((t) => !t.completedAt && !t.dueAt).length,
    done: visible.filter((t) => t.completedAt).length,
  };

  return (
    <div className="screen screen-wide rise" ref={listRef}>
      <div className="screen-head">
        <Tabs<TabId>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'all', label: 'All tasks', count: counts.all },
            { value: 'mine', label: 'Assigned to you', count: counts.mine },
            { value: 'handed', label: 'Handed off', count: counts.handed },
            { value: 'unscheduled', label: 'Unscheduled', count: counts.unscheduled },
            { value: 'done', label: 'Done', count: counts.done },
          ]}
        />
        <Button variant="secondary" size="sm" onClick={onAddTask}>
          <Plus size={16} {...ICON} />
          Add task
        </Button>
      </div>

      {(folder || groupFilter) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
          <span className="badge">
            {folder && <span className={`dot dot-${folder.tone}`} />}
            {folder ? folder.name : GROUP_LABEL[groupFilter!]}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
          >
            <X size={16} {...ICON} />
            Clear filter
          </Button>
        </div>
      )}

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox size={24} {...ICON} />}
            line={
              tab === 'handed'
                ? "You haven't handed anything off. Work you pass down stays here."
                : tab === 'done'
                  ? 'Nothing closed yet in this view.'
                  : "Nothing here. You're all caught up."
            }
            action={
              <Button variant="ghost" size="sm" onClick={onAddTask}>
                <Plus size={16} {...ICON} />
                Add task
              </Button>
            }
          />
        </Card>
      ) : (
        groups.map((g) => (
          <div key={g.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="group-head">
              <Eyebrow>{GROUP_LABEL[g.id]}</Eyebrow>
              <Mono className="faint">{g.rows.length}</Mono>
              <span className="group-rule" />
            </div>
            <Card className="card-flush">
              <div className="rows">
                {g.rows.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    now={now}
                    selected={t.id === selectedId}
                    cursor={flat[cursor]?.id === t.id}
                    onOpen={() => (t.id === selectedId ? onCloseTask() : onOpenTask(t.id))}
                    onToggle={() =>
                      dispatch({ type: t.completedAt ? 'task/reopen' : 'task/complete', id: t.id })
                    }
                  />
                ))}
              </div>
            </Card>
          </div>
        ))
      )}

      <p className="caption">{KEY_HELP}</p>
    </div>
  );
}
