import { bootstrapAuth, renderAuthSlot, onAuthChange } from "./auth.js";
import { registerRoute, startRouter, handleRoute } from "./router.js";
import { mountParticleField } from "./particles.js";

import { renderLanding } from "./views/landing.js";
import { renderBuilder } from "./views/builder.js";
import { renderForumList, renderForumPost, renderForumCreate } from "./views/forum.js";
import { renderProfile } from "./views/profile.js";
import { renderPremium } from "./views/premium.js";
import { renderSupport } from "./views/support.js";
import { renderAdmin, isAdmin } from "./views/admin.js";

document.getElementById("footer-year").textContent = new Date().getFullYear();

const navToggle = document.getElementById("nav-toggle");
const navPrimary = document.getElementById("nav-primary");
navToggle.addEventListener("click", () => {
    const open = navPrimary.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
});
navPrimary.addEventListener("click", (event) => {
    if (event.target.tagName === "A") {
        navPrimary.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
    }
});

registerRoute("/",          renderLanding);
registerRoute("/builder",   renderBuilder);
registerRoute("/forum",     renderForumList);
registerRoute("/forum/new", renderForumCreate);
registerRoute("/forum/:id", renderForumPost);
registerRoute("/profile",   renderProfile);
registerRoute("/premium",   renderPremium);
registerRoute("/support",   renderSupport);
registerRoute("/admin",     renderAdmin);

function mountNavScrollState() {
    const topbar = document.getElementById("topbar");
    if (!topbar) return;
    const update = () => topbar.classList.toggle("scrolled", window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
}

(async () => {
    await bootstrapAuth();
    await renderAuthSlot();
    onAuthChange(async () => {
        await renderAuthSlot();
        handleRoute(); // re-render current view on login/logout
    });
    startRouter();
    mountParticleField();
    mountNavScrollState();
})();
