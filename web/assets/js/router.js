import { isLoggedIn, openLoginModal } from "./auth.js";
import { setLoading, $$ } from "./ui.js";

const routes = new Map();
let _currentPathname = null;

export function registerRoute(path, view) {
    routes.set(path, view);
}

function parseRoute(hash) {
    const cleaned = (hash || "#/").replace(/^#/, "") || "/";
    const [pathname, query] = cleaned.split("?");
    const segments = pathname.split("/").filter(Boolean);
    const params = Object.fromEntries(new URLSearchParams(query || ""));
    return { pathname, segments, params };
}

function matchRoute({ pathname, segments }) {
    if (routes.has(pathname)) {
        return { handler: routes.get(pathname), params: {} };
    }
    for (const [pattern, handler] of routes.entries()) {
        const patternSegments = pattern.split("/").filter(Boolean);
        if (patternSegments.length !== segments.length) continue;
        const params = {};
        let matched = true;
        for (let i = 0; i < patternSegments.length; i++) {
            const ps = patternSegments[i];
            if (ps.startsWith(":")) {
                params[ps.slice(1)] = decodeURIComponent(segments[i]);
            } else if (ps !== segments[i]) {
                matched = false;
                break;
            }
        }
        if (matched) return { handler, params };
    }
    return null;
}

const AUTH_REQUIRED_PREFIXES = ["/builder", "/forum", "/profile"];

function requiresAuth(pathname) {
    return AUTH_REQUIRED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function handleRoute() {
    const view = document.getElementById("view");
    if (location.hash.startsWith("#access_token=") || location.hash.includes("&access_token=")) {
        history.replaceState(null, "", location.pathname + "#/");
    }
    const route = parseRoute(location.hash);

    if (requiresAuth(route.pathname) && !isLoggedIn()) {
        location.hash = "#/";
        openLoginModal({ mode: "signin" });
        return;
    }

    const match = matchRoute(route);
    if (!match) {
        view.innerHTML = "<div class='empty'>Page not found.</div>";
        return;
    }

    const isNewRoute = route.pathname !== _currentPathname;
    _currentPathname = route.pathname;

    setLoading(view, "Loading…");
    try {
        await match.handler(view, { ...route.params, ...match.params, query: route.params });
    } catch (err) {
        console.error(err);
        view.innerHTML = `<div class='empty'>Something went wrong: ${String(err.message || err)}</div>`;
    }

    document.getElementById("view").focus({ preventScroll: true });
    if (isNewRoute) window.scrollTo({ top: 0 });
    updateActiveNav(route.pathname);
}

function updateActiveNav(pathname) {
    $$('.nav-primary a').forEach((link) => {
        link.classList.toggle("active", link.dataset.route === pathname);
    });
}

export function startRouter() {
    // Supabase OAuth redirects back with #access_token=... in the hash.
    // Clear it so the router doesn't treat it as a page path.
    if (location.hash.startsWith("#access_token=") || location.hash.includes("&access_token=")) {
        history.replaceState(null, "", location.pathname + "#/");
    }
    if (!location.hash) location.hash = "#/";
    window.addEventListener("hashchange", handleRoute);
    handleRoute();
}
