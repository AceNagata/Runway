import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FileText, ListChecks, SearchX } from 'lucide-react';
import { EmptyState, ICON, Mono, useEscape } from '../ui';
import { useStore } from '../../store/StoreContext';
import { visibleTaskIds } from '../../domain/org';
import { derivedStatus, STATUS_LABEL, STATUS_TONE } from '../../domain/tasks';
import { relDay } from '../../lib/time';

/** Notes are searchable by body text alongside tasks in one result set — the user does
 *  not choose which index to search. §2.1 */
interface Hit {
  id: string;
  kind: 'task' | 'note';
  title: string;
  sub: string;
  tone: string;
  to: string;
}

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const { state, me } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEscape(onClose);

  useEffect(() => inputRef.current?.focus(), []);

  const hits = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase();
    const visible = visibleTaskIds(state, me.id);
    const out: Hit[] = [];

    for (const id of visible) {
      const t = state.tasks[id];
      if (!t) continue;
      const hay = `${t.title} ${t.body}`.toLowerCase();
      if (needle && !hay.includes(needle)) continue;
      const status = derivedStatus(t);
      out.push({
        id: t.id,
        kind: 'task',
        title: t.title,
        sub: `${STATUS_LABEL[status]}${t.dueAt ? ` · ${relDay(t.dueAt)}` : ''} · ${state.users[t.ownerId]?.name ?? 'Unassigned'}`,
        tone: STATUS_TONE[status],
        to: `/tasks?task=${t.id}`,
      });
    }

    for (const n of Object.values(state.notes)) {
      // A note is visible to its owner, and to the team when shared.
      if (n.ownerId !== me.id && !n.shared) continue;
      const hay = `${n.title} ${n.body}`.toLowerCase();
      if (needle && !hay.includes(needle)) continue;
      const firstLine = n.body.split('\n').find((l) => l.trim()) ?? '';
      out.push({
        id: n.id,
        kind: 'note',
        title: n.title || firstLine.slice(0, 60) || 'Untitled note',
        sub: `Note · edited ${relDay(n.updatedAt).toLowerCase()}${n.shared ? ' · shared' : ''}`,
        tone: n.folderId ? state.folders[n.folderId]?.tone ?? 'idle' : 'idle',
        to: `/notes/${n.id}`,
      });
    }

    return out.slice(0, 40);
  }, [q, state, me.id]);

  useEffect(() => setCursor(0), [q]);

  const go = (hit: Hit) => {
    navigate(hit.to);
    onClose();
  };

  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Search tasks and notes">
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Search tasks and notes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, hits.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === 'Enter' && hits[cursor]) {
              go(hits[cursor]);
            }
          }}
        />
        <div className="palette-results">
          {hits.length === 0 ? (
            <EmptyState icon={<SearchX size={24} {...ICON} />} line={`Nothing matches “${q.trim()}”.`} />
          ) : (
            hits.map((h, i) => (
              <button
                key={`${h.kind}-${h.id}`}
                className={`palette-item ${i === cursor ? 'cursor' : ''}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(h)}
              >
                {h.kind === 'task' ? (
                  <ListChecks size={16} {...ICON} className={`tone-${h.tone}`} />
                ) : (
                  <FileText size={16} {...ICON} className="faint" />
                )}
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
                  <span className="row-title">{h.title}</span>
                  <span className="row-sub">{h.sub}</span>
                </span>
                {i === cursor && <Mono className="faint" style={{ marginLeft: 'auto' }}>↵</Mono>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
