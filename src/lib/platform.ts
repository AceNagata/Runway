import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { makeJoinCode } from './org';

/** Runway itself, above the organisations.
 *
 *  Creating an organisation is not open to whoever finds the sign-up page: it takes an invite
 *  code issued here, or a platform admin doing it directly. That is enforced by the security
 *  rules, not by this file — everything below simply fails if the rules say no.
 *
 *  Bootstrapping the first platform admin is deliberately a console job. Any "first person to
 *  claim it" rule is a race on a public URL, and any bootstrap secret has to live somewhere:
 *  in the repository, in a build, or in a chat log. The Firebase console is the one place that
 *  already proves who owns the project. See adminBootstrapHint(). */

export interface OrgInvite {
  code: string;
  /** Free text so the issuer remembers who it went to. */
  note: string;
  createdBy: string;
  createdByEmail: string;
  createdAt?: unknown;
  revoked: boolean;
  /** The uid that claimed it, or null while unused. */
  usedBy: string | null;
  usedAt?: unknown;
  /** The organisation the code was claimed for: the document id the rules match on, and
   *  the address as it was typed, which is the one worth showing anybody. */
  orgSlug: string | null;
  orgAddress: string | null;
}

export interface PlatformAdmin {
  uid: string;
  email: string;
  name: string;
  addedBy: string;
}

const inviteRef = (code: string) => doc(db, 'orgInvites', code);
const adminRef = (uid: string) => doc(db, 'platformAdmins', uid);

/** Whether this account is Runway staff. Reads its own document, which the rules allow. */
export async function isPlatformAdmin(uid: string): Promise<boolean> {
  try {
    return (await getDoc(adminRef(uid))).exists();
  } catch {
    return false;
  }
}

export async function listOrgs(): Promise<
  Array<{ slug: string; name: string; address: string; ownerUid: string }>
> {
  const snap = await getDocs(query(collection(db, 'orgs'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => d.data() as { slug: string; name: string; address: string; ownerUid: string });
}

export async function listInvites(): Promise<OrgInvite[]> {
  const snap = await getDocs(query(collection(db, 'orgInvites'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => d.data() as OrgInvite);
}

export async function listAdmins(): Promise<PlatformAdmin[]> {
  const snap = await getDocs(collection(db, 'platformAdmins'));
  return snap.docs.map((d) => d.data() as PlatformAdmin);
}

export async function createInvite(
  note: string,
  by: { uid: string; email: string },
): Promise<OrgInvite> {
  const code = makeJoinCode();
  const invite: OrgInvite = {
    code,
    note: note.trim(),
    createdBy: by.uid,
    createdByEmail: by.email,
    revoked: false,
    usedBy: null,
    orgSlug: null,
    orgAddress: null,
  };
  await setDoc(inviteRef(code), { ...invite, createdAt: serverTimestamp() });
  return invite;
}

/** Withdrawing leaves the record, so it stays visible that a code was issued and pulled.
 *  There is deliberately no hard delete in the panel — an audit trail you can erase from the
 *  same screen is not much of one. */
export const revokeInvite = (code: string) => updateDoc(inviteRef(code), { revoked: true });

export const addPlatformAdmin = (admin: PlatformAdmin) =>
  setDoc(adminRef(admin.uid), { ...admin, addedAt: serverTimestamp() });

export const removePlatformAdmin = (uid: string) => deleteDoc(adminRef(uid));

/** Claims a code for this account. A single-document write, which is what makes two people
 *  racing the same code safe: Firestore commits one, and the other's rule then sees it taken.
 *  Returns null on success, or the reason it failed. */
/** Claims a code for one account *and one address*, in a single document write.
 *
 *  Binding the address here rather than after the organisation exists is what makes a code
 *  good for exactly one organisation. If the claim only recorded who used it, the rule
 *  guarding org creation — "the invite you name must already be claimed by you" — would stay
 *  true forever afterwards, and the same code would mint organisations without limit.
 *
 *  It is also the only moment the rules will accept the write: once `usedBy` is set, the
 *  claim branch closes and nobody but Runway staff can touch the invite again.
 *
 *  Returns null on success, or a sentence to show the person. */
export async function claimInvite(
  code: string,
  uid: string,
  orgSlug: string,
  orgAddress: string,
): Promise<string | null> {
  const key = code.trim().toUpperCase();
  if (!key) return 'Enter the invite code Runway gave you.';

  try {
    const snap = await getDoc(inviteRef(key));
    if (!snap.exists()) return 'That invite code is not recognised.';
    const invite = snap.data() as OrgInvite;
    if (invite.revoked) return 'That invite code has been withdrawn.';
    if (invite.usedBy && invite.usedBy !== uid) return 'That invite code has already been used.';
    if (invite.usedBy === uid) {
      // Ours already. Resuming the same address is fine — a half-finished setup, most
      // likely — but a different one is a second organisation, which one code does not buy.
      return invite.orgSlug === orgSlug
        ? null
        : `That code was already used for /${invite.orgAddress ?? invite.orgSlug}. Ask Runway for another.`;
    }

    await updateDoc(inviteRef(key), { usedBy: uid, usedAt: serverTimestamp(), orgSlug, orgAddress });
    return null;
  } catch (e) {
    console.error('[runway/platform]', e);
    return 'That invite code could not be used.';
  }
}

export const adminBootstrapHint = (uid: string) =>
  `In the Firebase console, open Firestore and create a document at platformAdmins/${uid}. Reload this page afterwards.`;
