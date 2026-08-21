import { useCallback, useEffect, useState } from 'react';
import { Building2, Copy, KeyRound, LogOut, Plus, ShieldCheck, Ticket, UserMinus } from 'lucide-react';
import {
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
  Tabs,
  useToast,
} from '../components/ui';
import { Wordmark } from '../components/ui/Mark';
import { signOutOwner, type AuthedOwner } from '../lib/auth';
import {
  addPlatformAdmin,
  adminBootstrapHint,
  createInvite,
  isPlatformAdmin,
  listAdmins,
  listInvites,
  listOrgs,
  removePlatformAdmin,
  revokeInvite,
  type OrgInvite,
  type PlatformAdmin,
} from '../lib/platform';

/** Runway's own admin panel, at /admin — one level above every organisation.
 *
 *  This is where organisations come from: nobody can create one by signing up, so an invite
 *  is issued here and handed to the customer. Staff can also create an organisation outright,
 *  which is what the "Create one directly" link at the top does — it drops into the ordinary
 *  setup flow, which skips the invite field for staff. */
export function AdminPanel({ owner }: { owner: AuthedOwner }) {
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [staff, setStaff] = useState(false);
  const [tab, setTab] = useState<'orgs' | 'invites' | 'staff'>('orgs');

  const [orgs, setOrgs] = useState<Array<{ slug: string; name: string; address: string }>>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);

  const [issuing, setIssuing] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [revoking, setRevoking] = useState<OrgInvite | null>(null);
  const [droppingAdmin, setDroppingAdmin] = useState<PlatformAdmin | null>(null);

  const refresh = useCallback(async () => {
    const [o, i, a] = await Promise.all([
      listOrgs().catch(() => []),
      listInvites().catch(() => []),
      listAdmins().catch(() => []),
    ]);
    setOrgs(o);
    setInvites(i);
    setAdmins(a);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const yes = await isPlatformAdmin(owner.uid);
      if (!alive) return;
      setStaff(yes);
      setChecking(false);
      if (yes) await refresh();
    })();
    return () => {
      alive = false;
    };
  }, [owner.uid, refresh]);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`Copied the ${label}.`);
    } catch {
      toast(`Copy it by hand: ${value}`);
    }
  };

  if (checking) return <div className="gate" />;

  /* Not staff. Says exactly what to do rather than just refusing — the alternative is a
     support conversation about a blank page. */
  if (!staff) {
    return (
      <div className="gate">
        <div className="gate-inner rise">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
            <Wordmark size={22} markSize={28} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <Eyebrow>Runway admin</Eyebrow>
            <h1 className="h1">Not your panel</h1>
            <p className="muted" style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5 }}>
              This account is not Runway staff. If it should be, the first one is added from
              the Firebase console — after that, staff add each other from here.
            </p>
          </div>
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
            <Eyebrow>Your account id</Eyebrow>
            <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
              <Input className="input-mono" readOnly value={owner.uid} />
              <Button variant="secondary" onClick={() => void copy('account id', owner.uid)}>
                <Copy size={16} {...ICON} />
              </Button>
            </div>
            <p className="caption" style={{ lineHeight: 1.5 }}>
              {adminBootstrapHint(owner.uid)}
            </p>
          </Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)' }}>
            <span className="caption">Signed in as {owner.email}</span>
            <Button variant="ghost" size="sm" onClick={() => location.assign('/')}>
              Back to Runway
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const unused = invites.filter((i) => !i.usedBy && !i.revoked);

  return (
    <div className="admin-shell">
      <header className="topbar">
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
          <Wordmark size={16} markSize={20} />
          <span className="badge">
            <ShieldCheck size={12} {...ICON} />
            Runway admin
          </span>
        </span>
        <div className="topbar-right">
          <Mono className="faint">{owner.email}</Mono>
          <Button variant="ghost" size="sm" onClick={() => location.assign('/')}>
            Back to Runway
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signOutOwner().then(() => location.assign('/'))}
          >
            <LogOut size={16} {...ICON} />
            Sign out
          </Button>
        </div>
      </header>

      <div className="centre">
        <div className="screen screen-wide rise">
          <div className="screen-head">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <Eyebrow>Platform</Eyebrow>
              <span className="h3">
                {orgs.length} {orgs.length === 1 ? 'organisation' : 'organisations'} ·{' '}
                {unused.length} unused {unused.length === 1 ? 'invite' : 'invites'}
              </span>
              <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                Nobody can create an organisation without an invite from here.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
              <Button variant="primary" size="sm" onClick={() => setIssuing(true)}>
                <Ticket size={16} {...ICON} />
                Issue invite
              </Button>
              <Button variant="secondary" size="sm" onClick={() => location.assign('/')}>
                <Building2 size={16} {...ICON} />
                Create one directly
              </Button>
            </div>
          </div>

          <Tabs<'orgs' | 'invites' | 'staff'>
            value={tab}
            onChange={setTab}
            items={[
              { value: 'orgs', label: 'Organisations', count: orgs.length },
              { value: 'invites', label: 'Invites', count: invites.length },
              { value: 'staff', label: 'Runway staff', count: admins.length },
            ]}
          />

          {tab === 'orgs' &&
            (orgs.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Building2 size={24} {...ICON} />}
                  line="No organisations yet. Issue an invite, or create one directly."
                  action={
                    <Button variant="ghost" size="sm" onClick={() => setIssuing(true)}>
                      <Plus size={16} {...ICON} />
                      Issue invite
                    </Button>
                  }
                />
              </Card>
            ) : (
              <Card className="card-flush">
                <div className="rows">
                  {orgs.map((o) => (
                    <div className="row" key={o.slug}>
                      <span className="row-main">
                        <span className="row-title">{o.name}</span>
                        <span className="row-sub">
                          {location.host}/{o.address || o.slug}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => location.assign(`/${o.address || o.slug}`)}
                      >
                        Open
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}

          {tab === 'invites' &&
            (invites.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Ticket size={24} {...ICON} />}
                  line="No invites issued. Each one lets somebody create exactly one organisation."
                  action={
                    <Button variant="ghost" size="sm" onClick={() => setIssuing(true)}>
                      <Plus size={16} {...ICON} />
                      Issue invite
                    </Button>
                  }
                />
              </Card>
            ) : (
              <Card className="card-flush">
                <div className="rows">
                  {invites.map((i) => {
                    const state = i.revoked
                      ? { tone: 'idle', label: 'Withdrawn' }
                      : i.usedBy
                        ? { tone: 'done', label: i.orgSlug ? `Used — /${i.orgAddress ?? i.orgSlug}` : 'Claimed' }
                        : { tone: 'due', label: 'Unused' };
                    return (
                      <div className="row" key={i.code}>
                        <span className={`dot dot-${state.tone}`} />
                        <span className="row-main">
                          <Mono style={{ color: 'var(--text-strong)' }}>{i.code}</Mono>
                          <span className="row-sub">
                            {state.label}
                            {i.note && ` · ${i.note}`}
                          </span>
                        </span>
                        {!i.usedBy && !i.revoked && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => void copy('code', i.code)}>
                              <Copy size={16} {...ICON} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setRevoking(i)}>
                              Withdraw
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}

          {tab === 'staff' && (
            <>
              <Card className="card-flush">
                <div className="rows">
                  {admins.map((a) => (
                    <div className="row" key={a.uid}>
                      <span className="row-main">
                        <span className="row-title">{a.name || a.email || a.uid}</span>
                        <span className="row-sub">{a.email}</span>
                      </span>
                      <Mono className="faint">{a.uid.slice(0, 8)}…</Mono>
                      {a.uid !== owner.uid && (
                        <Button variant="ghost" size="sm" onClick={() => setDroppingAdmin(a)}>
                          <UserMinus size={16} {...ICON} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
              <div>
                <Button variant="secondary" size="sm" onClick={() => setAddingAdmin(true)}>
                  <Plus size={16} {...ICON} />
                  Add staff
                </Button>
              </div>
              <p className="caption">
                Staff can issue invites, see every organisation, and add each other. They are
                not members of any organisation and cannot read its work.
              </p>
            </>
          )}
        </div>
      </div>

      {issuing && (
        <IssueInviteDialog
          owner={owner}
          onClose={() => setIssuing(false)}
          onIssued={() => void refresh()}
        />
      )}
      {addingAdmin && (
        <AddStaffDialog
          owner={owner}
          onClose={() => setAddingAdmin(false)}
          onAdded={() => void refresh()}
        />
      )}
      {revoking && (
        <ConfirmDialog
          title={`Withdraw ${revoking.code}`}
          consequence="The code stops working immediately. It stays in this list so it is clear one was issued and withdrawn."
          confirmLabel="Withdraw it"
          onConfirm={() => {
            void revokeInvite(revoking.code).then(refresh);
            toast(`Withdrew ${revoking.code}.`);
          }}
          onClose={() => setRevoking(null)}
        />
      )}
      {droppingAdmin && (
        <ConfirmDialog
          title={`Remove ${droppingAdmin.name || droppingAdmin.email}`}
          consequence="They lose the Runway admin panel. Any organisation they belong to is untouched."
          confirmLabel="Remove staff"
          onConfirm={() => {
            void removePlatformAdmin(droppingAdmin.uid).then(refresh);
            toast('Removed.');
          }}
          onClose={() => setDroppingAdmin(null)}
        />
      )}
    </div>
  );
}

function IssueInviteDialog({
  owner,
  onClose,
  onIssued,
}: {
  owner: AuthedOwner;
  onClose: () => void;
  onIssued: () => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  const issue = async () => {
    setBusy(true);
    try {
      const invite = await createInvite(note, { uid: owner.uid, email: owner.email });
      setIssued(invite.code);
      onIssued();
    } catch {
      toast('That invite could not be issued.');
    }
    setBusy(false);
  };

  return (
    <Dialog
      title={issued ? 'Invite issued' : 'Issue invite'}
      onClose={onClose}
      actions={
        issued ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void issue()}>
              <KeyRound size={16} {...ICON} />
              {busy ? 'Issuing' : 'Issue invite'}
            </Button>
          </>
        )
      }
    >
      {issued ? (
        <>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
            Send this to the organiser. They sign up at {location.host}, enter it, and get one
            organisation. It works once.
          </p>
          <Mono style={{ fontSize: 24, color: 'var(--accent)', letterSpacing: '0.08em' }}>
            {issued}
          </Mono>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(issued).catch(() => undefined);
              toast('Copied the code.');
            }}
          >
            <Copy size={16} {...ICON} />
            Copy code
          </Button>
        </>
      ) : (
        <Field label="Who is it for" hint="Only you see this. It is how you recognise the code later.">
          <Input
            value={note}
            placeholder="Arena Erbil — Dara"
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void issue()}
          />
        </Field>
      )}
    </Dialog>
  );
}

/** Staff are added by account id, because that is the only identifier Firebase gives the
 *  client for somebody who is not signed in. They read theirs off the panel's refusal screen. */
function AddStaffDialog({
  owner,
  onClose,
  onAdded,
}: {
  owner: AuthedOwner;
  onClose: () => void;
  onAdded: () => void;
}) {
  const toast = useToast();
  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      title="Add Runway staff"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!uid.trim()) return setError('Paste their account id.');
              void addPlatformAdmin({
                uid: uid.trim(),
                email: email.trim(),
                name: name.trim(),
                addedBy: owner.uid,
              })
                .then(() => {
                  toast('Added them to Runway staff.');
                  onAdded();
                  onClose();
                })
                .catch(() => setError('That could not be saved.'));
            }}
          >
            Add staff
          </Button>
        </>
      }
    >
      <p className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
        They sign up first, open /admin, and copy the account id it shows them.
      </p>
      <Field label="Account id">
        <Input
          className="input-mono"
          value={uid}
          placeholder="A long string of letters and numbers"
          onChange={(e) => {
            setUid(e.target.value);
            setError(null);
          }}
        />
      </Field>
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {error && (
        <p className="tone-overdue" style={{ fontSize: 'var(--fs-sm)' }}>
          {error}
        </p>
      )}
    </Dialog>
  );
}
