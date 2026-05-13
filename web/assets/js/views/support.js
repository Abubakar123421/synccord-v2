import { el, toast, copyToClipboard, attachPointerGlowAll, observeReveals } from "../ui.js";
import { DISCORD_INVITE, DISCORD_USERNAME, YOUTUBE_URL } from "../config.js";
import { iconTile } from "../icons.js";

export async function renderSupport(view) {
    view.innerHTML = "";

    view.append(
        el("section", { class: "section-tight" },
            el("h2", { style: { margin: "0 0 0.5rem" } }, "Support"),
            el("p", { class: "lede" },
                "Stuck? Pick the channel that fits — community first, me directly when it's serious."),
        ),
    );

    const grid = el("div", { class: "support-grid" });

    grid.append(supportCard({
        icon: "discord",
        title: "Community Discord",
        body: "The fastest way to get help. Real users, real answers, often within minutes.",
        cta: { label: "Join the server", href: DISCORD_INVITE, external: true },
    }));

    grid.append(supportCard({
        icon: "bookOpen",
        title: "Forum",
        body: "Searchable threads with images, code blocks, and tags. Best for setup issues and feature requests.",
        cta: { label: "Browse the forum", href: "#/forum" },
    }));

    grid.append(supportCard({
        icon: "youtube",
        title: "YouTube tutorials",
        body: "Walkthroughs for setup, hosting, and customizing your bot. New videos posted regularly.",
        cta: { label: "Watch on YouTube", href: YOUTUBE_URL, external: true },
    }));

    grid.append(supportCard({
        icon: "mail",
        title: "Direct DM",
        body: `For premium users or anything serious — DM me on Discord at ${DISCORD_USERNAME}. Give me the gist of what's going on and screenshots if you have them.`,
        cta: { label: `Copy ${DISCORD_USERNAME}`, action: "copy-discord" },
    }));

    view.append(grid);
    observeReveals(view);
    attachPointerGlowAll(view);

    view.append(
        el("section", { class: "section" },
            el("h3", {}, "Common first steps"),
            el("ol", { style: { color: "var(--text-muted)", paddingLeft: "1.25rem", lineHeight: 1.8 } },
                el("li", {}, "Make sure your Discord token and Groq key are correct (no extra spaces)."),
                el("li", {}, "Run ", el("code", { style: { background: "rgba(124,92,255,0.15)", padding: "0.1rem 0.4rem", borderRadius: "4px" } }, "/activate #channel-name"),
                    " in the server — the bot only replies in activated channels."),
                el("li", {}, "Check the terminal output where the bot is running for any errors."),
                el("li", {}, "Still stuck? Post a thread in the forum with the error message and your setup."),
            ),
        ),
    );
}

function supportCard({ icon, title, body, cta }) {
    let action;
    if (cta.action === "copy-discord") {
        action = el("button", {
            class: "btn btn-primary",
            onClick: () => {
                copyToClipboard(DISCORD_USERNAME).then(
                    () => toast(`Copied "${DISCORD_USERNAME}" to clipboard.`, "success"),
                    () => toast(`Discord: ${DISCORD_USERNAME}`, "info"),
                );
            },
        }, cta.label);
    } else if (cta.external) {
        action = el("a", { class: "btn btn-primary", href: cta.href, target: "_blank", rel: "noopener" }, cta.label);
    } else {
        action = el("a", { class: "btn btn-primary", href: cta.href }, cta.label);
    }

    const tileWrap = el("div", { style: { display: "flex", justifyContent: "center", marginBottom: "0.75rem" } });
    tileWrap.append(iconTile(icon, { size: "lg" }));
    return el("div", { class: "card support-card reveal" },
        tileWrap,
        el("h3", { style: { margin: "0 0 0.25rem" } }, title),
        el("p", { style: { color: "var(--text-muted)", margin: "0 0 1rem", fontSize: "0.92rem" } }, body),
        action,
    );
}
