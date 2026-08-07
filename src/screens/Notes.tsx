import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Plus, Users } from 'lucide-react';
import { Button, Card, Chip, EmptyState, Eyebrow, ICON, Mono } from '../components/ui';
import { useStore } from '../store/StoreContext';
import { absDate, relDay } from '../lib/time';
import type { Note } from '../store/types';

/** Notes are the capture surface: a card grid over folders, with one action to start a new
 *  one. Nothing here requires a title, a folder, or a save. §2.1 */
export function Notes() {
  const { state, me } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [showArchive, setShowArchive] = useState(false);
  const folderId = params.get('folder');

  const mine = useMemo(
    () =>
      Object.values(state.notes)
        .filter((n) => n.ownerId === me.id || n.shared)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [state.notes, me.id],
  );

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const n of mine) {
      if (n.archived) continue;
      const key = n.folderId ?? 'none';
      c.set(key, (c.get(key) ?? 0) + 1);
    }
    return c;
  }, [mine]);

  const visible = mine.filter(
    (n) => n.archived === showArchive && (!folderId || n.folderId === folderId),
  );

  // The editor route owns creation, so a new note exists the moment it is on screen.
  const createNote = () => navigate(folderId ? `/notes/new?folder=${folderId}` : '/notes/new');

  const railItem = (
    key: string,
    label: string,
    tone: string,
    count: number,
    active: boolean,
    onClick: () => void,
  ) => (
    <button
      key={key}
      className="folder-link"
      onClick={onClick}
      style={
        active
          ? { background: 'var(--surface-hover)', color: 'var(--text-strong)' }
          : undefined
      }
    >
      <span className={`dot dot-${tone}`} />
      {label}
      <Mono style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>
        {count}
      </Mono>
    </button>
  );

  return (
    <div className="screen screen-wide rise">
      <div className="screen-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <Eyebrow>Notes</Eyebrow>
          <span className="h3">
            {visible.length} {visible.length === 1 ? 'note' : 'notes'}
            {showArchive ? ' in the archive' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
          <Button variant="ghost" size="sm" onClick={() => setShowArchive((v) => !v)}>
            {showArchive ? 'Back to your notes' : 'Show the archive'}
          </Button>
          <Button variant="secondary" size="sm" onClick={createNote}>
            <Plus size={16} {...ICON} />
            Take a note
          </Button>
        </div>
      </div>

      <div className="notes-layout">
        <div className="notes-rail">
          <Eyebrow>Folders</Eyebrow>
          {railItem('all', 'All notes', 'accent', mine.filter((n) => !n.archived).length, !folderId, () =>
            setParams(new URLSearchParams(), { replace: true }),
          )}
          {Object.values(state.folders).map((f) =>
            railItem(
              f.id,
              f.name,
              f.tone,
              counts.get(f.id) ?? 0,
              folderId === f.id,
              () => setParams(new URLSearchParams({ folder: f.id }), { replace: true }),
            ),
          )}
          {railItem(
            'none',
            'No folder',
            'idle',
            counts.get('none') ?? 0,
            folderId === 'none',
            () => setParams(new URLSearchParams({ folder: 'none' }), { replace: true }),
          )}
        </div>

        <div className="note-grid">
          {visible.map((n) => (
            <NoteCard key={n.id} note={n} onOpen={() => navigate(`/notes/${n.id}`)} />
          ))}

          {!showArchive && (
            <button className="dashed note-card" onClick={createNote} style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={24} {...ICON} className="faint" />
              <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                Take a note
              </span>
            </button>
          )}

          {visible.length === 0 && showArchive && (
            <Card>
              <EmptyState icon={<FileText size={24} {...ICON} />} line="The archive is empty." />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export function NoteCard({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const { state, me } = useStore();
  const folder = note.folderId ? state.folders[note.folderId] : null;
  const lines = note.body.split('\n').filter((l) => l.trim());
  const title = note.title || lines[0]?.slice(0, 60) || 'Untitled note';
  const excerpt = (note.title ? lines : lines.slice(1)).join(' ');
  const openTasks = note.promotions.filter((p) => state.tasks[p.taskId] && !state.tasks[p.taskId].completedAt).length;

  return (
    <button className="card note-card" onClick={onOpen}>
      <span className={`folder-tab left tab-${folder?.tone ?? 'idle'}`} />
      <span className="h3" style={{ textWrap: 'pretty' }}>
        {title}
      </span>
      {excerpt ? (
        <span className="note-excerpt">{excerpt}</span>
      ) : (
        <span className="note-excerpt faint">Empty note.</span>
      )}
      <span className="note-foot">
        <Mono className="faint">{absDate(note.updatedAt)}</Mono>
        {folder && <Chip tone={folder.tone}>{folder.name}</Chip>}
        {note.shared && note.ownerId !== me.id && (
          <span className="badge">
            <Users size={12} {...ICON} />
            {state.users[note.ownerId]?.name.split(' ')[0]}
          </span>
        )}
        {openTasks > 0 && <span className="badge">{openTasks} open</span>}
      </span>
      <span className="sr-only">{`Edited ${relDay(note.updatedAt).toLowerCase()}`}</span>
    </button>
  );
}
