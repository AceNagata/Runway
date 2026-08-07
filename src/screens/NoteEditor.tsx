import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Archive, ArchiveRestore, ListPlus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  Check2,
  ConfirmDialog,
  EmptyState,
  Eyebrow,
  ICON,
  Mono,
  Select,
  Switch,
  useToast,
} from '../components/ui';
import { useDebouncedCallback, useStore } from '../store/StoreContext';
import { clock, relDay } from '../lib/time';

/** The capture surface. No title required, no folder required, no save action: the note
 *  autosaves on a debounce and is never in a state the user has to think about. §2.1
 *
 *  Promotion is line-based: the line the cursor sits on becomes a task, keeping a
 *  back-reference to this note, and its completion state reads back here. Notes are plain
 *  text with promotion — no rich structure in v1 (decisions.md Q1). Shared notes are
 *  last-write-wins with no lock (Q2). */
export function NoteEditor({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const { noteId } = useParams<{ noteId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, me, dispatch } = useStore();
  const toast = useToast();

  const createdRef = useRef(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [caretLine, setCaretLine] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // A brand-new note exists the moment the editor is on screen.
  useEffect(() => {
    if (noteId !== 'new' || createdRef.current) return;
    createdRef.current = true;
    const folder = params.get('folder');
    dispatch({ type: 'note/create', folderId: folder === 'none' ? null : folder });
  }, [noteId, params, dispatch]);

  const note = useMemo(() => {
    if (noteId && noteId !== 'new') return state.notes[noteId];
    // Resolve the note the effect above just created.
    return Object.values(state.notes)
      .filter((n) => n.ownerId === me.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  }, [noteId, state.notes, me.id]);

  useEffect(() => {
    if (noteId === 'new' && note) navigate(`/notes/${note.id}`, { replace: true });
  }, [noteId, note, navigate]);

  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const loadedFor = useRef(note?.id);

  useEffect(() => {
    if (note && loadedFor.current !== note.id) {
      loadedFor.current = note.id;
      setTitle(note.title);
      setBody(note.body);
      setSavedAt(null);
      setDirty(false);
    }
  }, [note]);

  const save = useDebouncedCallback((patch: { title?: string; body?: string }) => {
    if (!note) return;
    dispatch({ type: 'note/update', id: note.id, patch });
    setSavedAt(new Date().toISOString());
    setDirty(false);
  }, 700);

  // The textarea grows with its content so the page scrolls, not the field.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 320)}px`;
  }, [body]);

  if (!note) {
    return (
      <div className="screen rise">
        <Card>
          <EmptyState
            icon={<ArrowLeft size={24} {...ICON} />}
            line="That note is no longer here."
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/notes')}>
                Back to notes
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const readOnly = note.ownerId !== me.id && !note.shared;
  const promotedLines = new Set(note.promotions.map((p) => p.lineText));
  const canPromote = caretLine.trim().length > 0 && !promotedLines.has(caretLine.trim());

  const promoteCaretLine = () => {
    const lineText = caretLine.trim();
    if (!lineText || promotedLines.has(lineText)) return;
    dispatch({ type: 'note/promote', noteId: note.id, lineText });
    toast(`Added ${lineText} to your tasks.`);
  };

  const readCaret = (el: HTMLTextAreaElement) => {
    const upto = el.value.slice(0, el.selectionStart);
    const start = upto.lastIndexOf('\n') + 1;
    const end = el.value.indexOf('\n', el.selectionStart);
    setCaretLine(el.value.slice(start, end === -1 ? undefined : end));
  };

  return (
    <div className="screen rise" style={{ maxWidth: 780 }}>
      <div className="screen-head">
        <Button variant="ghost" size="sm" onClick={() => navigate('/notes')}>
          <ArrowLeft size={16} {...ICON} />
          All notes
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
          <span className="save-state" aria-live="polite">
            {dirty ? 'Saving' : savedAt ? `Saved ${clock(savedAt)}` : `Edited ${relDay(note.updatedAt).toLowerCase()}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              dispatch({ type: 'note/archive', id: note.id, archived: !note.archived });
              toast(note.archived ? 'Restored the note.' : 'Archived the note.');
            }}
          >
            {note.archived ? <ArchiveRestore size={16} {...ICON} /> : <Archive size={16} {...ICON} />}
            {note.archived ? 'Restore' : 'Archive'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleting(true)}>
            <Trash2 size={16} {...ICON} />
            Delete
          </Button>
        </div>
      </div>

      <div className="note-editor">
        <input
          className="note-title-input"
          placeholder="Untitled note"
          value={title}
          readOnly={readOnly}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
            save({ title: e.target.value });
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)', flexWrap: 'wrap' }}>
          <Select
            value={note.folderId ?? ''}
            style={{ width: 180 }}
            disabled={readOnly}
            onChange={(e) =>
              dispatch({
                type: 'note/update',
                id: note.id,
                patch: { folderId: e.target.value || null },
              })
            }
          >
            <option value="">No folder</option>
            {Object.values(state.folders).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <Switch
            checked={note.shared}
            onChange={(v) => dispatch({ type: 'note/update', id: note.id, patch: { shared: v } })}
          >
            Shared with your team
          </Switch>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canPromote || readOnly}
            onClick={promoteCaretLine}
            title="Make a task from the line the cursor is on"
          >
            <ListPlus size={16} {...ICON} />
            Make this line a task
          </Button>
          <Mono className="faint">⌘↵</Mono>
        </div>

        <textarea
          ref={bodyRef}
          className="note-body-input"
          placeholder="Start typing. Anything you write is kept as you go."
          value={body}
          readOnly={readOnly}
          onChange={(e) => {
            setBody(e.target.value);
            setDirty(true);
            readCaret(e.target);
            save({ body: e.target.value });
          }}
          onKeyUp={(e) => readCaret(e.currentTarget)}
          onClick={(e) => readCaret(e.currentTarget)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              promoteCaretLine();
            }
          }}
        />

        {/* The note line reflects the task's completion state, and toggling it here is the
            same write as checking the task off anywhere else. §2.1 */}
        {note.promotions.length > 0 && (
          <Card className="card-flush">
            <div style={{ padding: 'var(--sp-7) var(--sp-7) var(--sp-4)' }}>
              <Eyebrow>Tasks from this note</Eyebrow>
            </div>
            <div className="note-lines" style={{ padding: '0 var(--sp-7) var(--sp-6)' }}>
              {note.promotions.map((p) => {
                const task = state.tasks[p.taskId];
                if (!task) return null;
                const done = !!task.completedAt;
                return (
                  <div key={p.taskId} className={`note-line promoted ${done ? 'done' : ''}`}>
                    <Check2
                      checked={done}
                      label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                      onChange={() =>
                        dispatch({ type: done ? 'task/reopen' : 'task/complete', id: task.id })
                      }
                    />
                    <button
                      className="note-line-text"
                      onClick={() => onOpenTask(task.id)}
                      style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}
                    >
                      {p.lineText}
                    </button>
                    <Mono className="faint">
                      {task.dueAt ? relDay(task.dueAt) : 'No due date'}
                    </Mono>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete this note"
          consequence={`The note goes for good.${
            note.promotions.length
              ? ` The ${note.promotions.length} ${note.promotions.length === 1 ? 'task' : 'tasks'} raised from it stay in your list, without their back-reference.`
              : ''
          } This cannot be undone.`}
          confirmLabel="Delete note"
          onConfirm={() => {
            dispatch({ type: 'note/delete', id: note.id });
            navigate('/notes');
          }}
          onClose={() => setDeleting(false)}
        />
      )}
    </div>
  );
}
