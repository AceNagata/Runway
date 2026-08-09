import { useCallback, useEffect, useState } from 'react';
import {
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
import { Setup } from './screens/Setup';
import { Lock } from './screens/Lock';
import { StoreProvider, useNow, useStore } from './store/StoreContext';
import { useIsMobile } from './lib/useMediaQuery';
import { useSystemNotifications } from './lib/useSystemNotifications';
import { hasAccount, isUnlocked } from './lib/lock';

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

/** The gate sits outside StoreProvider, so nothing reads or writes the board until the owner
 *  is through it. `?demo=1` skips the gate entirely — the demo holds nothing worth locking and
 *  a public demo link should not ask a stranger to invent a passphrase. */
export default function App() {
  const isDemo = new URLSearchParams(location.search).get('demo') === '1';
  const [state, setState] = useState<'setup' | 'locked' | 'open'>(() => {
    if (isDemo) return 'open';
    if (!hasAccount()) return 'setup';
    return isUnlocked() ? 'open' : 'locked';
  });

  if (state === 'setup') {
    // Reload rather than transitioning: the store seeds its owner from the saved name, and
    // reading it once at load is simpler than teaching the store to change identity midway.
    return <Setup onDone={() => location.replace('/')} />;
  }
  if (state === 'locked') return <Lock onUnlocked={() => setState('open')} />;

  return (
    <StoreProvider>
      <ToastHost>
        <Shell />
      </ToastHost>
    </StoreProvider>
  );
}

function Shell() {
  const { state } = useStore();
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

  return (
    <div className="app">
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
