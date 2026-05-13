import { el, toast, copyToClipboard, attachPointerGlowAll, observeReveals } from "../ui.js";
import { DISCORD_INVITE, DISCORD_USERNAME } from "../config.js";
import { iconTile, iconSVG } from "../icons.js";

const TIERS = [
    {
        id: "free",
        name: "Free",
        price: "$0",
        unit: "forever",
        description: "Everything most servers need.",
        features: [
            "All 49 slash commands",
            "Channel-scoped activation",
            "Persistent memory",
            "User facts + persona overlays",
            "All AI commands",
            "Self-hosted (your tokens)",
        ],
        cta: { label: "Use the builder", href: "#/builder" },
    },
    {
        id: "pro",
        name: "Pro",
        price: "Custom",
        unit: "DM for pricing",
        featured: true,
        description: "Priority help + custom features built for your server.",
        features: [
            "Everything in Free",
            "Custom slash commands built to spec",
            "Personality fine-tuning sessions",
            "Priority support in DMs",
            "Early access to new features",
            "Multi-character setups",
        ],
        cta: { label: `Add me on Discord — ${DISCORD_USERNAME}`, action: "discord-dm" },
    },
    {
        id: "hosted",
        name: "Hosted",
        price: "Custom",
        unit: "DM for pricing",
        description: "I host the bot for you. 24/7 uptime, no setup.",
        features: [
            "Everything in Pro",
            "I run the bot for you",
            "99.9% uptime monitoring",
            "Auto-restart on errors",
            "Logs + analytics dashboard",
            "Backups + token rotation",
        ],
        cta: { label: `Add me on Discord — ${DISCORD_USERNAME}`, action: "discord-dm" },
    },
];

export async function renderPremium(view) {
    view.innerHTML = "";
    view.append(
        el("section", { class: "section-tight" },
            el("h2", { style: { margin: "0 0 0.5rem" } }, "SyncCord Premium"),
            el("p", { class: "lede", style: { maxWidth: "60ch" } },
                "Free works for most. Premium is for when you want help, custom features, or someone else to keep the bot online."),
        ),
    );

    const grid = el("div", { class: "premium-grid" });
    for (const tier of TIERS) grid.append(buildTier(tier));
    view.append(grid);

    view.append(
        el("section", { class: "section" },
            el("div", { class: "card", style: { textAlign: "center", padding: "2.5rem 1.5rem" } },
                el("h3", { style: { margin: "0 0 0.5rem" } }, "How to get in touch"),
                el("p", { style: { color: "var(--text-muted)", margin: "0 0 1.5rem", maxWidth: "60ch", marginInline: "auto" } },
                    "Add me on Discord. Mention which tier you're interested in and what your server is like. I usually respond within a day."),
                el("div", { style: { display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" } },
                    el("button", {
                        class: "btn btn-primary",
                        onClick: () => onDiscordContact(),
                    }, `Add ${DISCORD_USERNAME}`),
                    el("a", {
                        class: "btn btn-ghost", href: DISCORD_INVITE, target: "_blank", rel: "noopener",
                    }, "Join the Discord server"),
                ),
            ),
        ),
    );

    view.append(buildFAQ());
    observeReveals(view);
    attachPointerGlowAll(view);
}

function buildTier(tier) {
    const card = el("div", { class: `card tier reveal ${tier.featured ? "featured" : ""}` });
    if (tier.featured) {
        const badge = el("span", { class: "tier-badge", style: { display: "inline-flex", alignItems: "center", gap: "0.3rem" } });
        badge.innerHTML = iconSVG("crown");
        const lbl = document.createElement("span");
        lbl.textContent = "Most popular";
        badge.append(lbl);
        // Force the inner svg to a sane size
        const svg = badge.querySelector("svg");
        if (svg) { svg.setAttribute("width", "14"); svg.setAttribute("height", "14"); }
        card.append(badge);
    }
    card.append(
        el("h3", {}, tier.name),
        el("p", { class: "price" }, tier.price, " ", el("span", {}, tier.unit)),
        el("p", { style: { color: "var(--text-muted)", margin: "0 0 1rem", fontSize: "0.92rem" } }, tier.description),
        el("ul", {}, ...tier.features.map((f) => el("li", {}, f))),
    );

    let cta;
    if (tier.cta.action === "discord-dm") {
        cta = el("button", { class: tier.featured ? "btn btn-primary" : "btn btn-ghost", onClick: onDiscordContact }, tier.cta.label);
    } else {
        cta = el("a", { class: tier.featured ? "btn btn-primary" : "btn btn-ghost", href: tier.cta.href }, tier.cta.label);
    }
    card.append(cta);
    return card;
}

function onDiscordContact() {
    copyToClipboard(DISCORD_USERNAME).then(
        () => toast(`Copied "${DISCORD_USERNAME}" to clipboard. Paste in Discord's Add Friend dialog.`, "success"),
        () => toast(`My Discord username: ${DISCORD_USERNAME}`, "info"),
    );
    setTimeout(() => window.open(DISCORD_INVITE, "_blank", "noopener"), 600);
}

function buildFAQ() {
    const faqs = [
        ["Is the free tier really free forever?",
            "Yes. The bot is open-source and self-hosted, so I have no recurring server costs to recover."],
        ["What does Pro actually include?",
            "Custom slash commands, fine-tuning your character's voice, priority help when something breaks. I scope each engagement individually based on what you need."],
        ["Will hosted plans run my bot 24/7?",
            "Yes — I run it on a private VPS with monitoring and auto-restart. You hand me the keys, I keep it online."],
        ["Can I cancel anytime?",
            "Yes. No contracts, no lock-in. Pay monthly, cancel whenever."],
    ];
    const wrap = el("section", { class: "section" });
    wrap.append(el("h3", { style: { margin: "0 0 1rem" } }, "Common questions"));
    for (const [q, a] of faqs) {
        wrap.append(el("details", { class: "card", style: { marginBottom: "0.75rem", padding: "1rem 1.25rem", cursor: "var(--cursor-pointer)" } },
            el("summary", { style: { fontWeight: 600, cursor: "var(--cursor-pointer)" } }, q),
            el("p", { style: { color: "var(--text-muted)", margin: "0.5rem 0 0" } }, a),
        ));
    }
    return wrap;
}
