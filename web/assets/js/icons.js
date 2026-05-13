// Cohesive inline SVG icons. All 24×24, stroke 1.8, rounded caps.
// Strokes use currentColor so the parent's color flows through.

const SVGS = {
    bolt: `<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>`,
    brain: `<path d="M9 4a3 3 0 0 0-3 3v.5A3 3 0 0 0 4 10v1a3 3 0 0 0 1 2.2A3 3 0 0 0 4 16a3 3 0 0 0 3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3v-1"/><path d="M15 4a3 3 0 0 1 3 3v.5A3 3 0 0 1 20 10v1a3 3 0 0 1-1 2.2A3 3 0 0 1 20 16a3 3 0 0 1-3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3V5a1 1 0 0 1 1-1Z"/>`,
    target: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>`,
    sparkle: `<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>`,
    chartBar: `<path d="M3 21h18"/><rect x="6" y="11" width="3" height="8" rx="1"/><rect x="11" y="6" width="3" height="13" rx="1"/><rect x="16" y="14" width="3" height="5" rx="1"/>`,
    users: `<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15 20a5 5 0 0 1 6.5-4.7"/>`,
    globe: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>`,
    handWave: `<path d="M7 11V7a2 2 0 0 1 4 0v4M11 11V5a2 2 0 0 1 4 0v6M15 11V7a2 2 0 0 1 4 0v6a7 7 0 0 1-7 7 7 7 0 0 1-7-7v-1a2 2 0 0 1 4 0v1"/>`,
    shieldLock: `<path d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6l-8-3Z"/><rect x="9.5" y="11" width="5" height="5" rx="1"/><path d="M10.5 11V9a1.5 1.5 0 1 1 3 0v2"/>`,
    chatBubble: `<path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.4-4.8A8 8 0 1 1 21 12Z"/><path d="M8 11h8M8 14h5"/>`,
    bookOpen: `<path d="M3 5h6a3 3 0 0 1 3 3v12"/><path d="M21 5h-6a3 3 0 0 0-3 3v12"/><path d="M3 5v13M21 5v13"/>`,
    playCircle: `<circle cx="12" cy="12" r="9"/><path d="M10 9v6l5-3-5-3Z" fill="currentColor"/>`,
    mail: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>`,
    crown: `<path d="m4 18 1.5-9 4.5 4 2-7 2 7 4.5-4 1.5 9z"/><path d="M4 18h16"/>`,
    flame: `<path d="M12 3c1 4 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-5"/><path d="M12 21a6 6 0 0 0 6-6c0-3-2-5-3-7-1 3-3 4-3 7a3 3 0 0 1-6 0c0-2 1-3 2-5"/>`,
    dice: `<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>`,
    discord: `<path d="M19 6.5A14 14 0 0 0 16 5l-.4.7a11 11 0 0 0-7.2 0L8 5a14 14 0 0 0-3 1.5C2 11 1.5 15 2 19a14 14 0 0 0 4.5 2L7.5 19a8 8 0 0 1-2-1l.5-.4a10 10 0 0 0 12 0l.5.4a8 8 0 0 1-2 1l1 2a14 14 0 0 0 4.5-2c.5-4 0-8-3-12.5Z"/><circle cx="9" cy="13" r="1.4" fill="currentColor"/><circle cx="15" cy="13" r="1.4" fill="currentColor"/>`,
    youtube: `<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor"/>`,
    download: `<path d="M12 3v12M7 11l5 5 5-5"/><path d="M5 21h14"/>`,
    rocket: `<path d="M5 19c0-3 2-7 7-12 5 5 7 9 7 12-2 0-4-1-5-2-1 1-3 2-5 2-1-1-3-1-4 0Z"/><circle cx="12" cy="11" r="1.8" fill="currentColor"/><path d="M9 17c-1 1-1 3-2 4 1-1 3-1 4-2"/>`,
};

const WRAPPER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;

export function iconSVG(name) {
    const body = SVGS[name];
    if (!body) return WRAPPER + `<circle cx="12" cy="12" r="6"/></svg>`;
    return `${WRAPPER}${body}</svg>`;
}

/**
 * Build a themed icon "tile" (rounded square with gradient bg + icon inside).
 * @param {string} name — icon key from SVGS
 * @param {{ size?: 'sm'|'md'|'lg', className?: string }} options
 * @returns {HTMLElement}
 */
export function iconTile(name, { size = "md", className = "" } = {}) {
    const sizeClass = size === "lg" ? " lg" : size === "sm" ? " sm" : "";
    const tile = document.createElement("span");
    tile.className = `icon-tile${sizeClass}${className ? " " + className : ""}`;
    tile.innerHTML = iconSVG(name);
    return tile;
}

/** Plain inline icon node (no tile background). */
export function icon(name, { className = "", size } = {}) {
    const span = document.createElement("span");
    span.className = `icon-inline${className ? " " + className : ""}`;
    span.style.display = "inline-flex";
    if (size) {
        span.style.width = `${size}px`;
        span.style.height = `${size}px`;
    }
    span.innerHTML = iconSVG(name);
    if (size) {
        const svg = span.querySelector("svg");
        svg.setAttribute("width", String(size));
        svg.setAttribute("height", String(size));
    }
    return span;
}
