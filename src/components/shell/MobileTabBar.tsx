import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, FileText, Home, LayoutGrid, ListChecks } from 'lucide-react';
import { ICON } from '../ui';

/** Mobile carries home, tasks, schedule, notes, plus a menu grid for everything else. §6.2
 *  Icons are 24px here; every target clears 44px through the CSS. */
const TABS = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/tasks', label: 'Tasks', Icon: ListChecks },
  { to: '/schedule', label: 'Schedule', Icon: CalendarDays },
  { to: '/notes', label: 'Notes', Icon: FileText },
  { to: '/menu', label: 'Menu', Icon: LayoutGrid },
] as const;

export function MobileTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <nav className="mobile-tabbar" aria-label="Main">
      {TABS.map(({ to, label, Icon }) => (
        <button
          key={to}
          className={`mobile-tab ${active(to) ? 'active' : ''}`}
          onClick={() => navigate(to)}
          aria-current={active(to) ? 'page' : undefined}
        >
          <Icon size={24} {...ICON} />
          {label}
        </button>
      ))}
    </nav>
  );
}
