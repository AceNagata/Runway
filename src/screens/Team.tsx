import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Layers,
  MoveVertical,
  Pencil,
  Plus,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Eyebrow,
  Field,
  ICON,
  Input,
  Mono,
  Select,
  Switch,
  Tabs,
  useToast,
} from '../components/ui';
import { TonePicker } from '../components/shell/FolderDialogs';
import { useStore } from '../store/StoreContext';
import { descendants, directReports, reparentError, subtree } from '../domain/org';
import { derivedStatus } from '../domain/tasks';
import { measure, pct } from '../domain/reports';
import { addDays, startOfDay } from '../lib/time';
import type { Section, StatusTone, User } from '../store/types';

/** The admin surface. §6.3 keeps it inside the web shell rather than making it a separate
 *  application, so this is the Team screen rather than a second app behind its own login.
 *  It is the only place membership, sections and manager relationships can be edited.
 *
 *  Two ways to read the same organisation:
 *   - **Reporting tree** — who reports to whom. This one *is* the permission model: you see
 *     everyone below you and nobody sideways or above, and hand-off follows the same line (§4).
 *   - **Sections** — which part of the org someone sits in. A label only. Sections never
 *     grant or remove access, which is why they are allowed to be flat and freely edited.
 *
 *  On mobile the tree is read-only (§6.2), so the editing controls are hidden by the shell's
 *  breakpoints and a line of copy says so rather than leaving them mysteriously absent. */
export function Team() {
  const { state, me } = useStore();
  const navigate = useNavigate();
  const [view, setView] = useState<'tree' | 'sections'>('tree');
  const [addingMember, setAddingMember] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [deletingSection, setDeletingSection] = useState<Section | null>(null);
  const [moving, setMoving] = useState<User | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const [editingMember, setEditingMember] = useState<User | null>(null);

  const team = subtree(state, me.id);
  const directs = directReports(state, me.id);
  const sections = Object.values(state.sections);

  // On-time rate over the last 30 days, per person. Comparative across time, not across
  // people — the bar is that person's own record, never a ranking. §5
  const rates = useMemo(() => {
    const to = new Date();
    const from = startOfDay(addDays(to, -29));
    const out = new Map<string, { rate: number | null; open: number; overdue: number }>();
    for (const u of team) {
      const m = measure(state, new Set([u.id]), from, to, to);
      out.set(u.id, {
        rate: m.onTimeRate,
        open: m.openLoad.overdue + m.openLoad.due + m.openLoad.unscheduled,
        overdue: m.openLoad.overdue,
      });
    }
    return out;
  }, [state, team]);

  const bySection = useMemo(() => {
    const groups = sections.map((s) => ({
      section: s,
      members: team.filter((u) => u.sectionId === s.id),
    }));
    const unassigned = team.filter((u) => !u.sectionId || !state.sections[u.sectionId]);
    return { groups, unassigned };
  }, [sections, team, state.sections]);

  return (
    <div className="screen rise">
      <div className="screen-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <Eyebrow>{me.admin ? 'Admin · organisation' : 'Your team'}</Eyebrow>
          <span className="h3">
            {team.length} {team.length === 1 ? 'person' : 'people'}
            {sections.length > 0 &&
              ` · ${sections.length} ${sections.length === 1 ? 'section' : 'sections'}`}
          </span>
          <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {directs.length > 0
              ? `${directs.length} reporting to you directly`
              : 'Nobody reports to you yet'}
          </span>
        </div>
        {me.admin && (
          <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
            <Button variant="primary" size="sm" onClick={() => setAddingMember(true)}>
              <UserPlus size={16} {...ICON} />
              Add member
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAddingSection(true)}>
              <Layers size={16} {...ICON} />
              Add section
            </Button>
          </div>
        )}
      </div>

      <Tabs<'tree' | 'sections'>
        value={view}
        onChange={setView}
        items={[
          { value: 'tree', label: 'Reporting tree', count: team.length },
          { value: 'sections', label: 'Sections', count: sections.length },
        ]}
      />

      {view === 'tree' ? (
        <>
          {/* You are always the root, even alone — an admin surface that renders as an empty
              state looks like a missing feature. */}
          <Card>
            <div className="tree">
              <MemberRow
                user={me}
                self
                stats={rates.get(me.id)}
                onOpenTasks={() => navigate('/tasks')}
                onEdit={me.admin ? () => setEditingMember(me) : undefined}
              />
              <Branch
                managerId={me.id}
                rates={rates}
                onMove={setMoving}
                onRemove={setRemoving}
                onEdit={setEditingMember}
              />
            </div>
            {directs.length === 0 && (
              <div style={{ paddingTop: 'var(--sp-6)' }}>
                <EmptyState
                  icon={<UserPlus size={24} {...ICON} />}
                  line="Add someone below you and hand-off becomes possible — a task can only go down this line."
                  action={
                    me.admin && (
                      <Button variant="ghost" size="sm" onClick={() => setAddingMember(true)}>
                        <Plus size={16} {...ICON} />
                        Add member
                      </Button>
                    )
                  }
                />
              </div>
            )}
          </Card>

          <p className="caption">
            This tree is the permission model. You see everyone below you and nobody sideways
            or above, and a task can only be handed down it.
          </p>
        </>
      ) : (
        <>
          {sections.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Layers size={24} {...ICON} />}
                line="No sections yet. They group the org for reading — they never change who can see what."
                action={
                  me.admin && (
                    <Button variant="ghost" size="sm" onClick={() => setAddingSection(true)}>
                      <Plus size={16} {...ICON} />
                      Add section
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            bySection.groups.map(({ section, members }) => (
              <div key={section.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="group-head">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                    <span className={`dot dot-${section.tone}`} />
                    <Eyebrow>{section.name}</Eyebrow>
                  </span>
                  <Mono className="faint">{members.length}</Mono>
                  <span className="group-rule" />
                  {me.admin && (
                    <span style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                      <Button variant="ghost" size="sm" onClick={() => setEditingSection(section)}>
                        <Pencil size={16} {...ICON} />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingSection(section)}
                        aria-label={`Delete ${section.name}`}
                      >
                        <UserMinus size={16} {...ICON} />
                      </Button>
                    </span>
                  )}
                </div>
                <Card>
                  {members.length === 0 ? (
                    <EmptyState
                      icon={<Layers size={24} {...ICON} />}
                      line="Nobody in this section yet."
                      row
                    />
                  ) : (
                    <div className="tree">
                      {members.map((u) => (
                        <MemberRow
                          key={u.id}
                          user={u}
                          self={u.id === me.id}
                          stats={rates.get(u.id)}
                          onEdit={me.admin ? () => setEditingMember(u) : undefined}
                          onMove={me.admin && u.id !== me.id ? () => setMoving(u) : undefined}
                          onRemove={me.admin && u.id !== me.id ? () => setRemoving(u) : undefined}
                        />
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            ))
          )}

          {bySection.unassigned.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="group-head">
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                  <span className="dot dot-idle" />
                  <Eyebrow>No section</Eyebrow>
                </span>
                <Mono className="faint">{bySection.unassigned.length}</Mono>
                <span className="group-rule" />
              </div>
              <Card>
                <div className="tree">
                  {bySection.unassigned.map((u) => (
                    <MemberRow
                      key={u.id}
                      user={u}
                      self={u.id === me.id}
                      stats={rates.get(u.id)}
                      onEdit={me.admin ? () => setEditingMember(u) : undefined}
                      onMove={me.admin && u.id !== me.id ? () => setMoving(u) : undefined}
                      onRemove={me.admin && u.id !== me.id ? () => setRemoving(u) : undefined}
                    />
                  ))}
                </div>
              </Card>
            </div>
          )}

          <p className="caption">
            Sections are for reading the organisation. Access and hand-off follow the reporting
            tree and nothing else, so moving somebody between sections changes no permissions.
          </p>
        </>
      )}

      <p className="caption admin-mobile-note">
        Membership is edited on a desk — the team tree is read-only on a phone.
      </p>

      {addingMember && <InviteDialog onClose={() => setAddingMember(false)} />}
      {addingSection && <NewSectionDialog onClose={() => setAddingSection(false)} />}
      {editingSection && (
        <EditSectionDialog section={editingSection} onClose={() => setEditingSection(null)} />
      )}
      {deletingSection && (
        <DeleteSectionDialog
          section={deletingSection}
          memberCount={team.filter((u) => u.sectionId === deletingSection.id).length}
          onClose={() => setDeletingSection(null)}
        />
      )}
      {moving && <MoveDialog member={moving} onClose={() => setMoving(null)} />}
      {editingMember && (
        <EditMemberDialog member={editingMember} onClose={() => setEditingMember(null)} />
      )}
      {removing && <RemoveDialog member={removing} onClose={() => setRemoving(null)} />}
    </div>
  );
}

type Stats = { rate: number | null; open: number; overdue: number } | undefined;

function Branch({
  managerId,
  rates,
  onMove,
  onRemove,
  onEdit,
}: {
  managerId: string;
  rates: Map<string, NonNullable<Stats>>;
  onMove: (u: User) => void;
  onRemove: (u: User) => void;
  onEdit: (u: User) => void;
}) {
  const { state } = useStore();
  const reports = directReports(state, managerId);
  if (reports.length === 0) return null;
  return (
    <div className="tree-branch">
      {reports.map((u) => (
        <div key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <MemberRow
            user={u}
            stats={rates.get(u.id)}
            onMove={() => onMove(u)}
            onRemove={() => onRemove(u)}
            onEdit={() => onEdit(u)}
          />
          <Branch
            managerId={u.id}
            rates={rates}
            onMove={onMove}
            onRemove={onRemove}
            onEdit={onEdit}
          />
        </div>
      ))}
    </div>
  );
}

function MemberRow({
  user,
  self,
  stats,
  onMove,
  onRemove,
  onEdit,
  onOpenTasks,
}: {
  user: User;
  self?: boolean;
  stats: Stats;
  onMove?: () => void;
  onRemove?: () => void;
  onEdit?: () => void;
  onOpenTasks?: () => void;
}) {
  const { state, me } = useStore();
  const navigate = useNavigate();
  const rate = stats?.rate ?? null;
  const section = user.sectionId ? state.sections[user.sectionId] : null;

  return (
    <div className={`member ${self ? 'self' : ''}`}>
      <Avatar user={user} size={self ? 'md' : 'sm'} decorative />
      <span className="member-text">
        <span
          style={{
            fontSize: 'var(--fs-body)',
            fontWeight: self ? 700 : 600,
            color: 'var(--text-strong)',
          }}
        >
          {user.name}
          {self && (
            <span className="muted" style={{ fontWeight: 400 }}>
              {' '}
              (you)
            </span>
          )}
        </span>
        <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
          {user.role}
          {user.admin && ' · admin'}
        </span>
      </span>

      <span className="member-right">
        {section && (
          <span className="badge">
            <span className={`dot dot-${section.tone}`} />
            {section.name}
          </span>
        )}
        <Mono className="faint">{user.handle}</Mono>
        {stats && stats.overdue > 0 && (
          <span className="badge">
            <span className="dot dot-overdue" />
            {stats.overdue} overdue
          </span>
        )}
        <Mono className="faint">{stats?.open ?? 0} open</Mono>
        <span style={{ width: 120 }} title="On-time rate over the last 30 days">
          <span className="bar-track">
            <span className="bar-fill" style={{ width: rate === null ? '0%' : `${rate * 100}%` }} />
          </span>
        </span>
        <Mono style={{ width: 40, textAlign: 'right' }}>{pct(rate)}</Mono>

        {onOpenTasks && (
          <Button variant="ghost" size="sm" onClick={onOpenTasks}>
            Your tasks
            <ArrowRight size={16} {...ICON} />
          </Button>
        )}
        {!self && (
          <Button variant="ghost" size="sm" onClick={() => navigate(`/reports?person=${user.id}`)}>
            Report
          </Button>
        )}
        {me.admin && onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil size={16} {...ICON} />
            Edit
          </Button>
        )}
        {me.admin && !self && onMove && (
          <Button variant="ghost" size="sm" onClick={onMove} aria-label={`Move ${user.name}`}>
            <MoveVertical size={16} {...ICON} />
            Move
          </Button>
        )}
        {me.admin && !self && onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove ${user.name}`}>
            <UserMinus size={16} {...ICON} />
          </Button>
        )}
      </span>
    </div>
  );
}

/** Creates the account outright. It is called "Add member" rather than "Send invite" because
 *  nothing is emailed — there is no backend to send from (DECISIONS.md Q8), and a button that
 *  claims to send an invite it never sends is worse than a plain one. */
export function InviteDialog({ onClose }: { onClose: () => void }) {
  const { state, me, dispatch } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('');
  const [managerId, setManagerId] = useState(me.id);
  const [sectionId, setSectionId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const managers = subtree(state, me.id);
  const sections = Object.values(state.sections);

  const submit = () => {
    if (!name.trim()) {
      setError('A member needs a name before you can add them.');
      return;
    }
    dispatch({
      type: 'org/invite',
      name,
      handle: handle || name.trim().split(/\s+/)[0].toLowerCase(),
      role,
      managerId,
      sectionId: sectionId || null,
    });
    toast(`Added ${name.trim()}.`);
    onClose();
  };

  return (
    <Dialog
      title="Add member"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Add member
          </Button>
        </>
      }
    >
      <Field label="Name">
        <Input
          value={name}
          placeholder="Their full name"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </Field>
      <Field label="Handle" hint="Used wherever numbers and IDs are shown.">
        <Input
          className="input-mono"
          value={handle}
          placeholder="@handle"
          onChange={(e) => setHandle(e.target.value)}
        />
      </Field>
      <Field label="Role">
        <Input value={role} placeholder="What they do" onChange={(e) => setRole(e.target.value)} />
      </Field>
      <Field label="Reports to" hint="This decides what they can see and who can hand them work.">
        <Select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
          {managers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id === me.id ? `${u.name} (you)` : u.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Section" hint="A label for reading the org. It grants nothing.">
        <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">No section</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      {error && (
        <p className="tone-overdue" style={{ fontSize: 'var(--fs-sm)' }}>
          {error}
        </p>
      )}
    </Dialog>
  );
}

/** Tree edits are transactional: a cycle is rejected outright rather than partially applied. §4 */
function MoveDialog({ member, onClose }: { member: User; onClose: () => void }) {
  const { state, me, dispatch } = useStore();
  const toast = useToast();
  const [managerId, setManagerId] = useState(member.managerId ?? me.id);
  const candidates = subtree(state, me.id).filter((u) => u.id !== member.id);
  const error = reparentError(state, member.id, managerId);
  const movingSubtree = descendants(state, member.id).length;

  return (
    <Dialog
      title={`Move ${member.name}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!!error || managerId === member.managerId}
            onClick={() => {
              dispatch({ type: 'org/reparent', memberId: member.id, managerId });
              toast(`${member.name} now reports to ${state.users[managerId].name}.`);
              onClose();
            }}
          >
            Move {member.name.split(' ')[0]}
          </Button>
        </>
      }
    >
      <p className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
        {movingSubtree > 0
          ? `${movingSubtree} ${movingSubtree === 1 ? 'person moves' : 'people move'} with them. Their tasks and history stay exactly where they are.`
          : 'Their tasks and history stay exactly where they are.'}
      </p>
      <Field label="Reports to">
        <Select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id === me.id ? `${u.name} (you)` : u.name}
            </option>
          ))}
        </Select>
      </Field>
      {error && (
        <p className="tone-overdue" style={{ fontSize: 'var(--fs-sm)' }}>
          {error}
        </p>
      )}
    </Dialog>
  );
}

function EditMemberDialog({ member, onClose }: { member: User; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [role, setRole] = useState(member.role);
  const [admin, setAdmin] = useState(member.admin);
  const [sectionId, setSectionId] = useState(member.sectionId ?? '');
  const sections = Object.values(state.sections);

  return (
    <Dialog
      title={`Edit ${member.name}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              dispatch({ type: 'org/set-role', memberId: member.id, role, admin });
              if ((member.sectionId ?? '') !== sectionId) {
                dispatch({
                  type: 'org/set-section',
                  memberId: member.id,
                  sectionId: sectionId || null,
                });
              }
              toast(`Saved ${member.name.split(' ')[0]}.`);
              onClose();
            }}
          >
            Save member
          </Button>
        </>
      }
    >
      <Field label="Role">
        <Input value={role} onChange={(e) => setRole(e.target.value)} />
      </Field>
      <Field label="Section">
        <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">No section</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Switch checked={admin} onChange={setAdmin}>
        Can edit the team
      </Switch>
    </Dialog>
  );
}

function NewSectionDialog({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [tone, setTone] = useState<StatusTone>('accent');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setError('A section needs a name before you can add it.');
      return;
    }
    dispatch({ type: 'section/create', name, tone });
    toast(`Added ${name.trim()}.`);
    onClose();
  };

  return (
    <Dialog
      title="Add section"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Add section
          </Button>
        </>
      }
    >
      <Field label="Name" hint="A department, a squad, a chapter — whatever you call it.">
        <Input
          value={name}
          placeholder="Design"
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

function EditSectionDialog({ section, onClose }: { section: Section; onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [name, setName] = useState(section.name);
  const [tone, setTone] = useState<StatusTone>(section.tone);

  return (
    <Dialog
      title={`Edit ${section.name}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              dispatch({ type: 'section/update', id: section.id, patch: { name, tone } });
              toast('Saved the section.');
              onClose();
            }}
          >
            Save section
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

function DeleteSectionDialog({
  section,
  memberCount,
  onClose,
}: {
  section: Section;
  memberCount: number;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const toast = useToast();
  return (
    <ConfirmDialog
      title={`Delete ${section.name}`}
      consequence={
        memberCount > 0
          ? `${memberCount} ${memberCount === 1 ? 'person stays' : 'people stay'} in the organisation and simply lose their section. Nobody is removed and no reporting line changes.`
          : 'The section is empty, so only the label goes.'
      }
      confirmLabel="Delete section"
      onConfirm={() => {
        dispatch({ type: 'section/delete', id: section.id });
        toast(`Deleted ${section.name}.`);
      }}
      onClose={onClose}
    />
  );
}

/** Deleting a user re-parents their reports to their manager and reassigns their open tasks
 *  upward, never into an orphan state — and the confirmation says so. §4/§6.3 */
function RemoveDialog({ member, onClose }: { member: User; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const manager = member.managerId ? state.users[member.managerId] : null;
  const reports = directReports(state, member.id);
  const open = Object.values(state.tasks).filter(
    (t) => t.ownerId === member.id && !t.completedAt,
  );
  const overdue = open.filter((t) => derivedStatus(t) === 'overdue').length;

  const parts = [
    reports.length > 0 &&
      `${reports.length} ${reports.length === 1 ? 'person starts' : 'people start'} reporting to ${manager?.name ?? 'their manager'}`,
    open.length > 0 &&
      `${open.length} open ${open.length === 1 ? 'task' : 'tasks'}${overdue ? ` (${overdue} overdue)` : ''} move to ${manager?.name ?? 'their manager'}`,
  ].filter(Boolean) as string[];

  return (
    <ConfirmDialog
      title={`Remove ${member.name}`}
      consequence={
        parts.length
          ? `${parts.join(', and ')}. Nothing is left without an owner, and the history stays on every task.`
          : 'They have no reports and no open tasks. Their closed work keeps its history.'
      }
      confirmLabel={`Remove ${member.name.split(' ')[0]}`}
      onConfirm={() => {
        dispatch({ type: 'org/remove', memberId: member.id });
        toast(`Removed ${member.name}.`);
      }}
      onClose={onClose}
    />
  );
}
