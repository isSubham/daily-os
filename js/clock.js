/*==========================================================
    DAILY OPERATING SYSTEM
    js/clock.js — Live clock + day detection
==========================================================*/

export function startClock() {
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    if (!timeEl) return;

    const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function tick() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2,'0');
        const m = String(now.getMinutes()).padStart(2,'0');
        timeEl.textContent = `${h}:${m}`;

        if (dateEl) {
            dateEl.textContent =
                `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
        }
    }

    tick();
    setInterval(tick, 1000);
}

/**
 * Returns the SCHEDULE day: between midnight and 7:30 AM we are still
 * on the "previous night's" schedule (the sleep card spans 12 AM → 7:30 AM).
 *
 * 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
 */
export function getScheduleDay() {
    const now  = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    // Before 7:30 AM → still on yesterday's schedule
    const day  = mins < 7 * 60 + 30
        ? (now.getDay() + 6) % 7   // roll back one day (0=Sun wraps to 6=Sat)
        : now.getDay();
    return day;
}

/**
 * Returns the panel id for the current schedule day.
 */
export function getTodayPanel() {
    const day = getScheduleDay();
    if (day === 1 || day === 3 || day === 5) return 'mwf';
    if (day === 2 || day === 4)              return 'tt';
    if (day === 6)                           return 'sat';
    return 'sun';
}
