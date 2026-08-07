import { useEffect, useRef, useState } from 'react';
import { Bell, CloudOff, Plus, Search } from 'lucide-react';
import { Button, ICON, IconButton, Mono, Tooltip } from '../ui';
import { NotificationsPopover } from './NotificationsPopover';
import { useStore } from '../../store/StoreContext';
import { absDate, weekdayShort } from '../../lib/time';

export function TopBar({
  title,
  onSearch,
  onAddTask,
  now,
}: {
  title: string;
  onSearch: () => void;
  onAddTask: () => void;
  now: Date;
}) {
  const { state, me, online, pending } = useStore();
  const [notifsOpen, setNotifsOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  const unread = Object.values(state.notifications).filter(
    (n) => n.forUserId === me.id && !n.read,
  ).length;

  // Close on any route-level click elsewhere.
  useEffect(() => {
    if (!notifsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setNotifsOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [notifsOpen]);

  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>
      <Mono className="topbar-date faint">
        {weekdayShort(now)} · {absDate(now)}
      </Mono>

      <div className="topbar-right" ref={anchor}>
        {/* Reads come from local state first; the user is told when a write is waiting. */}
        {(!online || pending > 0) && (
          <Tooltip
            text={
              online
                ? `${pending} ${pending === 1 ? 'change' : 'changes'} syncing`
                : `Offline. ${pending} ${pending === 1 ? 'change' : 'changes'} will send when you reconnect.`
            }
          >
            <span className="unsynced">
              <CloudOff size={16} {...ICON} />
              <span className="mono">{pending}</span>
            </span>
          </Tooltip>
        )}

        <button className="search" onClick={onSearch} aria-label="Search tasks and notes">
          <Search size={16} {...ICON} />
          <span className="search-label">Search tasks and notes</span>
          <Mono className="search-hint">/</Mono>
        </button>

        <IconButton
          label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          small
          showDot={unread > 0}
          active={notifsOpen}
          onClick={() => setNotifsOpen((v) => !v)}
        >
          <Bell size={20} {...ICON} />
        </IconButton>

        <Button variant="secondary" onClick={onAddTask}>
          <Plus size={16} {...ICON} />
          Add task
        </Button>

        {notifsOpen && <NotificationsPopover onClose={() => setNotifsOpen(false)} />}
      </div>
    </header>
  );
}
