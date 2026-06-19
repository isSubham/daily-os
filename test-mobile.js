const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('./index.html', 'utf8');

const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
    resources: "usable",
    beforeParse(window) {
        // Simulate Mobile Chrome
        Object.defineProperty(window, 'innerWidth', { value: 390 });
        window.scrollTo = () => {};
        window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
        
        // Mock matchMedia
        window.matchMedia = window.matchMedia || function() {
            return {
                matches: false,
                addListener: function() {},
                removeListener: function() {}
            };
        };

        // Inject script contents manually to avoid module loading issues in JSDOM
        const appSrc = fs.readFileSync('./app.js', 'utf8')
            .replace(/import .* from '.*';/g, ''); // strip imports
            
        const clockSrc = fs.readFileSync('./js/clock.js', 'utf8').replace(/export /g, '');
        const navSrc = fs.readFileSync('./js/nav.js', 'utf8').replace(/export /g, '').replace(/import .*;/g, '');
        const hlSrc = fs.readFileSync('./js/highlights.js', 'utf8').replace(/export /g, '').replace(/import .*;/g, '');
        const trSrc = fs.readFileSync('./js/tracker.js', 'utf8').replace(/export /g, '').replace(/import .*;/g, '');
        const notifSrc = fs.readFileSync('./js/notifications.js', 'utf8').replace(/export /g, '').replace(/import .*;/g, '');

        window.eval(`
            ${clockSrc}
            ${navSrc}
            ${hlSrc}
            ${trSrc}
            ${notifSrc}
            ${appSrc}
        `);
    }
});

dom.window.document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const mwfBtn = dom.window.document.querySelector('[data-day="mwf"]');
        console.log("MWF active:", mwfBtn.classList.contains('active'));
        
        const ttBtn = dom.window.document.querySelector('[data-day="tt"]');
        ttBtn.click();
        console.log("TT active after click:", ttBtn.classList.contains('active'));
        
        const cbs = dom.window.document.querySelectorAll('.block-check');
        console.log("Checkboxes found:", cbs.length);
        
        const nowBadge = dom.window.document.querySelector('.is-now');
        console.log("Is there a currently active block?", !!nowBadge);
    }, 1000);
});

