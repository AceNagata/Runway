import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, FolderOpen, Inbox, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState, Eyebrow, ICON, Mono } from '../components/ui';
import { TaskRow } from '../components/TaskRow';
import { NoteCard } from './Notes';
import { AddTaskDialog } from '../components/shell/TaskDialogs';
import { DeleteFolderDialog, EditFolderDialog } from '../components/shell/FolderDialogs';
import { useStore } from '../store/StoreContext';
import { visibleTaskIds } from '../domain/org';
import { GROUP_LABEL, groupOf, taskList, type TaskGroupId } from '../domain/tasks';
import type { Task } from '../store/types';

const GROUP_ORDER: TaskGroupId[] = ['overdue', 'today', 'later', 'unscheduled', 'done'];

/** A folder is a place, not a filter: it carries its own tasks and its own notes on one
 *  screen, so "everything about the Q3 roadmap" is one destination rather than two filtered
 *  views. Folders label work — deleting one never deletes what is inside it. */
export function Folder({
  now,
  selectedId,
  onOpenTask,
  onCloseTask,
}: {
  now: Date;
  selectedId: string | null;
  onOpenTask: (id: string) => void;
  onCloseTask: () => void;
}) {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { state, me, dispatch } = useStore();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const folder = folderId ? state.folders[folderId] : undefined;

  const { groups, openCount, doneCount, notes } = useMemo(() => {
    if (!folder) return { groups: [], openCount: 0, doneCount: 0, notes: [] };
    const inFolder = taskList(state, visibleTaskIds(state, me.id)).filter(
      (t) => t.folderId === folder.id,
    );
    const map = new Map<TaskGroupId, Task[]>();
    for (const t of inFolder) {
      const g = groupOf(t, now);
      if (g === 'done' && !showDone) continue;
      map.set(g, [...(map.get(g) ?? []), t]);
    }
    return {
      groups: GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ id: g, rows: map.get(g)! })),
      openCount: inFolder.filter((t) => !t.completedAt).length,
      doneCount: inFolder.filter((t) => t.completedAt).length,
      notes: Object.values(state.notes)
        .filter((n) => n.folderId === folder.id && (n.ownerId === me.id || n.shared))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    };
  }, [folder, state, me.id, now, showDone]);

  if (!folder) {
    return (
      <div className="screen rise">
        <Card>
          <EmptyState
            icon={<ArrowLeft size={24} {...ICON} />}
            line="That folder is no longer here."
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
                Back to tasks
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="screen screen-wide rise">
      <div className="screen-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', minWidth: 0 }}>
          <Eyebrow>Folder</Eyebrow>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
            <span className={`dot dot-${folder.tone}`} style={{ width: 8, height: 8, flexBasis: 8 }} />
            <h2 className="h2">{folder.name}</h2>
          </span>
          <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {openCount} open {openCount === 1 ? 'task' : 'tasks'}
            {doneCount > 0 && `, ${doneCount} closed`} · {notes.length}{' '}
            {notes.length === 1 ? 'note' : 'notes'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus size={16} {...ICON} />
            Add task
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/notes/new?folder=${folder.id}`)}
          >
            <FileText size={16} {...ICON} />
            Take a note
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={16} {...ICON} />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleting(true)} aria-label="Delete folder">
            <Trash2 size={16} {...ICON} />
          </Button>
        </div>
      </div>

      {/* Tasks */}
      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox size={24} {...ICON} />}
            line={
              openCount === 0 && doneCount > 0
                ? 'Everything in this folder is closed.'
                : 'No tasks in this folder yet.'
            }
            action={
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
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
                    onOpen={() => (t.id === selectedId ? onCloseTask() : onOpenTask(t.id))}
                    onToggle={() =>
                      dispatch({ type: t.completedAt ? 'task/reopen' : 'task/complete', id: t.id })
                    }
                    showFolder={false}
                  />
                ))}
              </div>
            </Card>
          </div>
        ))
      )}

      {doneCount > 0 && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Hide closed tasks' : `Show ${doneCount} closed`}
          </Button>
        </div>
      )}

      {/* Notes in the same folder, on the same screen. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
        <div className="group-head">
          <Eyebrow>Notes</Eyebrow>
          <Mono className="faint">{notes.length}</Mono>
          <span className="group-rule" />
        </div>
        {notes.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FolderOpen size={24} {...ICON} />}
              line="Nothing written down here yet."
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/notes/new?folder=${folder.id}`)}
                >
                  <Plus size={16} {...ICON} />
                  Take a note
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="note-grid">
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} onOpen={() => navigate(`/notes/${n.id}`)} />
            ))}
          </div>
        )}
      </div>

      {adding && <AddTaskDialog onClose={() => setAdding(false)} presetFolderId={folder.id} />}
      {editing && <EditFolderDialog folder={folder} onClose={() => setEditing(false)} />}
      {deleting && (
        <DeleteFolderDialog
          folder={folder}
          taskCount={openCount + doneCount}
          noteCount={notes.length}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate('/tasks')}
        />
      )}
    </div>
  );
}
