# Decisions

The handoff bundle lists eight open questions and says: "Ask the product owner rather than
assuming. Where you must proceed, pick the simplest option that does not foreclose the
others, and note the assumption in code."

Nobody was available to ask, so each one below is answered with the simplest option that
keeps the alternative open. **All eight need confirming.** Each is annotated at the place in
the code that depends on it.

| # | Question | Decision | Why it does not foreclose the alternative |
| --- | --- | --- | --- |
| 1 | Rich notes, or plain text with promotion? | **Plain text with line promotion.** A note is a body of lines; the line the caret sits on becomes a task (`⌘↵` or "Make this line a task"). | Promotions are stored as `{taskId, lineText}` against the note, not as markup inside the body. A rich-text body can replace the string later and the promotion records still resolve. `src/store/types.ts` → `NotePromotion` |
| 2 | Concurrent editing of a shared note, or last-write-wins? | **Last-write-wins, no lock.** The autosave debounce is the only write path. | Nothing in the note model assumes a single writer; a CRDT body would change `note/update` only. `src/screens/NoteEditor.tsx` |
| 3 | Sideways hand-off with approval, or downward only? | **Downward only.** `handoffTargets` returns strict descendants of the *current owner*, and the reducer re-checks before writing. | The check is one function. A peer transfer becomes a second action type with an approval field; the history model already records `fromUserId`/`toUserId`. `src/domain/org.ts` |
| 4 | Manual time entry, or live timer only? | **Moot — time tracking is out.** The client asked for the whole feature to be removed after review, so neither option was kept. See "Removed after review" below. | Nothing in the object graph refers to elapsed time, so any tracking model is a clean addition rather than a change. |
| 5 | Are reports exportable? | **Not in v1.** Reports are on-screen only. | Every measure comes out of one pure function, `measure()`, whose return value is already a serialisable object. `src/domain/reports.ts` |
| 6 | Recurrence model for repeating tasks? | **Out of scope for v1.** No task repeats. | No field was added and no code branches on it, so a `recurrence` rule can be introduced without migrating existing tasks. |
| 7 | Which platforms does mobile cover, native or web shell? | **One responsive web client.** Below 768px the sidebar becomes a tab bar, task detail becomes a full route, and Reports/Team lose their editing controls. | The client is a thin layer over the store and the domain functions; a native client would reuse `src/domain/*` unchanged. `src/lib/useMediaQuery.ts` |
| 8 | Backend and auth story? | **Neither, in v1.** State lives in `localStorage`; identity is a member switcher, not a login. Writes land locally, enter a queue, and drain in the background. | The queue and the drain are the seam. A real API implements the drain inside `StoreProvider`; no screen, no reducer case, and no domain function changes. `src/store/StoreContext.tsx`, `src/store/persist.ts` |

The bundle's ninth question — what differentiates Runway in one sentence — is a positioning
question, not an implementation one. It is unanswered and it should be settled before any
more scope is added.

## Removed after review

**Time tracking is gone at the client's request.** This is a deliberate deviation from the
handoff bundle, which mandates it in three places: §2.3 ("time tracking attaches to a task,
not to a calendar block"), §3 (home's one fixed CTA is "Start tracking"), and §5 ("time
tracked, split by task and by day" as a required report measure).

What changed:

| Was | Now |
| --- | --- |
| `TimeEntry` records and the `timeEntries` collection | Deleted from the object graph |
| `timer/start` / `timer/stop` actions, the `tracked` history event | Deleted |
| Fixed CTA "Start tracking", with a task picker when nothing was scheduled | Fixed CTA is **"Add task"**; the bar still answers "up next" beside it (`src/components/shell/ActionBar.tsx`) |
| Home tile "Tracked this week" | "Due today" |
| Home trend line "hours tracked" | "tasks closed" |
| Reports tile "Time tracked" | "Tasks opened" |
| Reports charts "time tracked by day" / "by task" | "Tasks opened by day" / "Open work by folder" |
| Reports per-person "Tracked" column | Removed; Closed / Overdue / On time remain |
| Task detail "Tracked" row and "Start tracking" button | "Raised" row and "Open the week" |

The remaining §5 measures — tasks closed, tasks opened, on-time completion rate, and open
load split by overdue/due/unscheduled — are untouched and still derived from task history.
Choosing the replacement fixed CTA was a judgement call: §3 requires exactly one primary
action reachable without scrolling, and "Add task" is the only action meaningful on every
screen.

The storage key moved to `runway.state.v2` so a cached v1 state containing `timeEntries`
falls through to a fresh seed instead of half-loading.

## Notifications, and what a backend would add

System notifications were added on request. Two judgement calls worth flagging:

- **Alerts fire whether or not the tab is focused.** Many apps suppress a system notification
  while the user is looking at the app. Runway does not, because the request was for the alert
  itself and predictable behaviour is easier to trust than a rule about focus. If it proves
  noisy, the check is one line in `lib/useSystemNotifications.ts`.
- **Three alerts per pass, maximum.** A user returning to a board full of passed deadlines gets
  the three most urgent as system notifications; the rest are in the in-app list and are marked
  surfaced so they do not queue up to fire later.

The reminder window (one hour before) and the staleness cut-off (24 hours) are guesses. They
are two constants at the top of `domain/reminders.ts` and should be a user setting if anyone
disagrees with them.

## Sections, added after review

The spec models the organisation as a pure manager tree (§4) and never mentions departments,
so **sections are an addition**, asked for after review. Two decisions worth recording:

- **A section is a label, not a permission boundary.** Visibility and hand-off still follow the
  reporting tree and nothing else, so moving somebody between sections changes no access. The
  alternative — sections as access groups — would have created a second hierarchy competing
  with the tree the spec calls "the permission model, not just a diagram".
- **Sections are flat.** The reporting tree already carries hierarchy; nesting sections as well
  gives two hierarchies to reconcile, which is how an org chart becomes unreadable. If nesting
  is genuinely wanted, `Section` needs a `parentId` and the same cycle check the org tree has.

Deleting a section keeps every member and every reporting line, exactly as deleting a folder
keeps its tasks and notes — same rule, so neither surprises anyone.

`org/invite` was also renamed in the UI from "Send invite" to **"Add member"**: it creates the
account outright, and with no backend to send mail from, a button promising an invite would be
claiming something the product does not do.

## The owner's account

Asked for after review: the organiser who buys Runway should name themselves and set a
password. This shipped in two passes.

The first pass had no backend, so it was a **local device lock** — PBKDF2 over a passphrase,
labelled honestly as "locks this browser" rather than dressed up as account security, because
a client-side check on plaintext local data is a lock on a door with no walls.

The second pass replaced it with **Firebase Auth**, once a probe showed the Email/Password
provider was already enabled on the project. That is a genuine upgrade: the password is
verified server side, never touches our code beyond being typed, works on any device, and can
be reset over email instead of only by erasing everything. `src/lib/lock.ts` was deleted
rather than kept alongside — two competing notions of "signed in" is how sessions get confusing.

What is still true, and what the sign-in screen says: **the account is portable, the work is
not.** Tasks and notes remain in `localStorage`, now keyed per account so two people sharing a
computer cannot open each other's board. Making the work follow the account needs Firestore,
which is the remaining piece.

Two details worth recording:

- **The board is seeded from the name typed at sign-up, not from the auth listener.** Firebase
  emits `onAuthStateChanged` the moment the user exists, which is *before* `updateProfile`
  lands, so reading the display name there seeded boards named after the email prefix. The
  sign-up form now hands the typed name over before creating the account.
- **Password reset always reports success**, whether or not the address is registered, so the
  form cannot be used to discover who has an account.

## Organisations in the URL

Asked for after review: an organisation should be an address — `/ArenaErbil` — not something
bound to one browser. That is what moved the data off the device and into Firestore.

Decisions worth recording:

- **Frankfurt (`europe-west3`), chosen by the client.** Firestore's region is permanent; Doha
  and Dammam were the lower-latency options for Erbil, Frankfurt the broader-feature one.
- **Joining is by shared code, also the client's choice.** The alternatives were invite-by-email
  (safest, needs every address up front) and open-by-link (anyone with the URL walks in). The
  code is verified by security rules rather than by the page, so it cannot be bypassed from the
  console.
- **Members sign themselves up.** Firebase will not let one account create another from the
  browser — `createUserWithEmailAndPassword` signs you in *as* the new person — so an admin
  minting accounts needs the Admin SDK on a server, which needs the paid plan. Self-signup also
  gives each person a real password of their own. "Add member" therefore hands over the address
  and the code rather than creating anybody.
- **The slug carries capitals, the document id does not.** `/ArenaErbil` and `/arenaerbil`
  resolve to the same org; the address is stored as typed so the pretty one is what people see.
- **The reducer was not rewritten.** `store/sync.ts` diffs successive states and writes only the
  documents that changed, so every screen, action and domain function stayed as it was. The cost
  is last-write-wins per document, which is acceptable for a team of 5–50 and would need proper
  operational transforms to beat.
- **Anything that replaces the whole board is demo-only.** Load demo data, start from empty and
  the member switcher are hidden inside a real org, where they would wipe or impersonate shared
  work.

### The gap to close

Security rules enforce org membership, private notes and per-recipient notifications. They do
**not** enforce §4's subtree rule for tasks: it is a graph traversal, and rules cannot walk a
tree, so tasks are org-readable and the tree is applied in the client. Closing it means writing
a `visibleTo` array onto every task — the owner's manager chain plus the originator — and
matching on it in the rules. It is cheap to add up front and expensive to retrofit, and it has
to be recomputed for every affected task whenever the reporting tree changes. It is called out
at the top of `firestore.rules` rather than half-built.

Two bugs found while building this, both worth remembering:

- **Creating an org was not atomic.** The org document was written first, then the join code and
  the owner's membership in a batch — and the batch was denied, because the rule guarding the
  join code asked whether you were an admin, which depends on the very member document being
  created in that same batch. Rules evaluate against the state *before* a batch, so the answer
  was always no. The rule now also admits the org's owner, and creation resumes a half-made org
  rather than stranding the address.
- **The listener echo had to be distinguished from a local edit**, or every incoming snapshot
  would have been written straight back. `StoreContext` keeps what Firestore last reported and
  diffs against that, not against the previous render.

## Invite-only organisations

Asked for after review: nobody should be able to create an organisation just by signing up.
One comes from an invite code issued in Runway's own admin panel at **/admin**.

- **Platform admins are a collection, not a claim.** `platformAdmins/{uid}` — a document per
  member of Runway staff. Custom auth claims would be tidier and cheaper to check, but setting
  one needs the Admin SDK on a server, which needs the paid plan. A document is readable from
  the rules with `exists()`, which is all the gate needs.
- **The first admin is created in the Firebase console, deliberately.** Every self-service
  alternative is worse: "first person to claim it wins" is a race on a public URL, and a
  bootstrap secret has to live in the repository, in a build, or in a chat log. The console is
  the one place that already proves who owns the project. `/admin` shows a refusal screen
  naming the exact document to create, so it is a copy-and-paste rather than a hunt.
- **A code is claimed for one account *and one address*, in one write.** This is the part that
  is easy to get wrong. The rule guarding org creation asks "is the invite you named already
  claimed by you?" — and that stays true forever once claimed, so a code that only recorded
  *who* used it would mint organisations without limit. Recording the address at the same
  moment caps it at one, and the claim branch closes as soon as `usedBy` is set, so the address
  cannot be edited afterwards either.
- **A single-document update is the claim.** Firestore makes it atomic, so two people racing
  the same code cannot both win, and a failed claim costs nothing because it happens before the
  organisation is written.
- **Codes are withdrawn, never deleted.** The record stays in the list so it is visible that
  one was issued and pulled. An audit trail you can erase from the same screen is not one.
- **Staff are added by account id.** Firebase gives the browser no way to look somebody up by
  email, so the new person signs up, opens `/admin`, and reads their id off the refusal screen.
- **Anyone signed in can read an invite document by its exact id.** That is what lets the setup
  screen say "already used" or "withdrawn" instead of a blank refusal. A code is eight
  characters from a 31-letter alphabet, so guessing one is not a practical attack, and all it
  carries is the note staff wrote to themselves.
- **`/admin` is a reserved slug**, and sits outside the organisation router entirely — it is
  one level above every organisation, so none of the board's navigation applies to it.

Runway staff are not members of any organisation and cannot read its work: the panel lists
organisations, and reading inside one still requires a member document.

## Smaller judgement calls

- **Visibility beyond the subtree.** §4 says a user sees their subtree, and also says the
  person who raised the work can still track it after two hops. Those conflict once a task
  passes to someone outside the raiser's subtree, so `visibleTaskIds` grants read access on
  three grounds: the owner is in your subtree, you raised it, or you appear in its history.
  A stricter reading would drop the last two. `src/domain/org.ts`
- **"Unscheduled" is overloaded.** The Tasks screen means *no due date* (§2.2's bucket); the
  Schedule screen means *no calendar block*. The calendar tray is therefore labelled "Not on
  the calendar" so the two never collide in the UI.
- **A member's removal keeps closed work.** §4 says open tasks reassign upward. Closed tasks
  also move to the manager rather than being deleted, so reports over past ranges stay
  correct; the history still names the person who did the work.
- **The seed is dated relative to first run.** The demo data anchors "today" to whatever hour
  it is loaded, so home always has closed work behind it and due work ahead of it.
  `src/data/seed.ts`
- **The app ships empty; the demo is opt-in.** A public build showing invented tasks as though
  they were the visitor's own is misleading, so `buildFirstRun()` is the default and
  `buildSeed()` is reached from Menu or `?demo=1`. The one default account is a placeholder —
  without auth there is no way to know a real name, and the tree needs a root. Reverting to a
  demo-by-default build is one line in `src/store/persist.ts`.
