/* Runway service worker.
 *
 * Three jobs, deliberately small:
 *   1. Make the app installable, and keep it opening offline (§7 asks for offline tolerance).
 *   2. Route a notification click to the task it is about, focusing an open window if there
 *      is one rather than piling up tabs.
 *   3. Listen for `push`. Nothing sends push messages in this build — there is no backend —
 *      but the handler is here so wiring a real Web Push server later needs only VAPID keys
 *      and a subscription store, with no change to the client.
 */

const VERSION = 'runway-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* Network first, cache as a fallback. A stale build is worse than a slow one, so the cache
 * only answers when the network cannot. */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // A navigation that misses falls back to the shell so the SPA can route itself.
        if (request.mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin)) {
          return client.focus().then(() => client.navigate(target).catch(() => undefined));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

/* Ready for a push server that does not exist yet. Payload shape matches what
 * src/lib/notify.ts sends locally, so both paths render the same notification. */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Runway';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      tag: payload.tag || payload.taskId || 'runway',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: payload.taskId ? `/tasks?task=${payload.taskId}` : '/' },
    }),
  );
});
