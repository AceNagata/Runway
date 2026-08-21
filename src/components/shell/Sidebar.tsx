import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, FileText, Home, ListChecks, Plus, Users } from 'lucide-react';
import { Avatar, ICON, Mono } from '../ui';
import { Wordmark } from '../ui/Mark';
import { useStore } from '../../store/StoreContext';
import { subtree } from '../../domain/org';
import { derivedStatus } from '../../domain/tasks';
import { SwitchUserDialog } from './SwitchUserDialog';
import { NewFolderDialog } from './FolderDialogs';

const NAV = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/tasks', label: 'Tasks', Icon: ListChecks },
  { to: '/schedule', label: 'Schedule', Icon: CalendarDays },
  { to: '/notes', label: 'Notes', Icon: FileText },
  { to: '/team', label: 'Team', Icon: Users },
  { to: '/reports', label: 'Reports', Icon: BarChart3 },
] as const;

export function Sidebar() {
  const { state, me, isOrg } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [switching, setSwitching] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);

  const myOpen = Object.values(state.tasks).filter(
    (t) => t.ownerId === me.id && !t.completedAt,
  ).length;

  const folderCounts = new Map<string, number>();
  for (const t of Object.values(state.tasks)) {
    if (t.completedAt || !t.folderId) continue;
    if (t.ownerId !== me.id) continue;
    folderCounts.set(t.folderId, (folderCounts.get(t.folderId) ?? 0) + 1);
  }

  const teamSize = subtree(state, me.id).length;
  const overdueMine = Object.values(state.tasks).filter(
    (t) => t.ownerId === me.id && derivedStatus(t) === 'overdue',
  ).length;

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <aside className="sidebar">
      <button
        className="sidebar-brand"
        onClick={() => navigate('/')}
        aria-label="Runway — go to home"
      >
        <Wordmark />
      </button>

      <nav className="sidebar-nav" aria-label="Main">
        {NAV.map(({ to, label, Icon }) => (
          <button
            key={to}
            className={`nav-item ${isActive(to) ? 'active' : ''}`}
            onClick={() => navigate(to)}
            aria-current={isActive(to) ? 'page' : undefined}
          >
            <Icon size={20} {...ICON} />
            <span className="nav-label">{label}</span>
            {to === '/tasks' && myOpen > 0 && <span className="nav-count">{myOpen}</span>}
            {to === '/team' && <span className="nav-count">{teamSize}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-head">
          <span className="eyebrow">Your folders</span>
          <button
            className="section-add"
            aria-label="Add folder"
            title="Add folder"
            onClick={() => setAddingFolder(true)}
          >
            <Plus size={16} {...ICON} />
          </button>
        </div>
        {Object.values(state.folders).map((f) => (
          <button
            key={f.id}
            className={`folder-link ${pathname === `/folders/${f.id}` ? 'active' : ''}`}
            onClick={() => navigate(`/folders/${f.id}`)}
          >
            <span className={`dot dot-${f.tone}`} />
            {f.name}
            <Mono style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>
              {folderCounts.get(f.id) ?? 0}
            </Mono>
          </button>
        ))}
        {Object.keys(state.folders).length === 0 && (
          <button className="folder-link" onClick={() => setAddingFolder(true)}>
            <Plus size={16} {...ICON} />
            Add a folder
          </button>
        )}
      </div>

      <div className="sidebar-foot">
        {overdueMine > 0 && (
          <button className="folder-link" onClick={() => navigate('/tasks?group=overdue')}>
            <span className="dot dot-overdue" />
            {overdueMine} overdue
          </button>
        )}
        <button
          className="sidebar-user"
          onClick={() => !isOrg && setSwitching(true)}
          aria-label={
            isOrg ? `Signed in as ${me.name}` : `Signed in as ${me.name}. Switch member.`
          }
        >
          <Avatar user={me} size="sm" decorative />
          <span className="sidebar-user-text">
            <span className="sidebar-user-name">{me.name}</span>
            <Mono style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-faint)' }}>{me.handle}</Mono>
          </span>
        </button>
      </div>

      {switching && <SwitchUserDialog onClose={() => setSwitching(false)} />}
      {addingFolder && <NewFolderDialog onClose={() => setAddingFolder(false)} />}
    </aside>
  );
}
