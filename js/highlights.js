/*==========================================================
    DAILY OPERATING SYSTEM
    js/highlights.js — Active block, study row, progress, checkboxes, week grid
==========================================================*/

import { getTodayPanel, getScheduleDay } from './clock.js';
import {
    isDone, toggleDone, getPanelStats,
    getWeekData, getWeekTotal, archiveCurrentWeekStats,
    toDateStr,
} from './tracker.js';

/* ─────────────────────────────────────────────────────────────
   TIME PARSING
   ──────────────────────────────────────────────────────────── */

function parseTime(str, isEnd = false) {
    if (!str) return null;
    const mEx = str.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i);
    if (mEx) {
        let h = parseInt(mEx[1], 10);
        const min = parseInt(mEx[2] || '0', 10);
        const p   = mEx[3].toUpperCase();
        if (p === 'AM' && h === 12 && isEnd) return 24 * 60;
        if (p === 'PM' && h !== 12) h += 12;
        if (p === 'AM' && h === 12) h = 0;
        return h * 60 + min;
    }
    const mB = str.match(/(\d+)(?::(\d+))?/);
    if (!mB) return null;
    let h = parseInt(mB[1], 10);
    const min = parseInt(mB[2] || '0', 10);
    if (h < 7) h += 12;
    return h * 60 + min;
}

function getCardTimes(card) {
    const dsRaw = card.dataset.start;
    const deRaw = card.dataset.end;
    if (dsRaw) {
        return {
            start:       parseTime(dsRaw, false),
            end:         deRaw ? parseTime(deRaw, true) : null,
            nextDayEnd:  card.dataset.nextDayEnd ? parseTime(card.dataset.nextDayEnd, false) : null,
            isPoint:     card.dataset.point === 'true',
        };
    }
    const raw   = card.querySelector('.time__primary')?.textContent?.trim() ?? '';
    const parts = raw.split(/[-–]/).map(s => s.trim());
    return {
        start:      parseTime(parts[0], false),
        end:        parts[1] ? parseTime(parts[1], true) : null,
        nextDayEnd: null,
        isPoint:    false,
    };
}

/* ─────────────────────────────────────────────────────────────
   ACTIVE BLOCK HIGHLIGHT  (time-based — unchanged)
   ──────────────────────────────────────────────────────────── */

export function highlightCurrentBlock() {
    const todayPanel = getTodayPanel();
    const panel = document.getElementById(todayPanel);
    if (!panel) return;

    const now    = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const cards  = [...panel.querySelectorAll('.routine-card')];

    cards.forEach(c => {
        c.classList.remove('is-now', 'is-past', 'is-sub-now');
        c.querySelector('.now-badge')?.remove();
        c.querySelector('.progress-ring')?.remove();
    });

    const blocks = cards.map((card, idx) => ({ ...getCardTimes(card), card, idx }));

    let activeCard = null, activeStart = null, activeEnd = null;

    for (let i = 0; i < blocks.length; i++) {
        const { start, end, nextDayEnd, isPoint, card } = blocks[i];
        if (start === null) continue;

        if (isPoint) {
            if (Math.abs(nowMin - start) <= 5) {
                activeCard = card; activeStart = start; activeEnd = start + 5;
                break;
            }
            continue;
        }

        if (nextDayEnd !== null) {
            if (nowMin < nextDayEnd) {
                activeCard = card; activeStart = 0; activeEnd = nextDayEnd;
                break;
            }
            continue;
        }

        const effEnd = end ?? blocks[i + 1]?.start ?? (start + 90);
        const isNow  = effEnd <= start
            ? (nowMin >= start || nowMin < effEnd)
            : (nowMin >= start && nowMin < effEnd);

        if (isNow) { activeCard = card; activeStart = start; activeEnd = effEnd; break; }
    }

    // Mark past blocks
    blocks.forEach(({ start, end, nextDayEnd, isPoint, card }) => {
        if (card === activeCard || start === null || isPoint) return;
        const effEnd = nextDayEnd ?? end ?? (start + 90);
        if (effEnd <= nowMin) card.classList.add('is-past');
    });

    if (!activeCard) return;

    activeCard.classList.add('is-now');

    // Elapsed % ring
    let elapsedPct = 0;
    if (activeStart !== null && activeEnd !== null && activeEnd > activeStart) {
        const span = activeEnd - activeStart;
        elapsedPct = Math.round((Math.max(0, Math.min(nowMin - activeStart, span)) / span) * 100);
    }

    const remaining = activeEnd !== null ? Math.max(0, activeEnd - nowMin) : null;
    const remainStr = remaining
        ? (remaining >= 60
            ? `${Math.floor(remaining / 60)}h ${remaining % 60}m left`
            : `${remaining}m left`)
        : '';

    const badge = document.createElement('span');
    badge.className = 'now-badge';
    badge.innerHTML = `
        <span class="now-badge__dot"></span>
        <span class="now-badge__label">NOW</span>
        ${remainStr ? `<span class="now-badge__remain">${remainStr}</span>` : ''}
    `;

    if (elapsedPct > 0 && elapsedPct < 100) {
        const c      = 2 * Math.PI * 15;
        const filled = (elapsedPct / 100) * c;
        const gap    = c - filled;
        const ring   = document.createElement('div');
        ring.className = 'progress-ring';
        ring.innerHTML = `
            <svg viewBox="0 0 36 36" fill="none">
              <circle class="ring-bg"   cx="18" cy="18" r="15" stroke-width="3"/>
              <circle class="ring-fill" cx="18" cy="18" r="15" stroke-width="3"
                stroke-dasharray="${filled.toFixed(2)} ${gap.toFixed(2)}"
                stroke-dashoffset="${(c * 0.25).toFixed(2)}"/>
            </svg>
            <span class="ring-pct">${elapsedPct}%</span>`;
        activeCard.querySelector('.time')?.appendChild(ring);
    }

    const header = activeCard.querySelector('.card-header') ?? activeCard.querySelector('.card-content');
    if (header) header.prepend(badge);

    // ── Sub-block detection ───────────────────────────────────
    // Some blocks (e.g., Lunch at 1 PM) sit inside a longer block
    // (Office Mode 10 AM–7 PM). The primary loop breaks on Office,
    // so Lunch never gets is-now. Second pass: mark sub-blocks too.
    blocks.forEach(({ start, end, isPoint, card: c }) => {
        if (c === activeCard || isPoint || start === null) return;
        if (c.classList.contains('is-past')) return;
        const effEnd = end ?? (start + 90);
        if (nowMin >= start && nowMin < effEnd) {
            c.classList.remove('is-past');
            c.classList.add('is-sub-now');
        } else {
            c.classList.remove('is-sub-now');
        }
    });

    requestAnimationFrame(() => {
        const navH   = document.querySelector('.day-nav')?.offsetHeight ?? 58;
        const rect   = activeCard.getBoundingClientRect();
        const absTop = rect.top + window.scrollY;
        if (rect.top < navH + 10 || rect.bottom > window.innerHeight * 0.75) {
            window.scrollTo({ top: Math.max(0, absTop - navH - 32), behavior: 'smooth' });
        }
    });
}

/* ─────────────────────────────────────────────────────────────
   WEEKLY STUDY HIGHLIGHT
   ──────────────────────────────────────────────────────────── */

export function highlightTodayStudy() {
    const dayLabel = ['SUN','MON','TUE','WED','THU','FRI','SAT'][new Date().getDay()];
    document.querySelectorAll('.study-item').forEach(item => {
        const el = item.querySelector('.study-item__day');
        if (el) item.classList.toggle('is-today', el.textContent.trim() === dayLabel);
    });
}

/* ─────────────────────────────────────────────────────────────
   PROGRESS BAR  (now manual / checkbox-driven)
   ──────────────────────────────────────────────────────────── */

export function updateProgress() {
    const fill    = document.querySelector('.progress-bar-fill');
    const label   = document.querySelector('.progress-stat');
    const countEl = document.querySelector('.progress-done');
    if (!fill) return;

    const todayStr = toDateStr();
    const panelId  = getTodayPanel();
    const { done, total } = getPanelStats(todayStr, panelId);

    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    fill.style.width = `${pct}%`;
    if (label)   label.textContent = `${pct}%`;
    if (countEl) countEl.textContent = `${done} / ${total} blocks done`;

    archiveCurrentWeekStats();
}

/* ─────────────────────────────────────────────────────────────
   CHECKBOXES  (injected into today's panel only)
   ──────────────────────────────────────────────────────────── */

export function initCheckboxes() {
    const todayStr = toDateStr();
    const panelId  = getTodayPanel();
    const panel    = document.getElementById(panelId);
    if (!panel) return;

    panel.querySelectorAll('.routine-card').forEach((card, idx) => {
        if (card.dataset.point === 'true') return; // skip wake/sleep anchors

        const btn = document.createElement('button');
        btn.className   = 'block-check';
        btn.title       = 'Mark block as done';
        btn.setAttribute('aria-label', 'Mark block as done');
        btn.innerHTML   = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="2.5 8.5 6.5 12.5 13.5 3.5"/>
        </svg>`;

        // Restore persisted state
        if (isDone(todayStr, panelId, idx)) {
            btn.classList.add('is-done');
            card.classList.add('is-done');
        }

        btn.addEventListener('click', e => {
            e.stopPropagation();
            const next = toggleDone(todayStr, panelId, idx);
            btn.classList.toggle('is-done', next);
            card.classList.toggle('is-done', next);
            updateProgress();
            renderWeekGrid();
        });

        // Append directly to card — the button is absolutely positioned
        // in the top-right corner so it works for all card types uniformly.
        card.appendChild(btn);
    });
}

/* ─────────────────────────────────────────────────────────────
   WEEKLY HEATMAP GRID  (sidebar widget)
   ──────────────────────────────────────────────────────────── */

export function renderWeekGrid() {
    const container = document.getElementById('week-grid');
    if (!container) return;

    const data = getWeekData();
    const { done: wDone, total: wTotal } = getWeekTotal();

    container.innerHTML = data.map(({ dayLabel, done, total, isToday, isFuture }) => {
        const pct  = total > 0 ? Math.round((done / total) * 100) : 0;
        const cls  = ['week-col', isToday && 'is-today', isFuture && 'is-future']
            .filter(Boolean).join(' ');
        const stat = isFuture ? '&ndash;' : total === 0 ? '&ndash;' : `${done}/${total}`;
        const fill = isFuture ? 0 : pct;

        return `
        <div class="${cls}">
            <span class="week-col__day">${dayLabel}</span>
            <div class="week-col__bar-wrap">
                <div class="week-col__bar-fill" style="height:${fill}%"></div>
            </div>
            <span class="week-col__stat">${stat}</span>
        </div>`;
    }).join('');

    const totalEl = document.getElementById('week-total');
    if (totalEl) {
        totalEl.textContent = wTotal > 0
            ? `${wDone} / ${wTotal} sessions this week`
            : 'No sessions tracked yet';
    }
}

/* ─────────────────────────────────────────────────────────────
   NEW WEEK TOAST
   ──────────────────────────────────────────────────────────── */

export function showNewWeekToast(lastWeek, lastWeekStats) {
    const existing = document.getElementById('week-toast');
    if (existing) existing.remove();

    const stats = lastWeekStats
        ? `${lastWeekStats.done} / ${lastWeekStats.total} sessions`
        : 'data unavailable';

    const toast = document.createElement('div');
    toast.id        = 'week-toast';
    toast.className = 'week-toast';
    toast.innerHTML = `
        <div class="week-toast__icon">🗓️</div>
        <div class="week-toast__body">
            <strong>New week started</strong>
            <span>Last week (${lastWeek}): ${stats}</span>
        </div>
        <button class="week-toast__close" aria-label="Dismiss">✕</button>
    `;

    document.body.appendChild(toast);

    toast.querySelector('.week-toast__close').addEventListener('click', () => {
        toast.classList.add('is-leaving');
        setTimeout(() => toast.remove(), 350);
    });

    // Auto-dismiss after 7 s
    setTimeout(() => {
        if (document.body.contains(toast)) {
            toast.classList.add('is-leaving');
            setTimeout(() => toast.remove(), 350);
        }
    }, 7000);

    // Trigger entrance animation
    requestAnimationFrame(() => toast.classList.add('is-visible'));
}
