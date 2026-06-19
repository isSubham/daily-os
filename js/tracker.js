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

/**
 * Returns the SCHEDULE date string.
 * Swaps exactly at midnight to the new calendar date.
 */
export function toScheduleDateStr() {
    return toDateStr(new Date());
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
 * Excludes data-point="true" AND data-next-day-end cards
 * (Wake anchors + Sleep anchors — both are non-negotiable).
 */
export function getPanelStats(dateStr, panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return { done: 0, total: 0 };
    let done = 0, total = 0;
    panel.querySelectorAll('.routine-card').forEach((card, idx) => {
        if (card.dataset.point === 'true') return;
        if (card.dataset.nextDayEnd)       return; // Sleep anchor
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
 * Uses toScheduleDateStr() for "today" so the heatmap correctly
 * marks the schedule day even when it's past midnight.
 */
export function getWeekData() {
    const now         = new Date();
    const scheduleDateStr = toScheduleDateStr();  // ← schedule-aware "today"
    const calDateStr  = toDateStr(now);           // real calendar date

    // Monday of the current ISO week (based on calendar date)
    const dow        = now.getDay();
    const mondayDiff = dow === 0 ? -6 : 1 - dow;
    const monday     = new Date(now);
    monday.setDate(now.getDate() + mondayDiff);
    monday.setHours(0, 0, 0, 0);

    return WEEK_LABELS.map((label, i) => {
        const d        = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr  = toDateStr(d);
        const panelId  = DAY_TO_PANEL[label];

        // "today" in schedule context (handles after-midnight correctly)
        const isToday  = dateStr === scheduleDateStr;
        // future = strictly after the schedule date
        const isFuture = dateStr > scheduleDateStr;
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

export function checkAndRotateWeek() {
    const currentWeek = toISOWeek();
    let meta = {};
    try { meta = JSON.parse(localStorage.getItem(META) || '{}'); } catch {}

    if (meta.currentWeek === currentWeek) {
        return { isNewWeek: false, lastWeek: null, lastWeekStats: null };
    }

    const lastWeek      = meta.currentWeek !== undefined ? meta.currentWeek : null;
    const lastWeekStats = meta.lastWeekStats !== undefined ? meta.lastWeekStats : null;

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

    localStorage.setItem(META, JSON.stringify({ currentWeek, lastWeek, lastWeekStats }));
    return { isNewWeek: !!lastWeek, lastWeek, lastWeekStats };
}

export function archiveCurrentWeekStats() {
    const total = getWeekTotal();
    let meta = {};
    try { meta = JSON.parse(localStorage.getItem(META) || '{}'); } catch {}
    localStorage.setItem(META, JSON.stringify({ ...meta, lastWeekStats: total }));
}
