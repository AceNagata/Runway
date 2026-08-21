# Runway

A shared planning surface for small teams: notes, tasks, a scheduler and calendar, task
hand-off down a reporting line, notifications, and on-demand reports. Built from the
`design_handoff_runway` bundle — its README is the requirements document, its
`design-system/` is the authoritative visual system.

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:5173. `npm run build` type-checks and bundles; `npm run preview`
serves the build.

**Runway starts empty** — one account, a clean board, no invented content. To see the product
with data in it:

- **Menu → Load demo data**, or open `?demo=1` — a sample team of eight with tasks, notes,
  folders and history, dated relative to whenever you load it. **Menu → Start from empty**
  puts it back.
- The sidebar's member row switches identity. Sign in as someone lower in the tree and the
  surfaces above them disappear — that is the permission model, not a UI trick. Worth doing
  with the demo loaded.

The single default account is a placeholder rather than a person: the reporting tree *is* the
permission model (§4), and there is no sign-up without a backend
([DECISIONS.md](DECISIONS.md) Q8). Invite real people from Team.

## Stack

Vite + React 18 + TypeScript, `react-router-dom` for routes, `lucide-react` for icons
(the bundle mandates Lucide 0.469.0). No CSS framework and no state library: the design
system is plain CSS custom properties, and the store is a reducer plus `localStorage`.

There is no backend in v1 — see [DECISIONS.md](DECISIONS.md) Q8 for the seam where one drops in.

## Layout

```
src/
  styles/
    tokens/          The seven token files, copied verbatim from the handoff
    design-system.css  The bundle's @import entry point, unchanged
    app.css          Application styles. Reads tokens only — no hex literal lives here
  store/
    types.ts         The object graph: users, folders, tasks, notes, notifications
    reducer.ts       Every mutation. One write path per object
    persist.ts       Cached local state, so a returning user never sees a loading screen
    StoreContext.tsx Provider, the write queue drain, the shared clock, debounce helper
  domain/
    tasks.ts         Derived status, grouping, custody chain, calendar lane layout
    org.ts           The reporting tree: subtree, visibility, hand-off targets, cycle checks
    reports.ts       Measures derived from task history, computed client-side
  components/
    ui/              Primitives: Button, Card, Avatar, Tabs, Dialog, Toast, charts, the mark
    shell/           Sidebar, top bar, detail panel, action bar, dialogs, search
    TaskRow.tsx      The shared list row, including the completion flourish
  screens/           Home, Tasks, Folder, Schedule, Notes, NoteEditor, Team, Reports, Menu
                     Team is the admin surface: members, sections, reporting tree
  data/seed.ts       buildFirstRun() is the default empty state; buildSeed() is the opt-in demo
  lib/notify.ts      Permission, system notifications, service-worker registration
  lib/firebase.ts    Firebase app, auth and Firestore init (config is public by design)
  lib/auth.ts        Sign up, sign in, reset, and readable messages for Firebase codes
  lib/org.ts         Slugs, org creation, joining by code
  store/sync.ts      Live listeners in, per-document diffs out
firestore.rules      Who can read and write what
public/sw.js         Install, offline shell, notification clicks, a ready `push` handler
public/manifest.webmanifest
```

## How the requirements land in the code

| Requirement | Where |
| --- | --- |
| Home's four regions in fixed order; per-region empty states; first-run pass | `screens/Home.tsx` |
| One fixed primary action, reachable without scrolling | `components/shell/ActionBar.tsx` — "Add task", since tracking was removed |
| Status derived, not set — a task past due with no completion is overdue | `domain/tasks.ts` → `derivedStatus` |
| Optimistic completion: the flourish runs before the write settles | `components/TaskRow.tsx`, `.strike` in `app.css` |
| A task with no due date cannot reach the calendar | `domain/tasks.ts` → `scheduleBlockedReason`, enforced again in `reducer.ts` |
| Append-only history; hand-off auditable | `reducer.ts` → every case appends `TaskEvent`s |
| Hand-off is downward only; the originator is never cleared | `domain/org.ts` → `handoffTargets`, `domain/tasks.ts` → `custodyChain` |
| Due dates travel with a hand-off | `reducer.ts` → `task/handoff` never touches `dueAt` |
| Removing a member re-parents reports and reassigns tasks upward | `reducer.ts` → `org/remove` |
| A cycle is impossible; the edit is rejected, not partially applied | `domain/org.ts` → `reparentError`, re-checked in `org/reparent` |
| Admin lives in the web shell, not a separate app — members, sections, reporting lines | `screens/Team.tsx` at `/team`, gated on `user.admin` |
| Notes and tasks searched as one result set | `components/shell/SearchPalette.tsx` |
| A folder is a destination, not a filter — its tasks and notes on one screen | `screens/Folder.tsx` at `/folders/:folderId` |
| A note line promoted to a task, with a back-reference both ways | `reducer.ts` → `note/promote`, `screens/NoteEditor.tsx` |
| Scheduler and calendar as one dataset; dragging issues the same write | `screens/Schedule.tsx` → `place()` calls `task/schedule` |
| Overlaps rendered side by side, never blocked | `domain/tasks.ts` → `layoutDay` |
| Three notification classes, read-state per user, clearable in bulk | `reducer.ts` → `notify`, `shell/NotificationsPopover.tsx` |
| Approaching and past due times raise notifications, derived not stored | `domain/reminders.ts`, driven by `lib/useSystemNotifications.ts` |
| System notifications and installability | `lib/notify.ts`, `public/sw.js`, `public/manifest.webmanifest` |
| Measures derived from history; personal range instant | `domain/reports.ts` → `measure` |
| Charts comparative across time, never ranking people | `screens/Reports.tsx` — the per-person table is each person's own record |
| Offline tolerance: writes queue, the user is told, never blocked | `store/StoreContext.tsx`, the unsynced pill in `shell/TopBar.tsx` |
| One source of truth per object | One store; every screen reads it and dispatches the same actions |
| UTC storage, local rendering; a due date is a date-*time* | `lib/time.ts` — `toLocalInput`/`fromLocalInput` are the only crossing points |
| Keyboard reach for list nav, completion, panel dismissal | `screens/Tasks.tsx` key handler, `ui/index.tsx` → `useEscape` |
| Status never carried by colour alone | `domain/tasks.ts` → `STATUS_LABEL` pairs with every `STATUS_TONE` |

## Fidelity to the design system

The token files are copied byte-for-byte from the bundle and imported through its own
`styles.css`. `app.css` contains no colour, size, radius, shadow or duration literal — every
value is a `var(--…)`. The rules the bundle calls binding are implemented as written:

- **Cards are borderless** — lighter fill, `--shadow-2`, the 1px inner top highlight, 10px radius.
- **The folder tab** — a 3px accent or status bar clipped to a card or row's top corner, on
  cards, list rows, calendar blocks and note cards.
- **Borders divide, they do not contain** — hairline between rows, soft on inputs and panel
  seams, strong only on a focused or selected element.
- **`backdrop-filter: blur(20px)` on exactly three things** — the top bar, modal scrims, popovers.
- **Hover lightens, press only changes colour, focus is always a visible ring.** No transform
  on press anywhere. The two writing surfaces take an accent rule in the gutter instead of a
  ring, because a ring around a 400px-tall field reads as an error.
- **Motion** — fades and 150ms colour transitions, enter is fade + 4px rise over 200ms. The
  one flourish is completion: the strike wipes left-to-right over 200ms, then the row settles
  at 40%. No bounce, no spring, no scale-in, no skeleton shimmer.
- **Data viz is single-hue** — 1.5px accent stroke over a 14% accent fill, mono axis labels,
  one hairline baseline, accent arc on an `--ink-3` gauge track.
- **Dark only.** Nothing branches on theme and there is no light-mode scaffolding.
- **No emoji, no illustration, no photography.** Empty states are a Lucide glyph at 40%
  opacity plus one line of type.

The wordmark is live type — `Runway` in Manrope 800 at -0.02em. The mark is the six-light
runway from the supplied brand sheet, on its 48-unit grid with the 30/60/100 opacity ramp
intact; it is never recoloured per column, rotated or stretched (`components/ui/Mark.tsx`).

## Organisations

An organisation lives at its own address: **`/ArenaErbil`**. Everything under it belongs to
that org — `/ArenaErbil/tasks`, `/ArenaErbil/team`, `/ArenaErbil/reports`.

The address is the first path segment, and it becomes the router's `basename`, so every route
and every `navigate()` inside the app is unchanged by this. Matching is case-insensitive (the
Firestore document id is lower case) while the URL keeps whatever capitals were typed —
`/arenaerbil` and `/ArenaErbil` are the same org, and the second is what people see.

**Setting one up is by invitation.** You need a code from Runway — see
[Runway admin](#runway-admin) below. With one in hand: sign up, enter the code, then name the
organisation and choose its address; "Arena Erbil" suggests `ArenaErbil`. You become the owner
at the root of the reporting tree, and Runway shows you a **join code** once. A code is good
for exactly one organisation, at one address, and it is the security rules that hold it to
that — not the page.

**Joining.** Anyone who opens `/ArenaErbil`, creates an account, and enters the join code lands
in the org under the owner, ready to be moved in Team. A stranger who finds the URL without
the code gets nothing — the code is checked by security rules, not by the page, so guessing at
it is pointless. The code lives in **Team → Add member** alongside the address.

## Where the data lives

**Firestore, in Frankfurt (`europe-west3`)** — chosen for latency from Erbil against the
broadest feature support. The region is permanent.

```
platformAdmins/{uid}            Runway staff — one document per person
orgInvites/{code}               who it went to, who claimed it, for which address
orgs/{slug}                     name, address, ownerUid, the invite it was created with
orgs/{slug}/private/config      the join code — never readable outside the org
orgs/{slug}/members/{uid}       one per person, keyed by their Firebase uid
orgs/{slug}/{sections,folders,tasks,notes,notifications}
```

The reducer did not change. `store/sync.ts` sits underneath it: live listeners bring other
people's edits in, and every dispatch writes back only the documents that actually differ.
Reads still land instantly because the reducer applies each change locally first and Firestore
confirms a moment later, so §3's "never a full-screen loading state" still holds. Conflicts are
last-write-wins **per document**, so ordinary concurrent work does not collide.

Accounts are Firebase Auth: the password is verified server side, never stored by this code,
works on any device, and is resettable by email. `?demo=1` bypasses all of it — the demo is
local to the browser, needs no account, and writes to nobody's data.

## What the security rules do and do not enforce

`firestore.rules` enforces: you must be a member of an org to read any of its work; private
notes are readable only by their owner; notifications only by their recipient; only admins
edit membership, sections or the org; joining requires the code and can never make you an
admin; creating an organisation takes an invite claimed for that exact address, or Runway
staff; and nobody can promote themselves to staff or mint their own invite.

**It does not enforce §4's subtree rule.** "You see everyone below you and nobody sideways or
above" is a graph traversal, and Firestore rules cannot walk a tree, so **tasks are readable
by any member of the org** and the subtree rule is applied in the client. A determined member
could read a task outside their subtree through the API. Hardening it means denormalising a
`visibleTo` array onto each task — see the note at the top of `firestore.rules` and
[DECISIONS.md](DECISIONS.md).

## Admin

There is no separate admin app — §6.3 puts admin inside the web shell, so it is the **Team**
screen at `/team`, reached from the sidebar and gated on a member's `admin` flag. It is the
only place membership, sections and reporting lines can be edited.

It shows the organisation two ways:

- **Reporting tree** — who reports to whom, drawn as an indented tree. This one *is* the
  permission model (§4): you see everyone below you and nobody sideways or above, and a task
  can only be handed down it. Editing a line is transactional — a cycle is rejected outright
  rather than half-applied.
- **Sections** — Product, Design, Operations and so on, with members grouped under each and an
  explicit "No section" group. Sections are **labels only**: they never grant or remove access,
  which is why they are flat and freely editable. Deleting one leaves everybody in place,
  sectionless.

From here an admin can add a member (choosing both their manager and their section), edit a
member's role, section and admin flag, move them to a different manager, and remove them —
which re-parents their reports and reassigns their open tasks upward, never orphaning either.

"Add member" hands over the organisation's address and join code rather than creating an
account: Firebase will not let one account create another from the browser —
`createUserWithEmailAndPassword` signs you in *as* the new person — so people sign themselves
up and each ends up with a real password of their own. On mobile the tree is read-only (§6.2),
so the editing controls are hidden and a line of copy says why.

## Runway admin

One level above every organisation is Runway's own panel at **`/admin`**. It is where
organisations come from, and it is staff-only.

- **Organisations** — every one on the platform, with its address. Staff can open one, but
  reading inside it still needs a member document, so the list is not a back door into anyone's
  work.
- **Invites** — issue a code, note who it is for, copy it, and withdraw it if it goes astray.
  A code works once, for one address. Used and withdrawn codes stay on the list rather than
  disappearing, so the record of what was issued survives.
- **Runway staff** — add or remove the people who can see this panel.

Staff can also create an organisation directly: "Create one directly" drops into the ordinary
setup flow, which skips the invite field when you are staff.

**The first admin is created in the Firebase console.** Sign in, open `/admin`, and it names
the exact document to create — `platformAdmins/{your-uid}` — with your account id ready to
copy. Reload and the panel opens. After that, staff add each other from the panel itself.
This one step is deliberate rather than an omission: every self-service alternative either
races on a public URL or puts a bootstrap secret somewhere it can leak. See
[DECISIONS.md](DECISIONS.md).

## Notifications

Three things raise a notification, matching §2.4: work assigned or handed to you, a due time
approaching or passed, and a change to something you handed off. They land in the in-app list
and — once you turn alerts on — in the operating system.

- **Turning them on.** The control is at the foot of the notifications popover, and in Menu on
  mobile. Permission is only ever requested from that click; asking on load is how a site gets
  blocked permanently.
- **Deadlines** are watched by `domain/reminders.ts` against the signed-in user's own tasks:
  once when a due time is within the hour, once when it passes. Keys are
  `taskId:dueAt:kind`, so a reminder never repeats and moving a due date re-arms it. Reminders
  more than 24h stale are skipped, so returning to a neglected board is not a wall of alerts.
- **Installable.** The manifest and service worker make Runway installable on desktop and
  Android; the worker also serves the app shell from cache so it opens offline (§7), routes a
  notification click to the task it is about, and focuses an open window instead of opening tabs.
- **iOS** only grants notification permission to an installed app (Safari 16.4+). The UI detects
  this and says to add it to the home screen rather than failing silently.

**The limit, stated plainly: alerts only fire while Runway is running** — a tab may be in the
background and they still arrive, but once the app is fully closed nothing does, because
scheduling then belongs to a push server and this build has no backend. A web page cannot run
background timers. `public/sw.js` already handles `push` with the same payload shape the client
sends locally, so adding Web Push later is VAPID keys plus a subscription store, with no client
changes. The same backend is what would let one person's assignment reach another person's
device; today both users are identities on one browser.

## Known gaps

- **No backend, no auth.** State is per-browser. Two people cannot actually share a note.
- **There is no time tracking.** It was removed at the client's request after review, which
  is a deliberate deviation from the handoff spec (§2.3, §3, §5 all require it). What was
  taken out and what replaced it is listed under "Removed after review" in
  [DECISIONS.md](DECISIONS.md).
- **Reports do not export** and tasks do not repeat — see [DECISIONS.md](DECISIONS.md) Q5–Q6.
- **Calendar drag moves a block; it does not resize one.** Length is edited in the reschedule
  dialog.
- **Folders are flat.** No nesting, and a folder is a label rather than a container — deleting
  one leaves its tasks and notes in place, folderless.
- **A promoted note line is matched by its text.** Edit that line and the link drops, which
  the reducer prunes rather than leaving dangling.
- **Alerts stop when the app is closed**, and cannot cross devices — both need the backend
  described under Notifications above.
- **No automated tests.** The domain layer (`derivedStatus`, `reparentError`, `layoutDay`,
  `measure`, `pendingReminders`) is pure and is the right place to start.
