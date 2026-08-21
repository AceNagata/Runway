import { useEffect, useState } from 'react';
import { ArrowRight, Building2, KeyRound, LogOut } from 'lucide-react';
import { Button, Card, Eyebrow, Field, ICON, Input, Mono } from '../components/ui';
import { Wordmark } from '../components/ui/Mark';
import { signOutOwner, type AuthedOwner } from '../lib/auth';
import { createOrg, joinOrg, normaliseSlug, orgIdOf, slugError, suggestSlug, type Org } from '../lib/org';

/** What a signed-in person sees when the URL does not resolve to an org they belong to.
 *
 *  Three cases, and the URL decides which:
 *   - No slug at all  → create an organisation, and choose its address.
 *   - A slug that exists, and you are not in it → join with the code.
 *   - A slug that does not exist → offer to create it at that address. */
export function OrgGate({
  owner,
  slug,
  org,
  onReady,
}: {
  owner: AuthedOwner;
  /** The first path segment, if any. */
  slug: string | null;
  /** The org living at that slug, when one does. */
  org: Org | null;
  onReady: (slug: string) => void;
}) {
  const joining = Boolean(slug && org);
  const [name, setName] = useState(org?.name ?? '');
  const [address, setAddress] = useState(slug ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ slug: string; joinCode: string } | null>(null);

  // Typing a name suggests the address, until the address is edited by hand.
  const [addressTouched, setAddressTouched] = useState(Boolean(slug));
  useEffect(() => {
    if (!addressTouched && !joining) setAddress(suggestSlug(name));
  }, [name, addressTouched, joining]);

  const submitJoin = async () => {
    setError(null);
    if (!code.trim()) return setError('Enter the join code your organiser gave you.');
    setBusy(true);
    const { error: problem } = await joinOrg(orgIdOf(slug!), code, { uid: owner.uid, name: owner.name });
    setBusy(false);
    if (problem) return setError(problem);
    // Back to the address as its owner wrote it, not the lower-case document id.
    onReady(org?.address || slug!);
  };

  const submitCreate = async () => {
    setError(null);
    if (!name.trim()) return setError('Give the organisation a name.');
    const typed = normaliseSlug(address || suggestSlug(name));
    const problem = slugError(typed);
    if (problem) return setError(problem);

    setBusy(true);
    const result = await createOrg(name, typed, { uid: owner.uid, name: owner.name });
    setBusy(false);
    if (result.error) return setError(result.error);
    // Show the code once before going in — it is the only way anyone else gets in.
    setCreated({ slug: typed, joinCode: result.joinCode! });
  };

  if (created) {
    return (
      <div className="gate">
        <div className="gate-inner rise">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
            <Wordmark size={22} markSize={28} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <Eyebrow>Ready</Eyebrow>
            <h1 className="h1">{name} is set up</h1>
            <p className="muted" style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5 }}>
              Your team opens the address below and joins with this code. Both live in Team, so
              you can find them again.
            </p>
          </div>

          <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <Eyebrow>Address</Eyebrow>
              <Mono style={{ fontSize: 16, color: 'var(--text-strong)' }}>
                {location.host}/{created.slug}
              </Mono>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <Eyebrow>Join code</Eyebrow>
              <Mono style={{ fontSize: 24, color: 'var(--accent)', letterSpacing: '0.08em' }}>
                {created.joinCode}
              </Mono>
            </div>
            <Button variant="primary" size="lg" full onClick={() => onReady(created.slug)}>
              Open {name}
              <ArrowRight size={16} {...ICON} />
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="gate">
      <div className="gate-inner rise">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
          <Wordmark size={22} markSize={28} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Eyebrow>{joining ? 'Join' : 'New organisation'}</Eyebrow>
          <h1 className="h1">{joining ? org!.name : 'Set up your organisation'}</h1>
          <p className="muted" style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5, textWrap: 'pretty' }}>
            {joining
              ? 'You need the join code from whoever set this up.'
              : 'It gets its own address, and everyone you invite works inside it.'}
          </p>
        </div>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          {joining ? (
            <Field label="Join code">
              <Input
                className="input-mono"
                value={code}
                placeholder="XXXX-XXXX"
                autoComplete="one-time-code"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && void submitJoin()}
              />
            </Field>
          ) : (
            <>
              <Field label="Organisation name">
                <Input
                  value={name}
                  placeholder="Arena Erbil"
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Address" hint={`${location.host}/${address || 'your-org'}`}>
                <Input
                  className="input-mono"
                  value={address}
                  placeholder="ArenaErbil"
                  onChange={(e) => {
                    setAddressTouched(true);
                    setAddress(normaliseSlug(e.target.value));
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && void submitCreate()}
                />
              </Field>
            </>
          )}

          {error && (
            <p className="tone-overdue" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
              {error}
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            full
            disabled={busy}
            onClick={() => void (joining ? submitJoin() : submitCreate())}
          >
            {joining ? <KeyRound size={16} {...ICON} /> : <Building2 size={16} {...ICON} />}
            {busy ? 'Working' : joining ? 'Join' : 'Create organisation'}
          </Button>
        </Card>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-4)' }}>
          <span className="caption">Signed in as {owner.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signOutOwner().then(() => location.replace('/'))}
          >
            <LogOut size={16} {...ICON} />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
