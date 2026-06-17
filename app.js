/* ==========================================================
   DAILY OPERATING SYSTEM
   app.js
========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const buttons = document.querySelectorAll(".day-btn");
    const panels = document.querySelectorAll(".day-panel");

    function showPanel(day) {

        buttons.forEach(button => {
            button.classList.remove("active");

            if (button.dataset.day === day) {
                button.classList.add("active");
            }
        });

        panels.forEach(panel => {

            panel.classList.remove("active");

            if (panel.id === day) {

                panel.classList.add("active");

                panel.animate(
                    [
                        {
                            opacity: 0,
                            transform: "translateY(20px)"
                        },
                        {
                            opacity: 1,
                            transform: "translateY(0)"
                        }
                    ],
                    {
                        duration: 300,
                        easing: "ease-out"
                    }
                );

            }

        });

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

    buttons.forEach(button => {

        button.addEventListener("click", () => {

            showPanel(button.dataset.day);

        });

    });

    /* ==========================================
       AUTO SELECT TODAY
    ========================================== */

    const today = new Date().getDay();

    /*
        Sunday = 0
        Monday = 1
        Tuesday = 2
        Wednesday = 3
        Thursday = 4
        Friday = 5
        Saturday = 6
    */

    if (today === 1 || today === 3 || today === 5) {

        showPanel("mwf");

    } else if (today === 2 || today === 4) {

        showPanel("tt");

    } else if (today === 6) {

        showPanel("sat");

    } else {

        showPanel("sun");

    }

    /* ==========================================
       KEYBOARD SHORTCUTS
    ========================================== */

    document.addEventListener("keydown", (event) => {

        switch (event.key) {

            case "1":
                showPanel("mwf");
                break;

            case "2":
                showPanel("tt");
                break;

            case "3":
                showPanel("sat");
                break;

            case "4":
                showPanel("sun");
                break;

            default:
                break;
        }

    });

});