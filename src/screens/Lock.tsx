import { useEffect, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button, Card, ConfirmDialog, Eyebrow, Field, ICON, Input } from '../components/ui';
import { Wordmark } from '../components/ui/Mark';
import { LockCaveat } from './Setup';
import { forgetEverything, markUnlocked, readAccount, verifyPassphrase } from '../lib/lock';

/** The lock screen. Greets the owner by name, because knowing whose browser this is helps and
 *  the name is not the secret. */
export function Lock({ onUnlocked }: { onUnlocked: () => void }) {
  const account = readAccount();
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const submit = async () => {
    if (!pass) return;
    setBusy(true);
    const ok = await verifyPassphrase(pass);
    setBusy(false);
    if (ok) {
      markUnlocked();
      onUnlocked();
      return;
    }
    setPass('');
    // States the problem, not an apology, and does not hint at what was wrong.
    setError('That passphrase does not match.');
    inputRef.current?.focus();
  };

  return (
    <div className="gate">
      <div className="gate-inner rise">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
          <Wordmark size={22} markSize={28} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Eyebrow>Locked</Eyebrow>
          <h1 className="h1">
            Welcome back{account?.name ? `, ${account.name.split(' ')[0]}` : ''}
          </h1>
          <p className="muted" style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5 }}>
            Enter your passphrase to open Runway.
          </p>
        </div>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <Field label="Passphrase">
            <Input
              ref={inputRef}
              type="password"
              value={pass}
              autoComplete="current-password"
              onChange={(e) => {
                setPass(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </Field>

          {error && (
            <p className="tone-overdue" style={{ fontSize: 'var(--fs-sm)' }}>
              {error}
            </p>
          )}

          <Button variant="primary" size="lg" full disabled={busy || !pass} onClick={() => void submit()}>
            <KeyRound size={16} {...ICON} />
            {busy ? 'Checking' : 'Unlock'}
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setResetting(true)}>
            I've forgotten it
          </Button>
        </Card>

        <LockCaveat />
      </div>

      {resetting && (
        <ConfirmDialog
          title="Start over"
          consequence="Nobody can reset this passphrase, so the only way in is to start again — which erases every task, note, folder and member on this device. There is no copy elsewhere."
          confirmLabel="Erase and start over"
          onConfirm={() => {
            forgetEverything();
            location.replace('/');
          }}
          onClose={() => setResetting(false)}
        />
      )}
    </div>
  );
}
