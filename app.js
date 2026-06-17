/*==========================================================
    DAILY OPERATING SYSTEM
    app.js — Main entry point
==========================================================*/

import { startClock }                                        from './js/clock.js';
import { initNav }                                           from './js/nav.js';
import { highlightCurrentBlock, highlightTodayStudy, updateProgress } from './js/highlights.js';

document.addEventListener('DOMContentLoaded', () => {

    // 1. Start live clock in the hero
    startClock();

    // 2. Wire up day navigation (also shows today's panel)
    initNav();

    // 3. Highlight current time block and study row
    highlightCurrentBlock();
    highlightTodayStudy();
    updateProgress();

    // Refresh highlights every minute
    setInterval(() => {
        highlightCurrentBlock();
        updateProgress();
    }, 60_000);

});