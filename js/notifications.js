/*==========================================================
    DAILY OPERATING SYSTEM
    js/notifications.js — Block reminders (in-app + Web Push)

    Two-layer notification system:
    1. IN-APP  — fires via setInterval while PWA is open
    2. WEB PUSH — Netlify scheduled function fires push events
                  that wake the service worker even when the
                  app is fully closed or offline
==========================================================*/

const NOTIF_KEY = 'dos_notifications_enabled';
const FIRED_KEY = 'dos_notif_fired_';

/* ─── Helpers ─────────────────────────────────────────── */

function toDateStr(d = new Date()) {
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
    ].join('-');
}

function parseTimeToMins(str) {
    if (!str) return null;
    const m = str.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2] || '0', 10);
    const p = m[3].toUpperCase();
    if (p === 'PM' && h !== 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    return h * 60 + min;
}

function getCardTitle(card) {
    return (
        card.querySelector('.card-header h3')?.textContent?.trim() ??
        card.querySelector('.card-content h3')?.textContent?.trim() ??
        'Block'
    );
}

function getCardTimes(card) {
    const s = card.dataset.start;
    const e = card.dataset.end;
    if (!s) return null;
    const start = parseTimeToMins(s);
    const end = e ? parseTimeToMins(e) : null;
    if (start === null) return null;
    return { start, end };
}

/* ─── VAPID / Web Push ─────────────────────────────────── */

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function getVapidPublicKey() {
    try {
        const res = await fetch('/.netlify/functions/vapid-public-key');
        if (!res.ok) return null;
        const { key } = await res.json();
        return key || null;
    } catch {
        return null;   // running locally or function not deployed yet
    }
}

async function subscribeWebPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('[push] Web Push not supported');
        return false;
    }

    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
        console.log('[push] VAPID key unavailable — in-app reminders only');
        return false;
    }

    try {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        // Save subscription to Netlify Blobs via our function
        const res = await fetch('/.netlify/functions/save-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription),
        });

        if (res.ok) {
            console.log('[push] ✅ Web Push subscription saved');
            return true;
        } else {
            console.warn('[push] Failed to save subscription:', await res.text());
            return false;
        }
    } catch (err) {
        console.warn('[push] Subscribe error:', err.message);
        return false;
    }
}

/* ─── Permission ──────────────────────────────────────── */

export function isNotificationsEnabled() {
    return localStorage.getItem(NOTIF_KEY) === '1';
}

export async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
}

/* ─── In-app fire (fallback while app is open) ─────────── */

function firedKey(dateStr, hhmm, type) {
    return `${FIRED_KEY}${dateStr}_${hhmm}_${type}`;
}

function hasAlreadyFired(key) {
    return sessionStorage.getItem(key) === '1';
}

function markFired(key) {
    sessionStorage.setItem(key, '1');
}

async function fireNotification(title, body, tag) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const options = {
        body,
        tag,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200],
        requireInteraction: false,
        silent: false,
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(title, options);
            return;
        } catch { /* fall through */ }
    }

    new Notification(title, options);
}

/* ─── In-app block check (60s interval hook) ──────────── */

export function checkBlockNotifications(panelId) {
    if (!isNotificationsEnabled()) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const panel = document.getElementById(panelId);
    if (!panel) return;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const dateStr = toDateStr(now);
    const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    const cards = [...panel.querySelectorAll('.routine-card')].filter(
        c => c.dataset.point !== 'true'
    );

    cards.forEach(card => {
        const times = getCardTimes(card);
        if (!times) return;
        const { start, end } = times;
        const title = getCardTitle(card);

        if (start - nowMin === 5) {
            const key = firedKey(dateStr, hhmm, `pre_${start}`);
            if (!hasAlreadyFired(key)) {
                markFired(key);
                fireNotification(`⏰ Coming up in 5 min`, `${title} starts soon`, `dos-pre-${start}`);
            }
        }

        if (start === nowMin) {
            const key = firedKey(dateStr, hhmm, `start_${start}`);
            if (!hasAlreadyFired(key)) {
                markFired(key);
                fireNotification(`🚀 Starting now`, title, `dos-start-${start}`);
            }
        }

        if (end !== null && end - nowMin === 5) {
            const key = firedKey(dateStr, hhmm, `end_${end}`);
            if (!hasAlreadyFired(key)) {
                markFired(key);
                fireNotification(`⏱ Wrapping up`, `${title} ends in 5 min`, `dos-end-${end}`);
            }
        }
    });
}

/* ─── UI: Enable Reminders toggle ────────────────────── */

export function initNotifications() {
    const btn = document.getElementById('notif-toggle-btn');
    const hint = document.querySelector('.notif-hint');
    if (!btn) return;

    const webPushAvailable = ('serviceWorker' in navigator) && ('PushManager' in window);

    function updateUI(enabled) {
        btn.textContent = enabled ? '🔔 Reminders On' : '🔕 Enable Reminders';
        btn.classList.toggle('notif-active', enabled);

        if (hint) {
            hint.textContent = enabled
                ? webPushAvailable
                    ? '✅ Active — you\'ll be notified even when the app is closed'
                    : '✅ Active — notifies while app is open (Web Push not available on this browser)'
                : 'Get notified 5 min before each block starts · works best as installed PWA';
        }
    }

    updateUI(isNotificationsEnabled());

    btn.addEventListener('click', async () => {

        // ── Turn OFF ─────────────────────────────────────
        if (isNotificationsEnabled()) {
            localStorage.setItem(NOTIF_KEY, '0');
            updateUI(false);
            return;
        }

        // ── Turn ON ──────────────────────────────────────
        if (!('Notification' in window)) {
            alert('This browser does not support notifications.');
            return;
        }

        if (Notification.permission === 'denied') {
            alert('Notifications are blocked. Go to browser / OS Settings → allow notifications for this site, then try again.');
            return;
        }

        const granted = await requestNotificationPermission();
        if (!granted) {
            alert('Permission denied. Notifications won\'t be sent.');
            return;
        }

        localStorage.setItem(NOTIF_KEY, '1');
        updateUI(true);

        // Attempt Web Push subscription (for closed-app notifications)
        const webPushOk = await subscribeWebPush();

        // Confirmation notification
        await fireNotification(
            '✅ Reminders Enabled',
            webPushOk
                ? 'You\'ll get block alerts even when the app is closed.'
                : 'You\'ll get block alerts while the app is open.',
            'dos-setup'
        );
    });
}
