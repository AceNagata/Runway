import { useEffect, useState } from 'react';
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { Button, ICON, useToast } from '../ui';
import {
  isInstalled,
  needsInstallForNotifications,
  notificationSupport,
  requestNotificationPermission,
  showSystemNotification,
  type PermissionState,
} from '../../lib/notify';

/** The permission control. Permission is only ever requested from a real click — asking on
 *  load is how a site gets blocked for good — and the copy states the one real limit rather
 *  than letting the feature look broken when the app is closed. */
export function AlertSetting({ compact = false }: { compact?: boolean }) {
  const toast = useToast();
  const [permission, setPermission] = useState<PermissionState>(() => notificationSupport());
  const [asking, setAsking] = useState(false);

  // Permission can change from browser settings while the app is open.
  useEffect(() => {
    if (!('permissions' in navigator)) return;
    let status: PermissionStatus | undefined;
    navigator.permissions
      .query({ name: 'notifications' as PermissionName })
      .then((s) => {
        status = s;
        s.onchange = () => setPermission(notificationSupport());
      })
      .catch(() => undefined);
    return () => {
      if (status) status.onchange = null;
    };
  }, []);

  const enable = async () => {
    setAsking(true);
    const result = await requestNotificationPermission();
    setPermission(result);
    setAsking(false);
    if (result === 'granted') {
      await showSystemNotification({
        id: 'runway-alerts-on',
        title: 'Alerts are on',
        body: "You'll hear when work is handed to you and when a deadline is close.",
        tag: 'runway-alerts-on',
      });
    } else if (result === 'denied') {
      toast('Your browser is blocking alerts. Turn them on in its site settings for Runway.');
    }
  };

  if (permission === 'unsupported') {
    return (
      <p className="caption" style={{ padding: 'var(--sp-4) var(--sp-5)' }}>
        This browser cannot show system alerts. Notifications stay in this list.
      </p>
    );
  }

  if (permission === 'granted') {
    if (compact) return null;
    return (
      <p className="caption" style={{ padding: 'var(--sp-4) var(--sp-5)', lineHeight: 1.5 }}>
        <Bell size={12} {...ICON} style={{ verticalAlign: '-2px' }} /> Alerts are on. They reach
        you while Runway is open in a tab
        {isInstalled() ? ' or installed' : ''} — not once it is closed.
      </p>
    );
  }

  if (permission === 'denied') {
    return (
      <p className="caption" style={{ padding: 'var(--sp-4) var(--sp-5)', lineHeight: 1.5 }}>
        <BellOff size={12} {...ICON} style={{ verticalAlign: '-2px' }} /> Your browser is blocking
        alerts for Runway. Turn them on in its site settings.
      </p>
    );
  }

  // Default: not asked yet.
  if (needsInstallForNotifications()) {
    return (
      <p className="caption" style={{ padding: 'var(--sp-4) var(--sp-5)', lineHeight: 1.5 }}>
        <Smartphone size={12} {...ICON} style={{ verticalAlign: '-2px' }} /> Add Runway to your
        home screen first — iOS only allows alerts for an installed app.
      </p>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-5)',
        padding: 'var(--sp-5)',
        borderTop: '1px solid var(--line-hairline)',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)' }}>
          Get alerts outside the app
        </span>
        <span className="caption">Work handed to you, and deadlines coming up.</span>
      </span>
      <Button
        variant="primary"
        size="sm"
        onClick={enable}
        disabled={asking}
        style={{ marginLeft: 'auto' }}
      >
        <Bell size={16} {...ICON} />
        Turn on alerts
      </Button>
    </div>
  );
}
