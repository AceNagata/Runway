import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MoveVertical, UserMinus, UserPlus } from 'lucide-react';
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
  useToast,
} from '../components/ui';
import { useStore } from '../store/StoreContext';
import { descendants, directReports, reparentError, subtree } from '../domain/org';
import { derivedStatus } from '../domain/tasks';
import { measure, pct } from '../domain/reports';
import { addDays, startOfDay } from '../lib/time';
import type { User } from '../store/types';

/** The tree is the permission model. This screen renders the subtree the viewer is allowed
 *  to see and is the only place membership and manager relationships can be edited. §4/§6.3
 *  On mobile it is read-only — the action buttons are hidden by the shell's breakpoints. */
export function Team() {
  const { state, me } = useStore();
  const navigate = useNavigate();
  const [inviting, setInviting] = useState(false);
  const [moving, setMoving] = useState<User | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<User | null>(null);

  const team = subtree(state, me.id);
  const directs = directReports(state, me.id);

  // On-time rate over the last 30 days, per person. Comparative across time, not people —
  // the bar is that person's own record, never a ranking. §5
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

  return (
    <div className="screen rise">
      <div className="screen-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <Eyebrow>Your team</Eyebrow>
          <span className="h3">
            {team.length} {team.length === 1 ? 'person' : 'people'}
            {directs.length > 0 && `, ${directs.length} reporting to you directly`}
          </span>
        </div>
        {me.admin && (
          <Button variant="secondary" size="sm" onClick={() => setInviting(true)}>
            <UserPlus size={16} {...ICON} />
            Send invite
          </Button>
        )}
      </div>

      <Card>
        {directs.length === 0 ? (
          <EmptyState
            icon={<UserPlus size={24} {...ICON} />}
            line="Nobody reports to you yet, so there is nowhere to hand work down."
            action={
              me.admin && (
                <Button variant="ghost" size="sm" onClick={() => setInviting(true)}>
                  Send invite
                </Button>
              )
            }
          />
        ) : (
          <div className="tree">
            <MemberRow
              user={me}
              self
              stats={rates.get(me.id)}
              onOpenTasks={() => navigate('/tasks?tab=mine')}
            />
            <Branch
              managerId={me.id}
              rates={rates}
              onMove={setMoving}
              onRemove={setRemoving}
              onEditRole={setEditingRole}
            />
          </div>
        )}
      </Card>

      <p className="caption">
        You see everyone below you and nobody sideways or above. Hand-off follows the same
        line.
      </p>

      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
      {moving && <MoveDialog member={moving} onClose={() => setMoving(null)} />}
      {editingRole && <RoleDialog member={editingRole} onClose={() => setEditingRole(null)} />}
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
  onEditRole,
}: {
  managerId: string;
  rates: Map<string, NonNullable<Stats>>;
  onMove: (u: User) => void;
  onRemove: (u: User) => void;
  onEditRole: (u: User) => void;
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
            onEditRole={() => onEditRole(u)}
          />
          <Branch
            managerId={u.id}
            rates={rates}
            onMove={onMove}
            onRemove={onRemove}
            onEditRole={onEditRole}
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
  onEditRole,
  onOpenTasks,
}: {
  user: User;
  self?: boolean;
  stats: Stats;
  onMove?: () => void;
  onRemove?: () => void;
  onEditRole?: () => void;
  onOpenTasks?: () => void;
}) {
  const { me } = useStore();
  const navigate = useNavigate();
  const rate = stats?.rate ?? null;

  return (
    <div className={`member ${self ? 'self' : ''}`}>
      <Avatar user={user} size={self ? "md" : "sm"} decorative />
      <span className="member-text">
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: self ? 700 : 600, color: 'var(--text-strong)' }}>
          {user.name}
          {self && <span className="muted" style={{ fontWeight: 400 }}> (you)</span>}
        </span>
        <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
          {user.role}
          {user.admin && ' · admin'}
        </span>
      </span>

      <span className="member-right">
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
        {me.admin && !self && onEditRole && (
          <Button variant="ghost" size="sm" onClick={onEditRole}>
            Role
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

function InviteDialog({ onClose }: { onClose: () => void }) {
  const { state, me, dispatch } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('');
  const [managerId, setManagerId] = useState(me.id);
  const [error, setError] = useState<string | null>(null);

  const managers = subtree(state, me.id);

  return (
    <Dialog
      title="Send invite"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!name.trim()) {
                setError('An invite needs a name.');
                return;
              }
              dispatch({ type: 'org/invite', name, handle: handle || name.split(' ')[0].toLowerCase(), role, managerId });
              toast(`Invited ${name.trim()}.`);
              onClose();
            }}
          >
            Send invite
          </Button>
        </>
      }
    >
      <Field label="Name">
        <Input value={name} placeholder="Their full name" onChange={(e) => { setName(e.target.value); setError(null); }} />
      </Field>
      <Field label="Handle" hint="Used wherever numbers and IDs are shown.">
        <Input className="input-mono" value={handle} placeholder="@handle" onChange={(e) => setHandle(e.target.value)} />
      </Field>
      <Field label="Role">
        <Input value={role} placeholder="What they do" onChange={(e) => setRole(e.target.value)} />
      </Field>
      <Field label="Reports to">
        <Select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
          {managers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id === me.id ? `${u.name} (you)` : u.name}
            </option>
          ))}
        </Select>
      </Field>
      {error && <p className="tone-overdue" style={{ fontSize: 'var(--fs-sm)' }}>{error}</p>}
    </Dialog>
  );
}

/** Tree edits are transactional: a cycle is impossible to create, and the operation is
 *  rejected rather than partially applied. §4 */
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
      {error && <p className="tone-overdue" style={{ fontSize: 'var(--fs-sm)' }}>{error}</p>}
    </Dialog>
  );
}

function RoleDialog({ member, onClose }: { member: User; onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [role, setRole] = useState(member.role);
  const [admin, setAdmin] = useState(member.admin);

  return (
    <Dialog
      title={`Role for ${member.name}`}
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
              toast(`Updated ${member.name.split(' ')[0]}'s role.`);
              onClose();
            }}
          >
            Save role
          </Button>
        </>
      }
    >
      <Field label="Role">
        <Input value={role} onChange={(e) => setRole(e.target.value)} />
      </Field>
      <Switch checked={admin} onChange={setAdmin}>
        Can edit the team
      </Switch>
    </Dialog>
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
