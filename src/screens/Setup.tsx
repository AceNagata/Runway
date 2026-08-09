import { useState } from 'react';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { Button, Card, Eyebrow, Field, ICON, Input } from '../components/ui';
import { Wordmark } from '../components/ui/Mark';
import { createAccount, MIN_PASSPHRASE } from '../lib/lock';
import { startBoardForOwner } from '../store/persist';

/** First run for a real customer: the organiser who bought Runway names themselves and picks
 *  a passphrase. Their name becomes the owner member at the root of the org tree, replacing
 *  the "You" placeholder, so every greeting, avatar and chain of custody reads properly.
 *
 *  The copy is explicit that the passphrase locks this browser rather than protecting the
 *  data, because with no backend that is the truth and a login box implies otherwise. */
export function Setup({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError('Runway needs your name — it becomes the owner of this organisation.');
      return;
    }
    if (pass.length < MIN_PASSPHRASE) {
      setError(`Use at least ${MIN_PASSPHRASE} characters. Length matters more than symbols.`);
      return;
    }
    if (pass !== confirm) {
      setError('The two passphrases are different.');
      return;
    }
    setBusy(true);
    await createAccount(name, pass);
    // The board starts empty and owned by them, whatever happened to be cached before.
    startBoardForOwner(name);
    setBusy(false);
    onDone(name.trim());
  };

  return (
    <div className="gate">
      <div className="gate-inner rise">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
          <Wordmark size={22} markSize={28} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Eyebrow>Set up</Eyebrow>
          <h1 className="h1">Make this yours</h1>
          <p className="muted" style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5, textWrap: 'pretty' }}>
            Your name becomes the owner of the organisation — the top of the reporting tree,
            and who everyone else is added under.
          </p>
        </div>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <Field label="Your name">
            <Input
              value={name}
              placeholder="The name your team will see"
              autoComplete="name"
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </Field>

          <Field label="Passphrase" hint={`At least ${MIN_PASSPHRASE} characters.`}>
            <Input
              type="password"
              value={pass}
              autoComplete="new-password"
              onChange={(e) => {
                setPass(e.target.value);
                setError(null);
              }}
            />
          </Field>

          <Field label="Passphrase again">
            <Input
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => {
                setConfirm(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </Field>

          {error && (
            <p className="tone-overdue" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
              {error}
            </p>
          )}

          <Button variant="primary" size="lg" full disabled={busy} onClick={() => void submit()}>
            <KeyRound size={16} {...ICON} />
            {busy ? 'Setting up' : 'Set up Runway'}
          </Button>
        </Card>

        <LockCaveat />
      </div>
    </div>
  );
}

/** Said on both gate screens, because it is the thing a customer would otherwise assume
 *  wrongly, and assuming it wrongly is what gets data lost. */
export function LockCaveat() {
  return (
    <div className="gate-caveat">
      <ShieldAlert size={16} {...ICON} className="faint" style={{ flex: '0 0 16px', marginTop: 2 }} />
      <p className="caption" style={{ lineHeight: 1.5 }}>
        This passphrase locks Runway in this browser. It is not an account: your work is stored
        on this device, so it does not follow you to another computer, and anyone with access to
        this machine could reach it. There is also nobody to reset it — keep it somewhere safe.
      </p>
    </div>
  );
}
