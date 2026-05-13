// Tiny DOM helpers: element creation, escaping, toasts, modal.

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
        if (value === undefined || value === null || value === false) continue;
        if (key === "class") node.className = value;
        else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
        else if (key.startsWith("on") && typeof value === "function") {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === "dataset") {
            for (const [dk, dv] of Object.entries(value)) node.dataset[dk] = dv;
        } else if (key === "html") {
            node.innerHTML = value;
        } else {
            node.setAttribute(key, value === true ? "" : value);
        }
    }
    for (const child of children.flat()) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
}

export function escapeHTML(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
    }[c]));
}

export function timeAgo(input) {
    if (!input) return "";
    const date = input instanceof Date ? input : new Date(input);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    const ranges = [
        ["y", 31536000], ["mo", 2592000], ["w", 604800],
        ["d", 86400], ["h", 3600], ["m", 60],
    ];
    for (const [unit, unitSeconds] of ranges) {
        const value = Math.floor(seconds / unitSeconds);
        if (value >= 1) return `${value}${unit} ago`;
    }
    return `${Math.max(1, seconds)}s ago`;
}

let toastRegion;
export function toast(message, kind = "info", duration = 3500) {
    if (!toastRegion) toastRegion = document.getElementById("toast-region");
    if (!toastRegion) return;
    const t = el("div", { class: `toast ${kind}` }, message);
    toastRegion.append(t);
    setTimeout(() => {
        t.style.opacity = "0";
        t.style.transform = "translateY(8px)";
        setTimeout(() => t.remove(), 200);
    }, duration);
}

export function openModal(content) {
    const region = document.getElementById("modal-region");
    region.innerHTML = "";
    region.classList.add("is-open");
    region.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const modal = el("div", { class: "modal", role: "dialog", "aria-modal": "true" });
    if (typeof content === "function") content(modal, closeModal);
    else modal.append(content);
    region.append(modal);

    const escHandler = (event) => {
        if (event.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", escHandler);
    region.addEventListener("click", (event) => {
        if (event.target === region) closeModal();
    });
    region._escHandler = escHandler;
    return closeModal;
}

export function closeModal() {
    const region = document.getElementById("modal-region");
    if (!region) return;
    region.classList.remove("is-open");
    region.setAttribute("aria-hidden", "true");
    if (region._escHandler) document.removeEventListener("keydown", region._escHandler);
    region.innerHTML = "";
    document.body.style.overflow = "";
}

export function setLoading(target, message = "Loading…") {
    target.innerHTML = "";
    target.append(el("div", { class: "loading-block" },
        el("span", { class: "spinner" }),
        message,
    ));
}

export function renderMarkdown(source) {
    if (!source) return "";
    if (window.marked && window.DOMPurify) {
        const html = window.marked.parse(source, { breaks: true, gfm: true });
        return window.DOMPurify.sanitize(html);
    }
    return escapeHTML(source).replace(/\n/g, "<br>");
}

export function copyToClipboard(text) {
    return navigator.clipboard.writeText(text);
}

export function debounce(fn, ms = 250) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

/** Pointer-tracked glow inside .btn-primary (drives --mx/--my CSS vars). */
export function attachPointerGlow(node) {
    if (!node || node._glowAttached) return;
    node._glowAttached = true;
    node.addEventListener("pointermove", (event) => {
        const rect = node.getBoundingClientRect();
        node.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
        node.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
    });
}

export function attachPointerGlowAll(root = document) {
    root.querySelectorAll(".btn-primary").forEach(attachPointerGlow);
}

/**
 * Animate a number from 0 (or current) up to `target` once `el` enters viewport.
 * Respects prefers-reduced-motion.
 * @param {HTMLElement} el — element whose textContent will be updated
 * @param {number} target
 * @param {{ duration?: number, suffix?: string }} opts
 */
export function countUp(el, target, { duration = 1400, suffix = "" } = {}) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        el.textContent = `${target}${suffix}`;
        return;
    }
    const fire = () => {
        const start = performance.now();
        const initial = 0;
        function step(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
            const value = Math.round(initial + (target - initial) * eased);
            el.textContent = `${value}${suffix}`;
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    };
    if (!("IntersectionObserver" in window)) { fire(); return; }
    const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                fire();
                io.disconnect();
                return;
            }
        }
    }, { threshold: 0.4 });
    io.observe(el);
}

/** Apply ::before --i variable for staggered children. */
export function applyStagger(container) {
    Array.from(container.children).forEach((child, index) => {
        child.style.setProperty("--i", String(index));
    });
}

/** Reveal-on-scroll observer for any .reveal element under root. */
export function observeReveals(root) {
    if (!("IntersectionObserver" in window)) {
        root.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
        return;
    }
    const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                entry.target.classList.add("in");
                io.unobserve(entry.target);
            }
        }
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    root.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}
