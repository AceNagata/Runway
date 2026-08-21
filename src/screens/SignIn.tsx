import { useEffect, useRef, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button, Card, Eyebrow, Field, ICON, Input } from '../components/ui';
import { Wordmark } from '../components/ui/Mark';
import { createOwner, MIN_PASSWORD, resetPassword, signIn, type AuthedOwner } from '../lib/auth';

type Mode = 'signIn' | 'create' | 'reset';

/** The gate. One screen, three modes, so somebody who lands here knows both what to do and
 *  that the other option exists.
 *
 *  Creating an account is how the organiser who buys Runway sets themselves up: their name
 *  becomes the owner at the root of the reporting tree, and their password is a real one —
 *  held and checked by Firebase, resettable over email. */
export function SignIn({
  onAuthed,
  onIntent,
}: {
  onAuthed: (owner: AuthedOwner) => void;
  /** The name they typed, handed over *before* the account is created. Firebase's auth
   *  listener fires the moment the user exists, which is before updateProfile lands, so
   *  without this the board gets seeded from the email prefix instead. */
  onIntent?: (name: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    setError(null);
    setNote(null);
  }, [mode]);

  const submit = async () => {
    setError(null);
    setNote(null);

    if (mode === 'reset') {
      if (!email.trim()) return setError('Enter the email address on the account.');
      setBusy(true);
      setNote(await resetPassword(email));
      setBusy(false);
      return;
    }

    if (mode === 'create' && !name.trim()) {
      return setError('Runway needs your name — it becomes the owner of this organisation.');
    }
    if (!email.trim()) return setError('Enter your email address.');
    if (mode === 'create' && password.length < MIN_PASSWORD) {
      return setError(`Use at least ${MIN_PASSWORD} characters. Length matters more than symbols.`);
    }
    if (!password) return setError('Enter your password.');

    setBusy(true);
    if (mode === 'create') onIntent?.(name);
    const result =
      mode === 'create'
        ? await createOwner(name, email, password)
        : await signIn(email, password);
    setBusy(false);

    if (result.error) {
      setPassword('');
      return setError(result.error);
    }
    if (result.owner) onAuthed(result.owner);
  };

  const heading =
    mode === 'create' ? 'Make this yours' : mode === 'reset' ? 'Reset your password' : 'Welcome back';
  const kicker = mode === 'create' ? 'Set up' : mode === 'reset' ? 'Reset' : 'Sign in';

  return (
    <div className="gate">
      <div className="gate-inner rise">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
          <Wordmark size={22} markSize={28} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Eyebrow>{kicker}</Eyebrow>
          <h1 className="h1">{heading}</h1>
          <p className="muted" style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5, textWrap: 'pretty' }}>
            {mode === 'create'
              ? 'Your name becomes the owner of the organisation — the top of the reporting tree, and who everyone else is added under.'
              : mode === 'reset'
                ? 'We will email you a link to set a new one.'
                : 'Sign in to open Runway.'}
          </p>
        </div>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          {mode === 'create' && (
            <Field label="Your name">
              <Input
                ref={firstField}
                value={name}
                placeholder="The name your team will see"
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}

          <Field label="Email">
            <Input
              ref={mode === 'create' ? undefined : firstField}
              type="email"
              value={email}
              placeholder="you@company.com"
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </Field>

          {mode !== 'reset' && (
            <Field
              label="Password"
              hint={mode === 'create' ? `At least ${MIN_PASSWORD} characters.` : undefined}
            >
              <Input
                type="password"
                value={password}
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
              />
            </Field>
          )}

          {error && (
            <p className="tone-overdue" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
              {error}
            </p>
          )}
          {note && (
            <p className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
              {note}
            </p>
          )}

          <Button variant="primary" size="lg" full disabled={busy} onClick={() => void submit()}>
            <KeyRound size={16} {...ICON} />
            {busy
              ? 'Working'
              : mode === 'create'
                ? 'Create account'
                : mode === 'reset'
                  ? 'Send reset link'
                  : 'Sign in'}
          </Button>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)' }}>
            {mode === 'signIn' ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setMode('create')}>
                  Create an account
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setMode('reset')}>
                  Forgotten your password?
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setMode('signIn')}>
                Back to sign in
              </Button>
            )}
          </div>
        </Card>

        <StorageCaveat />
      </div>
    </div>
  );
}

/** The one thing a customer would otherwise assume wrongly. The account is real and portable;
 *  the work is not, yet. Saying so here is cheaper than someone discovering it on a second
 *  laptop with an empty board. */
export function StorageCaveat() {
  return (
    <div className="gate-caveat">
      <ShieldCheck size={16} {...ICON} className="faint" style={{ flex: '0 0 16px', marginTop: 2 }} />
      <p className="caption" style={{ lineHeight: 1.5 }}>
        Your account and password are held by Firebase, so they work on any device and can be
        reset by email. Your organisation's tasks and notes live with it, so they follow you to
        any computer you sign in from, and everyone in the organisation sees the same board.
      </p>
    </div>
  );
}
