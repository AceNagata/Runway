import { useState } from 'react';
import { Button, ConfirmDialog, Dialog, Field, Input, useToast } from '../ui';
import { useStore } from '../../store/StoreContext';
import type { Folder, StatusTone } from '../../store/types';

/** Folder colour is picked from the closed token set, never a free colour picker — status
 *  and accent hues are the only chroma this product has. */
const TONES: Array<{ tone: StatusTone; label: string }> = [
  { tone: 'accent', label: 'Ember' },
  { tone: 'done', label: 'Grass' },
  { tone: 'due', label: 'Amber' },
  { tone: 'overdue', label: 'Rose' },
  { tone: 'idle', label: 'Chalk' },
];

export function TonePicker({
  value,
  onChange,
}: {
  value: StatusTone;
  onChange: (t: StatusTone) => void;
}) {
  return (
    <div className="field">
      <span className="eyebrow">Colour</span>
      <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }} role="radiogroup" aria-label="Folder colour">
        {TONES.map((t) => (
          <button
            key={t.tone}
            type="button"
            role="radio"
            aria-checked={value === t.tone}
            onClick={() => onChange(t.tone)}
            className="chip"
            style={{
              height: 'var(--control-h)',
              paddingInline: 'var(--sp-5)',
              cursor: 'pointer',
              background: value === t.tone ? 'var(--surface-active)' : 'var(--surface-raised)',
              boxShadow: value === t.tone ? 'inset 0 0 0 1px var(--line-strong)' : 'none',
              color: value === t.tone ? 'var(--text-strong)' : 'var(--text-muted)',
            }}
          >
            <span className={`dot dot-${t.tone}`} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NewFolderDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (name: string) => void;
}) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [tone, setTone] = useState<StatusTone>('accent');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setError('A folder needs a name before you can add it.');
      return;
    }
    dispatch({ type: 'folder/create', name, tone });
    toast(`Added ${name.trim()}.`);
    onCreated?.(name.trim());
    onClose();
  };

  return (
    <Dialog
      title="Add folder"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Add folder
          </Button>
        </>
      }
    >
      <Field label="Name" hint="Tasks and notes both live in folders.">
        <Input
          value={name}
          placeholder="What the work is about"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </Field>
      <TonePicker value={tone} onChange={setTone} />
      {error && (
        <p className="tone-overdue" style={{ fontSize: 'var(--fs-sm)' }}>
          {error}
        </p>
      )}
    </Dialog>
  );
}

export function EditFolderDialog({
  folder,
  onClose,
}: {
  folder: Folder;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [name, setName] = useState(folder.name);
  const [tone, setTone] = useState<StatusTone>(folder.tone);

  return (
    <Dialog
      title={`Edit ${folder.name}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              dispatch({ type: 'folder/update', id: folder.id, patch: { name, tone } });
              toast('Saved the folder.');
              onClose();
            }}
          >
            Save folder
          </Button>
        </>
      }
    >
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <TonePicker value={tone} onChange={setTone} />
    </Dialog>
  );
}

/** Destructive, so the confirmation states exactly what happens to the contents. §6.3 */
export function DeleteFolderDialog({
  folder,
  taskCount,
  noteCount,
  onClose,
  onDeleted,
}: {
  folder: Folder;
  taskCount: number;
  noteCount: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { dispatch } = useStore();
  const toast = useToast();
  const parts = [
    taskCount > 0 && `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`,
    noteCount > 0 && `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`,
  ].filter(Boolean) as string[];

  return (
    <ConfirmDialog
      title={`Delete ${folder.name}`}
      consequence={
        parts.length
          ? `${parts.join(' and ')} stay exactly where they are and lose their folder. Only the label goes.`
          : 'The folder is empty, so only the label goes.'
      }
      confirmLabel="Delete folder"
      onConfirm={() => {
        dispatch({ type: 'folder/delete', id: folder.id });
        toast(`Deleted ${folder.name}.`);
        onDeleted();
      }}
      onClose={onClose}
    />
  );
}
