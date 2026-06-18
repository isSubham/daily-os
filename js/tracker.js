/*==========================================================
    DAILY OPERATING SYSTEM
    js/tracker.js — Block completion tracking (localStorage)
==========================================================*/

const P    = 'dos_done_';     // prefix: dos_done_{YYYY-MM-DD}_{panelId}_{idx}
const META = 'dos_week_meta'; // JSON: { currentWeek, lastWeek, lastWeekStats }

/* ─── Date helpers ───────────────────────────────────────── */

export function toDateStr(d = new Date()) {
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
    ].join('-');
}

export function toISOWeek(d = new Date()) {
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
    const y0 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const wn = Math.ceil(((dt - y0) / 86400000 + 1) / 7);
    return `${dt.getUTCFullYear()}-W${String(wn).padStart(2, '0')}`;
}

/* ─── Storage key ────────────────────────────────────────── */

function makeKey(dateStr, panelId, cardIdx) {
    return `${P}${dateStr}_${panelId}_${cardIdx}`;
}

/* ─── Read / Write ───────────────────────────────────────── */

export function isDone(dateStr, panelId, cardIdx) {
    return localStorage.getItem(makeKey(dateStr, panelId, cardIdx)) === '1';
}

export function toggleDone(dateStr, panelId, cardIdx) {
    const key  = makeKey(dateStr, panelId, cardIdx);
    const next = localStorage.getItem(key) !== '1';
    next ? localStorage.setItem(key, '1') : localStorage.removeItem(key);
    return next;
}

/* ─── Panel stats ────────────────────────────────────────── */

/**
 * Returns { done, total } for a date + panel.
 * Excludes data-point="true" cards (Wake / Sleep anchors).
 */
export function getPanelStats(dateStr, panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return { done: 0, total: 0 };
    let done = 0, total = 0;
    panel.querySelectorAll('.routine-card').forEach((card, idx) => {
        if (card.dataset.point === 'true') return;
        total++;
        if (isDone(dateStr, panelId, idx)) done++;
    });
    return { done, total };
}

/* ─── Week data (for heatmap) ────────────────────────────── */

const DAY_TO_PANEL = {
    MON: 'mwf', TUE: 'tt', WED: 'mwf',
    THU: 'tt',  FRI: 'mwf', SAT: 'sat', SUN: 'sun',
};
const WEEK_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/**
 * Returns 7-element array for current ISO week (Mon → Sun).
 * Each: { dayLabel, panelId, dateStr, done, total, isToday, isFuture }
 */
export function getWeekData() {
    const today      = new Date();
    const todayStr   = toDateStr(today);
    const dow        = today.getDay(); // 0=Sun
    const mondayDiff = dow === 0 ? -6 : 1 - dow;
    const monday     = new Date(today);
    monday.setDate(today.getDate() + mondayDiff);
    monday.setHours(0, 0, 0, 0);

    return WEEK_LABELS.map((label, i) => {
        const d        = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr  = toDateStr(d);
        const panelId  = DAY_TO_PANEL[label];
        const isToday  = dateStr === todayStr;
        const isFuture = dateStr > todayStr;
        const stats    = isFuture ? { done: 0, total: 0 } : getPanelStats(dateStr, panelId);
        return { dayLabel: label, panelId, dateStr, ...stats, isToday, isFuture };
    });
}

export function getWeekTotal() {
    return getWeekData().reduce(
        (a, d) => ({ done: a.done + d.done, total: a.total + d.total }),
        { done: 0, total: 0 },
    );
}

/* ─── Week rotation ──────────────────────────────────────── */

/**
 * Detects ISO week change. Prunes keys > 28 days old.
 * Returns { isNewWeek, lastWeek, lastWeekStats }
 */
export function checkAndRotateWeek() {
    const currentWeek = toISOWeek();
    let meta = {};
    try { meta = JSON.parse(localStorage.getItem(META) || '{}'); } catch {}

    if (meta.currentWeek === currentWeek) {
        return { isNewWeek: false, lastWeek: null, lastWeekStats: null };
    }

    const lastWeek      = meta.currentWeek ?? null;
    const lastWeekStats = meta.lastWeekStats ?? null;

    // Prune keys older than 28 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const cutoffStr = toDateStr(cutoff);
    Object.keys(localStorage)
        .filter(k => k.startsWith(P))
        .forEach(k => {
            const dateStr = k.slice(P.length, P.length + 10);
            if (dateStr < cutoffStr) localStorage.removeItem(k);
        });

    localStorage.setItem(META, JSON.stringify({
        currentWeek,
        lastWeek,
        lastWeekStats, // carry last week's archived stats for toast
    }));

    return { isNewWeek: !!lastWeek, lastWeek, lastWeekStats };
}

/**
 * Archives this week's total so the toast can show it next Monday.
 * Call this whenever stats update (updateProgress, checkbox toggle).
 */
export function archiveCurrentWeekStats() {
    const total = getWeekTotal();
    let meta = {};
    try { meta = JSON.parse(localStorage.getItem(META) || '{}'); } catch {}
    localStorage.setItem(META, JSON.stringify({ ...meta, lastWeekStats: total }));
}
