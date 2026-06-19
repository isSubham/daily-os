/*==========================================================
    DAILY OPERATING SYSTEM
    js/nav.js — Day navigation + panel switching
==========================================================*/

import { getTodayPanel } from './clock.js';

/**
 * Highlights the day button and shows the matching panel.
 * Also marks today's button with .is-today.
 */
export function initNav() {
    const buttons = [...document.querySelectorAll('.day-btn')];
    const panels  = [...document.querySelectorAll('.day-panel')];
    const todayId = getTodayPanel();

    // Mark today's button
    buttons.forEach(btn => {
        if (btn.dataset.day === todayId) btn.classList.add('is-today');
    });

    function showPanel(dayId) {
        // Buttons
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.day === dayId);
            btn.setAttribute('aria-selected', btn.dataset.day === dayId);
        });

        // Panels — force re-animation by removing then re-adding class
        panels.forEach(panel => {
            if (panel.id === dayId) {
                panel.classList.add('active');
                // reset animation
                panel.style.animation = 'none';
                panel.offsetHeight; // reflow
                panel.style.animation = '';
            } else {
                panel.classList.remove('active');
            }
        });

        // On mobile only: smooth scroll to content top
        try {
            if (window.innerWidth < 768) {
                const target = document.querySelector('.layout');
                if (target) {
                    const navEl = document.querySelector('.day-nav');
                    const navH = navEl ? navEl.offsetHeight : 58;
                    window.scrollTo({ top: target.offsetTop - navH, behavior: 'smooth' });
                }
            }
        } catch (e) {
            console.error('Mobile scroll error:', e);
        }
    }

    // Attach click listeners
    buttons.forEach(btn => {
        btn.addEventListener('click', () => showPanel(btn.dataset.day));
    });

    // Keyboard shortcuts: 1 2 3 4
    document.addEventListener('keydown', e => {
        const map = { '1': 'mwf', '2': 'tt', '3': 'sat', '4': 'sun' };
        if (map[e.key]) showPanel(map[e.key]);
    });

    // Swipe gesture support (touch)
    let touchStartX = 0;
    const order = ['mwf', 'tt', 'sat', 'sun'];

    document.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });

    document.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) < 60) return; // ignore small swipes

        const active = buttons.find(b => b.classList.contains('active'));
        if (!active) return;

        const idx = order.indexOf(active.dataset.day);
        if (dx < 0 && idx < order.length - 1) showPanel(order[idx + 1]); // swipe left → next
        if (dx > 0 && idx > 0)                showPanel(order[idx - 1]); // swipe right → prev
    }, { passive: true });

    // Show today on load
    showPanel(todayId);
}
