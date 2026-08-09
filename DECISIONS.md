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

## The owner's passphrase

Asked for after review: the organiser who buys Runway should name themselves and set a
password. The name half is straightforward and real. The password half is not, and the
implementation is deliberately honest about it.

**With no backend, a client-side password cannot protect data.** The tasks and notes live in
`localStorage` in plain text; any password check runs in code the visitor controls, and the
record behind it can simply be deleted. So what shipped is a **device lock**, labelled as one
on both the setup and lock screens, rather than a login box implying account security that
does not exist.

What is still done properly, because there was no reason to do it badly:

- The passphrase is never stored. Only a PBKDF2-SHA-256 derivation is — 200,000 iterations,
  16 random bytes of salt — so the stored record does not reveal it and the same passphrase
  produces a different record on each device.
- Verification compares in constant time.
- The credential lives in its own `localStorage` key, not in `RunwayState`, so loading or
  clearing the demo cannot lock the owner out.
- "I've forgotten it" offers only to erase and start over, and says so, because there is
  genuinely nobody to reset it. Pretending otherwise would lose someone their data.

Real accounts need Firebase Auth (passwords held by Google, never by us) plus Firestore for
shared data. `src/lib/lock.ts` is the seam: replace derive/verify with
`signInWithEmailAndPassword` and the screens above it do not change.

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
