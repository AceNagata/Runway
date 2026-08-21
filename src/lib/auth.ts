import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './firebase';

/** Real accounts, verified by Firebase Auth.
 *
 *  The password is checked server side and never reaches this code beyond the moment it is
 *  typed: we hand it straight to the SDK. That is the difference from the local passphrase
 *  this replaced — this one survives a cleared browser, works on another machine, and can be
 *  reset over email rather than only by erasing everything.
 *
 *  What it does **not** yet do is move the work. Tasks and notes still live in this browser
 *  (DECISIONS.md Q8), keyed per account so two people sharing a computer never see each
 *  other's board. Signing in elsewhere gives a real session and an empty board until the data
 *  layer lands, and the UI says so rather than implying sync. */

export type { FirebaseUser };

/** Long beats clever, and Firebase's own floor is 6. */
export const MIN_PASSWORD = 8;

export interface AuthedOwner {
  uid: string;
  name: string;
  email: string;
}

/** `name` is empty when the profile has no display name yet — which is the case for the
 *  moment between creating an account and updateProfile landing. Callers decide what to fall
 *  back to, because guessing here once seeded a board with the email prefix instead of the
 *  name the owner had just typed. */
export function toOwner(user: FirebaseUser): AuthedOwner {
  return {
    uid: user.uid,
    name: user.displayName?.trim() ?? '',
    email: user.email ?? '',
  };
}

/** The name to show for an account, given whatever we know. */
export const ownerName = (owner: AuthedOwner, hint?: string): string =>
  owner.name || hint?.trim() || owner.email.split('@')[0] || 'Owner';

export function watchAuth(cb: (owner: AuthedOwner | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => cb(user ? toOwner(user) : null));
}

/** Firebase error codes are precise but unreadable. §Content rules: state the problem and the
 *  fix, no apology — and never confirm whether an address exists. */
export function authMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'That does not look like an email address.';
    case 'auth/email-already-in-use':
      return 'That email already has an account. Sign in instead.';
    case 'auth/weak-password':
      return `Use at least ${MIN_PASSWORD} characters.`;
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password do not match.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check the network and try again.';
    default:
      return 'That did not work. Try again.';
  }
}

const codeOf = (e: unknown) =>
  typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';

export async function createOwner(
  name: string,
  email: string,
  password: string,
): Promise<{ owner?: AuthedOwner; error?: string }> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    // updateProfile does not re-emit, so build the owner from what we just set.
    return { owner: { uid: cred.user.uid, name: name.trim(), email: cred.user.email ?? '' } };
  } catch (e) {
    return { error: authMessage(codeOf(e)) };
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ owner?: AuthedOwner; error?: string }> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { owner: toOwner(cred.user) };
  } catch (e) {
    return { error: authMessage(codeOf(e)) };
  }
}

/** Always reports success, whether or not the address is registered — otherwise this form
 *  becomes a way to discover who has an account. */
export async function resetPassword(email: string): Promise<string> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch {
    // Deliberately swallowed: the message below is the same either way.
  }
  return `If ${email.trim()} has an account, a reset link is on its way.`;
}

export const signOutOwner = () => signOut(auth);
