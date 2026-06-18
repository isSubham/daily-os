/*==========================================================
    DAILY OPERATING SYSTEM
    app.js — Main entry point
==========================================================*/

import { startClock }           from './js/clock.js';
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

    // Refresh time-based highlights every minute
    setInterval(() => {
        highlightCurrentBlock();
        // Progress is event-driven (checkboxes) so no need to call updateProgress here
    }, 60_000);

});