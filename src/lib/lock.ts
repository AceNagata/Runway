/** The owner's account: their name, and a passphrase that locks the app on this device.
 *
 *  ## What this is, and what it is not
 *
 *  The passphrase is **never stored**. What is stored is a PBKDF2-SHA-256 derivation of it
 *  (200k iterations, 16 random bytes of salt), so reading the stored value does not reveal
 *  the passphrase and the same passphrase on two devices produces different records.
 *
 *  It is still only a **device lock, not account security**, and the UI says so. There is no
 *  backend (DECISIONS.md Q8), so the tasks and notes themselves sit in localStorage as plain
 *  text: anyone with developer tools on this machine can read them, or clear this record to
 *  get past the lock. It keeps a passer-by out of an unattended browser. It is not a defence
 *  against somebody who has the device and wants the data.
 *
 *  Real accounts — a password that survives a cleared browser, works on a second device, and
 *  is verified by something other than the code asking the question — need Firebase Auth plus
 *  Firestore. This module is deliberately the only thing that would change: replace derive and
 *  verify with `signInWithEmailAndPassword`, and the screens above it stay as they are.
 *
 *  Kept in its own localStorage key rather than in RunwayState, so loading or clearing the
 *  demo data cannot lock the owner out of their own app. */

const KEY = 'runway.account.v1';
const ITERATIONS = 200_000;
const SALT_BYTES = 16;
/** Per tab session, so a reload does not re-prompt but a new window does. */
const UNLOCKED_KEY = 'runway.unlocked.v1';

export interface Account {
  /** The organiser's real name — this becomes the owner member in the org. */
  name: string;
  salt: string;
  iterations: number;
  hash: string;
  createdAt: string;
}

const toHex = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string) =>
  new Uint8Array((hex.match(/.{1,2}/g) ?? []).map((h) => parseInt(h, 16)));

async function derive(passphrase: string, salt: Uint8Array, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    material,
    256,
  );
  return toHex(new Uint8Array(bits));
}

/** Length-independent comparison, so verification does not leak the hash a byte at a time. */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function readAccount(): Account | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Account;
    return parsed?.hash && parsed?.salt && parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

export const hasAccount = () => readAccount() !== null;

/** Minimum the setup screen enforces. Long beats clever, so the floor is length only. */
export const MIN_PASSPHRASE = 8;

export async function createAccount(name: string, passphrase: string): Promise<Account> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const account: Account = {
    name: name.trim(),
    salt: toHex(salt),
    iterations: ITERATIONS,
    hash: await derive(passphrase, salt, ITERATIONS),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(account));
  markUnlocked();
  return account;
}

export async function verifyPassphrase(passphrase: string): Promise<boolean> {
  const account = readAccount();
  if (!account) return false;
  const candidate = await derive(passphrase, fromHex(account.salt), account.iterations);
  return sameHash(candidate, account.hash);
}

export async function changePassphrase(current: string, next: string): Promise<boolean> {
  const account = readAccount();
  if (!account || !(await verifyPassphrase(current))) return false;
  await createAccount(account.name, next);
  return true;
}

export function renameOwner(name: string): void {
  const account = readAccount();
  if (!account) return;
  localStorage.setItem(KEY, JSON.stringify({ ...account, name: name.trim() }));
}

export const markUnlocked = () => sessionStorage.setItem(UNLOCKED_KEY, '1');
export const lockNow = () => sessionStorage.removeItem(UNLOCKED_KEY);
export const isUnlocked = () => sessionStorage.getItem(UNLOCKED_KEY) === '1';

/** The only way past a forgotten passphrase. There is nobody to reset it for you, so this
 *  says plainly that it takes the data with it rather than pretending to recover anything. */
export function forgetEverything(): void {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(UNLOCKED_KEY);
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('runway.')) localStorage.removeItem(k);
  }
}
