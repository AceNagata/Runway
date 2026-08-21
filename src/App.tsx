import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, EmptyState, ICON, ToastHost } from './components/ui';
import { Sidebar } from './components/shell/Sidebar';
import { TopBar } from './components/shell/TopBar';
import { ActionBar } from './components/shell/ActionBar';
import { MobileTabBar } from './components/shell/MobileTabBar';
import { TaskDetailPanel } from './components/shell/TaskDetailPanel';
import { SearchPalette } from './components/shell/SearchPalette';
import { AddTaskDialog } from './components/shell/TaskDialogs';
import { Home } from './screens/Home';
import { Tasks } from './screens/Tasks';
import { Schedule } from './screens/Schedule';
import { Notes } from './screens/Notes';
import { NoteEditor } from './screens/NoteEditor';
import { Team } from './screens/Team';
import { Reports } from './screens/Reports';
import { Menu } from './screens/Menu';
import { Folder } from './screens/Folder';
import { SignIn } from './screens/SignIn';
import { OrgGate } from './screens/OrgGate';
import { AdminPanel } from './screens/AdminPanel';
import { StoreProvider, useNow, useStore } from './store/StoreContext';
import { useIsMobile } from './lib/useMediaQuery';
import { useSystemNotifications } from './lib/useSystemNotifications';
import { ownerName, watchAuth, type AuthedOwner } from './lib/auth';
import { readMember, readOrg, type Org } from './lib/org';

const TITLES: Array<[RegExp, string]> = [
  [/^\/$/, 'Home'],
  [/^\/tasks/, 'Tasks'],
  [/^\/task\//, 'Task'],
  [/^\/schedule/, 'Schedule'],
  [/^\/folders\//, 'Folder'],
  [/^\/notes\/.+/, 'Note'],
  [/^\/notes/, 'Notes'],
  [/^\/team/, 'Team'],
  [/^\/reports/, 'Reports'],
  [/^\/menu/, 'Menu'],
];

/** Resolves, in order: who you are, which organisation the URL points at, and whether you
 *  belong to it. Only then does a board mount.
 *
 *  The organisation is the first path segment — /ArenaErbil — and it becomes the router's
 *  basename, so every route and every navigate() inside the app stays exactly as it was.
 *  Matching is case-insensitive (the document id is lower case) but the address keeps the
 *  capitalisation somebody typed, because /ArenaErbil reads better than /arenaerbil. */
export default function App() {
  const isDemo = new URLSearchParams(location.search).get('demo') === '1';
  const first = location.pathname.split('/').filter(Boolean)[0] ?? null;
  // /admin is Runway's own panel, not an organisation. It is in the reserved list in
  // lib/org.ts, so no organisation can ever take the address out from under it.
  const isAdminPanel = first?.toLowerCase() === 'admin';
  const pathSlug = isAdminPanel ? null : first;
  const orgId = pathSlug ? pathSlug.toLowerCase() : null;

  const [owner, setOwner] = useState<AuthedOwner | null>(null);
  // Firebase restores a session asynchronously, so "nobody is signed in" and "we have not
  // looked yet" are different states. Showing sign-in during the second one would flash it
  // at somebody who is already signed in.
  const [checked, setChecked] = useState(isDemo);
  const [org, setOrg] = useState<Org | null>(null);
  const [member, setMember] = useState<boolean | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const nameHint = useRef<string>('');

  useEffect(() => {
    if (isDemo) return;
    return watchAuth((next) => {
      setOwner(next);
      setChecked(true);
    });
  }, [isDemo]);

  // Look up the org named in the URL, and whether this account is in it.
  useEffect(() => {
    if (isDemo || !owner || !orgId) {
      setMember(null);
      return;
    }
    let alive = true;
    setMember(null);
    void (async () => {
      const found = await readOrg(orgId).catch(() => null);
      if (!alive) return;
      setOrg(found);
      if (!found) return setMember(false);
      const mine = await readMember(orgId, owner.uid).catch(() => null);
      if (alive) setMember(Boolean(mine));
    })();
    return () => {
      alive = false;
    };
  }, [isDemo, owner, orgId]);

  const enter = useCallback((slug: string) => {
    // A full load, so the router mounts with the new basename and the listeners attach once.
    location.assign(`/${slug}`);
  }, []);

  if (!checked) return <div className="gate" />;

  if (!isDemo) {
    if (!owner) {
      return (
        <SignIn
          onIntent={(n) => {
            nameHint.current = n;
          }}
          onAuthed={(next) => {
            nameHint.current = next.name || nameHint.current;
            setOwner(next);
          }}
        />
      );
    }
    if (isAdminPanel) return <AdminPanel owner={owner} />;
    // No organisation in the URL, or one this account is not in yet.
    if (!orgId || member === false) {
      return <OrgGate owner={owner} slug={orgId} org={org} onReady={enter} />;
    }
    if (member === null) return <div className="gate" />;
  }

  return (
    <BrowserRouter basename={isDemo ? undefined : `/${pathSlug}`}>
      <StoreProvider
        key={orgId ?? 'demo'}
        ownerName={owner ? ownerName(owner, nameHint.current) : undefined}
        org={isDemo || !owner || !orgId ? undefined : { slug: orgId, uid: owner.uid }}
        onError={setFatal}
      >
        <ToastHost>
          <Shell fatal={fatal} onDismissFatal={() => setFatal(null)} />
        </ToastHost>
      </StoreProvider>
    </BrowserRouter>
  );
}

function Shell({ fatal, onDismissFatal }: { fatal: string | null; onDismissFatal: () => void }) {
  const { state, ready } = useStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();

  // One clock for the whole tree. Derived status only needs minute granularity, so this
  // ticks every 30s rather than every second.
  const now = useNow(30_000);

  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  // Watches this user's deadlines and hands new notifications to the operating system.
  useSystemNotifications(now);

  const selectedId = params.get('task');
  const selected = selectedId ? state.tasks[selectedId] : undefined;

  /** Contextual detail is a panel on the web and a full route on mobile. §6.1/§6.2 */
  const openTask = useCallback(
    (id: string) => {
      if (isMobile) {
        navigate(`/task/${id}`);
        return;
      }
      const next = new URLSearchParams(params);
      next.set('task', id);
      setParams(next, { replace: true });
    },
    [isMobile, navigate, params, setParams],
  );

  const closeTask = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete('task');
    setParams(next, { replace: true });
  }, [params, setParams]);

  // A selected task that disappears (deleted, or no longer visible) must not wedge the panel.
  useEffect(() => {
    if (selectedId && !state.tasks[selectedId]) closeTask();
  }, [selectedId, state.tasks, closeTask]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        setSearching(true);
      } else if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setAdding(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? 'Runway';

  // Only ever true on the very first load of an organisation, before any of its documents
  // have arrived. A returning visitor to the demo, or a second render here, never sees it.
  if (!ready) return <div className="gate" />;

  return (
    <div className="app">
      {fatal && (
        <div className="fatal-bar" role="alert">
          <span>{fatal}</span>
          <Button variant="ghost" size="sm" onClick={onDismissFatal}>
            Dismiss
          </Button>
        </div>
      )}
      <Sidebar />

      <main className="main">
        <TopBar
          title={title}
          now={now}
          onSearch={() => setSearching(true)}
          onAddTask={() => setAdding(true)}
        />

        <div className="body-row">
          <div className="centre">
            <Routes>
              <Route
                path="/"
                element={
                  <Home
                    now={now}
                    onOpenTask={openTask}
                    onAddTask={() => setAdding(true)}
                  />
                }
              />
              <Route
                path="/tasks"
                element={
                  <Tasks
                    now={now}
                    selectedId={selectedId}
                    onOpenTask={openTask}
                    onCloseTask={closeTask}
                    onAddTask={() => setAdding(true)}
                  />
                }
              />
              <Route path="/task/:taskId" element={<TaskRoute now={now} />} />
              <Route
                path="/folders/:folderId"
                element={
                  <Folder
                    now={now}
                    selectedId={selectedId}
                    onOpenTask={openTask}
                    onCloseTask={closeTask}
                  />
                }
              />
              <Route path="/schedule" element={<Schedule now={now} onOpenTask={openTask} />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/notes/:noteId" element={<NoteEditor onOpenTask={openTask} />} />
              <Route path="/team" element={<Team />} />
              <Route path="/reports" element={<Reports now={now} />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>

          {selected && !isMobile && (
            <TaskDetailPanel task={selected} now={now} onClose={closeTask} />
          )}
        </div>

        {/* The primary action is fixed: it never scrolls out of reach. §3 */}
        <ActionBar now={now} onAddTask={() => setAdding(true)} />
        <MobileTabBar />
      </main>

      {searching && <SearchPalette onClose={() => setSearching(false)} />}
      {adding && <AddTaskDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

/** The mobile full route for task detail. Same component, same writes. */
function TaskRoute({ now }: { now: Date }) {
  const { taskId } = useParams<{ taskId: string }>();
  const { state } = useStore();
  const navigate = useNavigate();
  const task = taskId ? state.tasks[taskId] : undefined;

  if (!task) {
    return (
      <div className="screen">
        <Card>
          <EmptyState
            icon={<ArrowLeft size={24} {...ICON} />}
            line="That task is no longer here."
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
                Back to tasks
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return <TaskDetailPanel task={task} now={now} asRoute onClose={() => navigate('/tasks')} />;
}
