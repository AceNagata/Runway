import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, BarChart3, Bell, Database, Lock, RotateCcw, Users, UserRound } from 'lucide-react';
import { Avatar, Button, Card, ConfirmDialog, Eyebrow, ICON, Mono } from '../components/ui';
import { SwitchUserDialog } from '../components/shell/SwitchUserDialog';
import { AlertSetting } from '../components/shell/AlertSetting';
import { useStore } from '../store/StoreContext';
import { managerChain, subtree } from '../domain/org';
import { lockNow } from '../lib/lock';

/** Mobile keeps home, tasks, schedule and notes on the tab bar; everything else lives in
 *  this grid. Reports and the team tree are read-only on a phone. §6.2 */
export function Menu() {
  const { state, me, dispatch } = useStore();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [clearing, setClearing] = useState(false);

  const unread = Object.values(state.notifications).filter(
    (n) => n.forUserId === me.id && !n.read,
  ).length;
  const chain = managerChain(state, me.id);
  const manager = chain[chain.length - 1];

  return (
    <div className="screen rise">
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
          <Avatar user={me} size="lg" decorative />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span className="h3">{me.name}</span>
            <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
              {me.role}
              {manager && ` · Reports to ${manager.name}`}
            </span>
            <Mono className="faint">{me.handle}</Mono>
          </div>
        </div>
      </Card>

      <div>
        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <Eyebrow>Everything else</Eyebrow>
        </div>
        <div className="menu-grid">
          <button className="menu-tile" onClick={() => navigate('/team')}>
            <Users size={24} {...ICON} />
            Your team
            <Mono className="faint">{subtree(state, me.id).length} people</Mono>
          </button>
          <button className="menu-tile" onClick={() => navigate('/reports')}>
            <BarChart3 size={24} {...ICON} />
            Reports
            <Mono className="faint">Read-only here</Mono>
          </button>
          <button className="menu-tile" onClick={() => navigate('/notes?folder=none')}>
            <Archive size={24} {...ICON} />
            Note folders
          </button>
          <button className="menu-tile" onClick={() => navigate('/')}>
            <Bell size={24} {...ICON} />
            Notifications
            {unread > 0 && <Mono className="tone-accent">{unread} unread</Mono>}
          </button>
          <button className="menu-tile" onClick={() => setSwitching(true)}>
            <UserRound size={24} {...ICON} />
            Switch member
          </button>
          <button
            className="menu-tile"
            onClick={() => {
              lockNow();
              location.replace('/');
            }}
          >
            <Lock size={24} {...ICON} />
            Lock Runway
            <Mono className="faint">Needs your passphrase</Mono>
          </button>
          <button className="menu-tile" onClick={() => setLoadingDemo(true)}>
            <Database size={24} {...ICON} />
            Load demo data
            <Mono className="faint">A sample team</Mono>
          </button>
          <button className="menu-tile" onClick={() => setClearing(true)}>
            <RotateCcw size={24} {...ICON} />
            Start from empty
          </button>
        </div>
      </div>

      <Card className="card-flush">
        <div style={{ padding: 'var(--sp-7) var(--sp-7) 0' }}>
          <Eyebrow>Alerts</Eyebrow>
        </div>
        <AlertSetting />
      </Card>

      <p className="caption">
        Runway keeps your work on this device and reconciles in the background, so the app
        opens on what you last saw rather than a loading screen.
      </p>

      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          Back to home
        </Button>
      </div>

      {switching && <SwitchUserDialog onClose={() => setSwitching(false)} />}
      {loadingDemo && (
        <ConfirmDialog
          title="Load demo data"
          consequence="A sample team of eight, with tasks, notes and history, replaces what is here now. Anything you have added is lost."
          confirmLabel="Load it"
          onConfirm={() => dispatch({ type: 'demo/load' })}
          onClose={() => setLoadingDemo(false)}
        />
      )}
      {clearing && (
        <ConfirmDialog
          title="Start from empty"
          consequence="Every task, note, folder and member goes, leaving one account and a clean board. This cannot be undone."
          confirmLabel="Clear it"
          onConfirm={() => dispatch({ type: 'demo/clear' })}
          onClose={() => setClearing(false)}
        />
      )}
    </div>
  );
}
