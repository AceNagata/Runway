/** System notifications.
 *
 *  Delivery has one hard limit worth stating plainly: a web page can only raise a
 *  notification while it is running. A tab may be in the background and it still works, but
 *  once the app is closed entirely nothing fires, because scheduling then belongs to a push
 *  server (Web Push + VAPID) and this build has no backend — see DECISIONS.md Q8. The
 *  service worker already listens for `push`, so adding that server later is a matter of
 *  keys and subscriptions, not of changing this file.
 *
 *  Notification copy follows the same rules as the in-app list: leads with the actor, two
 *  sentences maximum, no emoji. */

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export function notificationSupport(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as Exclude<PermissionState, 'unsupported'>;
}

/** Must be called from a user gesture — browsers reject a bare request otherwise, and
 *  asking unprompted is how a site gets permanently blocked. */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (notificationSupport() === 'unsupported') return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    return result as PermissionState;
  } catch {
    return Notification.permission as PermissionState;
  }
}

export interface SystemNotification {
  /** The notification's own id, so a click can route to the right place. */
  id: string;
  title: string;
  body: string;
  taskId?: string | null;
  /** Collapses repeats of the same subject rather than stacking them. */
  tag?: string;
}

let swRegistration: ServiceWorkerRegistration | null = null;

export function setServiceWorker(reg: ServiceWorkerRegistration | null) {
  swRegistration = reg;
}

/** Shows one notification. Prefers the service worker — that is the only path iOS accepts
 *  and the only one whose click survives the page being closed — and falls back to the
 *  page-owned constructor on browsers without a registration. */
export async function showSystemNotification(n: SystemNotification): Promise<boolean> {
  if (notificationSupport() !== 'granted') return false;

  const options: NotificationOptions = {
    body: n.body,
    tag: n.tag ?? n.id,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: n.taskId ? `/tasks?task=${n.taskId}` : '/', notificationId: n.id },
    // The product is calm: no vibration, no requireInteraction, no re-alerting.
    silent: false,
  };

  try {
    if (swRegistration) {
      await swRegistration.showNotification(n.title, options);
      return true;
    }
    // eslint-disable-next-line no-new
    new Notification(n.title, options);
    return true;
  } catch {
    return false;
  }
}

/** Registers the worker that makes the app installable and lets notification clicks focus
 *  an existing window. Failure is not an error state — the app works without it. */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    setServiceWorker(reg);
  } catch {
    setServiceWorker(null);
  }
}

/** True when the app is running as an installed PWA rather than in a browser tab. */
export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS reports installation on the legacy navigator flag.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iOS only grants notification permission to an installed app (Safari 16.4+). Detect it so
 *  the UI can say "add it to your home screen first" rather than silently failing. */
export function needsInstallForNotifications(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return isIOS && !isInstalled();
}
