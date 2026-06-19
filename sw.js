/*==========================================================
    DAILY OPERATING SYSTEM
    sw.js — Service Worker (cache-first strategy)

    Strategy:
      - Install  : pre-cache all static assets
      - Activate : delete stale caches
      - Fetch    : serve from cache, fall back to network,
                   cache new responses for future offline use

    Update: bump CACHE_VERSION when deploying new code.
==========================================================*/

const CACHE_VERSION  = 'v6';
const CACHE_NAME     = `daily-os-${CACHE_VERSION}`;

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/js/clock.js',
    '/js/nav.js',
    '/js/highlights.js',
    '/js/tracker.js',
    '/js/notifications.js',
    '/css/base.css',
    '/css/layout.css',
    '/css/timeline.css',
    '/css/sidebar.css',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/apple-touch-icon.png',
];

/* ─── Install ────────────────────────────────────────────── */

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // Force bypass HTTP cache to rescue devices stuck on the old 1-year cache policy
                return Promise.all(PRECACHE_URLS.map(url => {
                    return fetch(url, { cache: 'no-store' }).then(res => {
                        if (!res.ok) throw new Error(`Fetch failed: ${url}`);
                        return cache.put(url, res);
                    });
                }));
            })
            .then(() => self.skipWaiting())   // activate immediately
    );
});

/* ─── Activate ───────────────────────────────────────────── */

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key  => caches.delete(key))
            ))
            .then(() => self.clients.claim())  // take control of open tabs
    );
});

/* ─── Fetch ──────────────────────────────────────────────── */

self.addEventListener('fetch', (event) => {
    // Only handle GET requests; skip non-http(s) (e.g. chrome-extension)
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http'))  return;

    // Skip Google Fonts requests — let them go to network
    // (they have their own cache headers)
    if (event.request.url.includes('fonts.googleapis.com') ||
        event.request.url.includes('fonts.gstatic.com')) {
        event.respondWith(fetch(event.request).catch(() => new Response('')));
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            // Not in cache — fetch from network and cache the response
            return fetch(event.request).then(response => {
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response;
                }
                const toCache = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
                return response;
            });
        }).catch(() => {
            // Full offline fallback — serve index.html for navigation requests
            if (event.request.mode === 'navigate') {
                return caches.match('/index.html');
            }
        })
    );
});

/* ─── Push event (from Netlify scheduled function) ──── */

// This fires when the server sends a Web Push — even if the
// PWA is completely closed. The OS wakes the service worker,
// which shows the notification on the lock screen.
self.addEventListener('push', (event) => {
    let data = { title: 'Daily OS', body: '', tag: 'dos-push' };
    try { data = { ...data, ...event.data?.json() }; } catch {}

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body:             data.body,
            tag:              data.tag,
            icon:             '/icons/icon-192.png',
            badge:            '/icons/icon-192.png',
            vibrate:          [200, 100, 200],
            requireInteraction: false,
            silent:           false,
        })
    );
});

/* ─── Notification click ─────────────────────────────── */

// When user taps a block reminder notification, open or focus the PWA.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
                // If the app is already open, focus it
                for (const client of clients) {
                    if ('focus' in client) return client.focus();
                }
                // Otherwise open a new window
                if (self.clients.openWindow) {
                    return self.clients.openWindow('/');
                }
            })
    );
});
