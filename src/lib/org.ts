import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { User } from '../store/types';

/** An organisation lives at a URL: /ArenaErbil is the org whose slug is "arenaerbil".
 *
 *  The slug is the document id, which makes the URL and the storage key the same thing and
 *  means no lookup is needed to open one. Matching is case-insensitive — /ArenaErbil and
 *  /arenaerbil are the same org — because a URL people type by hand cannot depend on case. */

export interface Org {
  /** Lower-case document id. */
  slug: string;
  /** As typed: "Arena Erbil". */
  name: string;
  /** The address with its capitalisation, e.g. "ArenaErbil". */
  address: string;
  ownerUid: string;
}

/** Reserved so an org can never shadow a route the app already owns. */
const RESERVED = new Set([
  'tasks', 'task', 'schedule', 'notes', 'note', 'team', 'reports', 'menu', 'folders',
  'assets', 'icons', 'sw.js', 'manifest.webmanifest', 'favicon.svg', 'api', 'admin',
  'signin', 'sign-in', 'signup', 'sign-up', 'new', 'join', 'index.html', 'robots.txt',
]);

/** The address as it appears in the URL, keeping whatever capitalisation was typed —
 *  /ArenaErbil reads better than /arena-erbil. Only the characters a URL can carry survive. */
export const normaliseSlug = (input: string): string =>
  input.trim().replace(/[^A-Za-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 40);

/** Suggested from the organisation's name: "Arena Erbil" becomes "ArenaErbil". */
export const suggestSlug = (name: string): string =>
  normaliseSlug(name.replace(/[^A-Za-z0-9]+/g, ''));

/** The document id, and what makes /ArenaErbil and /arenaerbil the same organisation. */
export const orgIdOf = (slug: string): string => slug.toLowerCase();

/** Null when acceptable, otherwise the reason — stated as the problem and the fix. §Copy */
export function slugError(slug: string): string | null {
  if (slug.length < 2) return 'Use at least two characters.';
  if (slug.length > 40) return 'Keep it under 40 characters.';
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9]$/.test(slug)) {
    return 'Use letters, numbers and hyphens, starting and ending with a letter or number.';
  }
  if (RESERVED.has(orgIdOf(slug))) return 'That address is used by the app itself. Pick another.';
  return null;
}

/** Readable, unambiguous, and short enough to say out loud. No 0/O or 1/I/L. */
export function makeJoinCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

export const orgRef = (slug: string) => doc(db, 'orgs', slug);
export const memberRef = (slug: string, uid: string) => doc(db, 'orgs', slug, 'members', uid);
const configRef = (slug: string) => doc(db, 'orgs', slug, 'private', 'config');

export async function readOrg(slug: string): Promise<Org | null> {
  const snap = await getDoc(orgRef(slug));
  return snap.exists() ? (snap.data() as Org) : null;
}

export async function readMember(slug: string, uid: string): Promise<User | null> {
  const snap = await getDoc(memberRef(slug, uid));
  return snap.exists() ? (snap.data() as User) : null;
}

export async function readJoinCode(slug: string): Promise<string | null> {
  try {
    const snap = await getDoc(configRef(slug));
    return snap.exists() ? ((snap.data().joinCode as string) ?? null) : null;
  } catch {
    // Only admins may read it; anyone else simply does not see the code.
    return null;
  }
}

export interface CreateOrgResult {
  org?: Org;
  joinCode?: string;
  error?: string;
}


/** Creates the org, its join code, and the owner's own member document — the owner is the
 *  root of the reporting tree, which is why they have no manager.
 *
 *  `inviteCode` must already be claimed by this account (see platform.claimInvite), or be
 *  omitted by a platform admin creating one directly. The security rules check both; passing
 *  a code you have not claimed simply fails. */
export async function createOrg(
  name: string,
  typedSlug: string,
  owner: { uid: string; name: string },
  inviteCode?: string,
): Promise<CreateOrgResult> {
  const problem = slugError(typedSlug);
  if (problem) return { error: problem };

  // The id is lower case; the address keeps its capitals.
  const slug = orgIdOf(typedSlug);
  const existing = await readOrg(slug).catch(() => null);
  // Somebody else's organisation. An unfinished one of your own is resumed below instead of
  // stranding the address: creation is two writes, and the first can land without the second.
  if (existing && existing.ownerUid !== owner.uid) {
    return { error: 'That address is taken. Pick another.' };
  }

  const joinCode = makeJoinCode();
  const org: Org = { slug, name: name.trim(), ownerUid: owner.uid, address: typedSlug };

  try {
    // The org document must exist before the member rule can check ownerUid against it.
    if (!existing) {
      await setDoc(orgRef(slug), {
        ...org,
        // Recorded on the org so the rule can verify the claim, and so the panel can trace
        // which invite produced which customer.
        ...(inviteCode ? { inviteCode: inviteCode.trim().toUpperCase() } : {}),
        createdAt: serverTimestamp(),
      });
    }

    const batch = writeBatch(db);
    batch.set(configRef(slug), { joinCode });
    batch.set(memberRef(slug, owner.uid), {
      id: owner.uid,
      name: owner.name,
      handle: `@${(owner.name.split(/\s+/)[0] || 'owner').toLowerCase()}`,
      role: 'Owner',
      managerId: null,
      admin: true,
      sectionId: null,
    } satisfies User);
    await batch.commit();

    return { org, joinCode };
  } catch (e) {
    return {
      error: describe(
        e,
        inviteCode
          ? 'That organisation could not be created. The invite code may already be used.'
          : 'That organisation could not be created.',
      ),
    };
  }
}

/** Joins an existing org. The code is checked by the security rules, not here — this call
 *  simply fails if it is wrong, which is what makes guessing pointless. */
export async function joinOrg(
  slug: string,
  code: string,
  person: { uid: string; name: string },
): Promise<{ error?: string }> {
  const org = await readOrg(slug).catch(() => null);
  if (!org) return { error: 'No organisation lives at that address.' };

  try {
    await setDoc(memberRef(slug, person.uid), {
      id: person.uid,
      name: person.name,
      handle: `@${(person.name.split(/\s+/)[0] || 'member').toLowerCase()}`,
      role: 'Team member',
      // Everyone joining lands under the owner until an admin moves them.
      managerId: org.ownerUid,
      admin: false,
      sectionId: null,
      joinedWith: code.trim().toUpperCase(),
    });
    return {};
  } catch (e) {
    // The rules reject a wrong code, so this is the message that matters most.
    return { error: describe(e, 'That join code is not right for this organisation.') };
  }
}

function describe(e: unknown, fallback: string): string {
  // Logged in full: a generic message on screen is right for the person, and useless for
  // whoever has to work out why it happened.
  console.error('[runway/org]', e);
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (code === 'permission-denied') return fallback;
  if (code === 'unavailable') return 'No connection to the server. Try again.';
  if (code) return `${fallback} (${code})`;
  return fallback;
}
