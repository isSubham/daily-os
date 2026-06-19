/*==========================================================
    DAILY OPERATING SYSTEM
    app.js — Main entry point
==========================================================*/
window.onerror = function(msg, src, lineno, colno, error) {
    alert("JS Error: " + msg + " at line " + lineno);
};
window.addEventListener('unhandledrejection', function(event) {
    alert("Async Error: " + event.reason);
});

import { startClock, getTodayPanel } from './js/clock.js';
import { initNav }              from './js/nav.js';
import {
    highlightCurrentBlock,
    highlightTodayStudy,
    updateProgress,
    initCheckboxes,
    renderWeekGrid,
    showNewWeekToast,
} from './js/highlights.js';
import { checkAndRotateWeek }   from './js/tracker.js';
import {
    initNotifications,
    checkBlockNotifications,
    initTestButton,
} from './js/notifications.js';

document.addEventListener('DOMContentLoaded', () => {

    // 1. Start live clock
    startClock();

    // 2. Check for new ISO week — show toast if rotated
    const { isNewWeek, lastWeek, lastWeekStats } = checkAndRotateWeek();

    // 3. Wire up day navigation
    initNav();

    // 4. Inject checkboxes into today's panel
    initCheckboxes();

    // 5. Highlight current time block + study row
    highlightCurrentBlock();
    highlightTodayStudy();

    // 6. Progress bar (checkbox-driven)
    updateProgress();

    // 7. Weekly heatmap
    renderWeekGrid();

    // 8. Show new-week toast if applicable
    if (isNewWeek) showNewWeekToast(lastWeek, lastWeekStats);

    // 9. Notification reminders + test button
    initNotifications();
    // initTestButton();

    // Refresh time-based highlights every minute + check notifications
    setInterval(() => {
        highlightCurrentBlock();
        checkBlockNotifications(getTodayPanel());

        // Hard reload exactly at midnight to cleanly rotate tabs and lock yesterday's checkboxes
        const d = new Date();
        if (d.getHours() === 0 && d.getMinutes() === 0) {
            window.location.reload();
        }
    }, 60_000);

    // ── Register Service Worker (PWA) ────────────────────────
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then(reg => console.log('[SW] Registered, scope:', reg.scope))
            .catch(err => console.warn('[SW] Registration failed:', err));

        // Auto-reload when a new SW takes over
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }

});