/*==========================================================
    DAILY OPERATING SYSTEM
    js/highlights.js — Highlight active time block + weekly study
==========================================================*/

import { getTodayPanel } from './clock.js';

/**
 * Parse a time string like "07:30 AM", "10 AM", "9 PM", "7:30", "10:00".
 * Returns minutes since midnight, or null if unparseable.
 *
 * Rules for strings missing AM/PM:
 *   h < 7        → PM  (e.g. "6" → 6 PM = 18:00)
 *   7 ≤ h ≤ 11   → AM  (e.g. "7:30" → 7:30 AM)
 *   h = 12       → noon (12:00)
 *   h > 12       → treat as 24-h  (shouldn't appear, but safe fallback)
 *
 * Special case: "12 AM" as an *end* time means end-of-day (1440 min).
 * Caller handles that by passing isEnd=true.
 */
function parseTime(str, isEnd = false) {
    if (!str) return null;

    // Explicit AM/PM
    const mExplicit = str.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i);
    if (mExplicit) {
        let h   = parseInt(mExplicit[1]);
        const min  = parseInt(mExplicit[2] || '0');
        const period = mExplicit[3].toUpperCase();

        // "12 AM" as end-of-block → treat as midnight = 1440
        if (period === 'AM' && h === 12 && isEnd) return 24 * 60;

        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h * 60 + min;
    }

    // No AM/PM — infer from hour value
    const mBare = str.match(/(\d+)(?::(\d+))?/);
    if (!mBare) return null;
    let h   = parseInt(mBare[1]);
    const min  = parseInt(mBare[2] || '0');

    if (h < 7)  h += 12;   // 0-6 → treat as PM (evening)
    // 7-12 → keep as-is (morning / noon)
    return h * 60 + min;
}

/**
 * Marks the currently active time block with .is-now
 * and inserts a NOW badge.
 */
export function highlightCurrentBlock() {
    const todayPanel = getTodayPanel();
    const panel = document.getElementById(todayPanel);
    if (!panel) return;

    const now    = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const cards = [...panel.querySelectorAll('.routine-card')];

    // Build list of (start, end, card)
    const blocks = cards.map((card) => {
        const timeEl = card.querySelector('.time__primary');
        const raw    = timeEl?.textContent?.trim() ?? '';
        const parts  = raw.split(/[-–]/).map(s => s.trim());
        const start  = parseTime(parts[0], false);
        const end    = parts[1] ? parseTime(parts[1], true) : null;
        return { start, end, card };
    });

    let activeCard = null;

    for (let i = 0; i < blocks.length; i++) {
        const { start, end, card } = blocks[i];
        if (start === null) continue;

        // Effective end: explicit end → next block start → start + 90 min
        const effectiveEnd = end ?? blocks[i + 1]?.start ?? (start + 90);

        let isNow = false;
        if (effectiveEnd < start) {
            // spans midnight (e.g. 23:00 → 01:00)
            isNow = nowMin >= start || nowMin < effectiveEnd;
        } else {
            isNow = nowMin >= start && nowMin < effectiveEnd;
        }

        if (isNow) { activeCard = card; break; }
    }

    // Remove previous highlights
    cards.forEach(c => {
        c.classList.remove('is-now');
        c.querySelector('.now-badge')?.remove();
    });

    if (activeCard) {
        activeCard.classList.add('is-now');
        const badge = document.createElement('span');
        badge.className = 'now-badge';
        badge.textContent = 'NOW';
        const header = activeCard.querySelector('.card-header') ?? activeCard.querySelector('.card-content');
        if (header) header.prepend(badge);
    }
}

/**
 * Highlights ONLY today's actual day row in the weekly study grid.
 * (Not all days in a group — just the single current weekday.)
 */
export function highlightTodayStudy() {
    // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
    const dayIndex = new Date().getDay();
    const dayLabel = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dayIndex];

    document.querySelectorAll('.study-item').forEach(item => {
        const dayEl = item.querySelector('.study-item__day');
        if (dayEl) {
            item.classList.toggle('is-today', dayEl.textContent.trim() === dayLabel);
        }
    });
}

/**
 * Progress bar: what fraction of the waking day has elapsed.
 * Also counts how many blocks have ended.
 */
export function updateProgress() {
    const fill   = document.querySelector('.progress-bar-fill');
    const label  = document.querySelector('.progress-stat');
    if (!fill) return;

    const todayId = getTodayPanel();
    const panel   = document.getElementById(todayId);
    if (!panel) return;

    const now    = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const cards = [...panel.querySelectorAll('.routine-card')];
    if (!cards.length) return;

    // Day window: 7:30 AM → midnight (1440 min)
    const DAY_START = 7 * 60 + 30;
    const DAY_END   = 24 * 60;

    const clamped = Math.min(Math.max(nowMin, DAY_START), DAY_END);
    const pct     = Math.round(((clamped - DAY_START) / (DAY_END - DAY_START)) * 100);

    fill.style.width = `${pct}%`;
    if (label) label.textContent = `${pct}%`;

    // Count completed blocks (end time is in the past)
    let done = 0;
    cards.forEach(card => {
        const timeEl = card.querySelector('.time__primary');
        const raw    = timeEl?.textContent?.trim() ?? '';
        const parts  = raw.split(/[-–]/).map(s => s.trim());
        const end    = parts[1] ? parseTime(parts[1], true) : null;
        if (end !== null && nowMin >= end) done++;
    });

    const totalEl = document.querySelector('.progress-done');
    if (totalEl) totalEl.textContent = `${done} / ${cards.length} blocks`;
}
