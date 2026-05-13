import sb from "../supabase.js";
import { el, escapeHTML, timeAgo, toast, attachPointerGlowAll, countUp, applyStagger, observeReveals } from "../ui.js";
import { isLoggedIn, openLoginModal, getUser } from "../auth.js";
import { iconTile } from "../icons.js";

const FEATURES = [
    { icon: "brain",      title: "Stays in character",         body: "Persistent personality across messages with channel-scoped memory you control." },
    { icon: "target",     title: "Channel-scoped activation",  body: "Bot only replies in channels you explicitly enable. No noise anywhere else." },
    { icon: "sparkle",    title: "20+ AI commands",            body: "/ask, /summary, /vibecheck, /eli5, /story, /translate, /tldr — all in character." },
    { icon: "chartBar",   title: "Polls, reminders, dice",     body: "Interactive button polls, persistent DM reminders, dice parser, magic 8-ball." },
    { icon: "users",      title: "User memory",                body: "/remember pins facts about your members so the bot greets them naturally." },
    { icon: "globe",      title: "Built-in lookups",           body: "/wiki, /define, /serverinfo, /userinfo, /roleinfo — clean embeds, real data." },
    { icon: "handWave",   title: "AI welcome messages",        body: "Each new member gets a unique greeting in your character's voice." },
    { icon: "shieldLock", title: "Self-hosted, your keys",     body: "Download a Python file with your API keys baked in. Your data never touches us." },
];

const STARS = (rating) => "★★★★★".slice(0, rating).padEnd(5, "☆");

export async function renderLanding(view) {
    const gen = (view.__gen = (view.__gen || 0) + 1);
    view.innerHTML = "";
    const hero = buildHero();
    const marquee = buildMarquee();
    const features = buildFeatures();
    const cta = buildCTA();
    const reviews = await buildReviewsSection();
    if (view.__gen !== gen) return;
    view.append(hero, marquee, features, cta, reviews);
    observeReveals(view);
    attachPointerGlowAll(view);
    animateHeroStats(view);
    view.querySelectorAll(".network-canvas").forEach((c) => startNetworkAnim(c));
}

function buildHero() {
    const ctaLogged = isLoggedIn();

    const badge = el("div", { class: "tag breathe", style: { padding: "0.4rem 0.85rem", gap: "0.5rem" } });
    badge.append(iconTile("bolt", { size: "sm" }), el("span", {}, "SYNCCORD V2 — NOW LIVE"));

    const canvas = el("canvas", { id: "hero-morph-canvas", class: "network-canvas", "aria-hidden": "true" });
    const canvasL = el("canvas", { class: "network-canvas side-canvas", "aria-hidden": "true" });
    const canvasR = el("canvas", { class: "network-canvas side-canvas", "aria-hidden": "true" });

    const heroTypeEl = el("span", { class: "hero-typewriter-text" });
    const heroTypeWrap = el("p", { class: "hero-typewriter-line" },
        "Your ", heroTypeEl, el("span", { class: "typewriter-cursor" }, "|"));
    const heroPhases = ["AI character.", "Discord bot.", "custom persona.", "bot identity."];
    let hp = 0, hc = 0, hd = false;
    function heroTick() {
        const phrase = heroPhases[hp];
        if (!hd) {
            heroTypeEl.textContent = phrase.slice(0, ++hc);
            if (hc === phrase.length) { hd = true; setTimeout(heroTick, 1600); return; }
        } else {
            heroTypeEl.textContent = phrase.slice(0, --hc);
            if (hc === 0) { hd = false; hp = (hp + 1) % heroPhases.length; }
        }
        setTimeout(heroTick, hd ? 45 : 75);
    }
    setTimeout(heroTick, 800);

    return el("section", { class: "hero reveal" },
        el("div", { class: "hero-orb", "aria-hidden": "true" }),
        el("div", { class: "hero-side-web hero-side-web--left", "aria-hidden": "true" }, canvasL),
        el("div", { class: "hero-side-web hero-side-web--right", "aria-hidden": "true" }, canvasR),
        el("div", { class: "hero-text" },
            badge,
            el("h1", {}, "Build your own bot"),
            heroTypeWrap,
            el("p", { style: { color: "var(--text-muted)", margin: "-0.5rem 0 0", fontSize: "var(--fs-sm)" } }, "No coding required."),
            el("div", { class: "hero-cta" },
                el("a", {
                    class: "btn btn-primary btn-lg",
                    href: ctaLogged ? "#/builder" : "#",
                    onClick: (event) => {
                        if (!ctaLogged) {
                            event.preventDefault();
                            openLoginModal({ mode: "signup" });
                        }
                    },
                }, ctaLogged ? "Open the builder →" : "Get started — free"),
                el("a", { class: "btn btn-ghost btn-lg", href: "#/forum" }, "Browse the forum"),
            ),
            el("div", { class: "hero-stats" },
                statBlock("49", "slash commands", { number: 49 }),
                statBlock("20+", "AI commands", { number: 20, suffix: "+" }),
                statBlock("∞", "characters you can build"),
            ),
        ),
        el("div", { class: "hero-media" }, canvas),
        el("div", { class: "scroll-indicator", "aria-hidden": "true" },
            el("span", {}, "SCROLL"),
            el("span", { class: "arrow" }, "↓"),
        ),
    );
}

function buildMarquee() {
    const phrases = [
        "Build your bot",
        "Self-hosted",
        "49 commands",
        "AI-powered",
        "Discord-native",
        "Free forever",
    ];
    const trackContent = phrases.map((p) => `<span>${p}</span>`).join("");
    return el("div", { class: "marquee", "aria-hidden": "true" },
        el("div", { class: "marquee-track", html: trackContent + trackContent }),
    );
}

function startNetworkAnim(canvas) {
    if (!canvas) return;

    const isSide = canvas.classList.contains("side-canvas");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const TAU = Math.PI * 2;

    const NODE_COUNT = isSide ? 28 : 46;
    const HUB_COUNT = isSide ? 4 : 7;
    const CONNECT_DIST_RATIO = 0.38;
    const MOUSE_REPEL = 90;

    let w = 0, h = 0;
    let nodes = [];
    let pulses = [];
    let mouse = { x: -9999, y: -9999 };
    let time = 0;
    let lastTs = 0;
    let raf = 0;

    function setSize() {
        const col = canvas.parentElement;
        const pw = col.offsetWidth || (isSide ? 260 : 480);
        const ph = col.offsetHeight || (isSide ? 500 : Math.round(pw * 0.92));
        w = pw; h = ph;
        canvas.width = pw * dpr;
        canvas.height = ph * dpr;
        canvas.style.width = pw + "px";
        canvas.style.height = ph + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initNodes() {
        nodes = Array.from({ length: NODE_COUNT }, (_, i) => ({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.45,
            vy: (Math.random() - 0.5) * 0.45,
            r: i < HUB_COUNT ? 4.5 + Math.random() * 2 : 2 + Math.random() * 1.8,
            isHub: i < HUB_COUNT,
            phase: Math.random() * TAU,
            pulse: 0,        // hub ring expansion 0→1
            pulseAlpha: 0,
        }));
    }

    function spawnPulse(a, b) {
        pulses.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, t: 0 });
    }

    function render(ts) {
        if (!canvas.isConnected) return;
        const dt = Math.min((ts - lastTs) / 1000, 0.05);
        lastTs = ts;
        time += dt;

        ctx.clearRect(0, 0, w, h);

        const connectDist = w * CONNECT_DIST_RATIO;
        const connectDist2 = connectDist * connectDist;

        // move nodes
        for (const n of nodes) {
            // mouse repulsion
            const mdx = n.x - mouse.x;
            const mdy = n.y - mouse.y;
            const md2 = mdx * mdx + mdy * mdy;
            if (md2 < MOUSE_REPEL * MOUSE_REPEL && md2 > 0.01) {
                const md = Math.sqrt(md2);
                const f = (1 - md / MOUSE_REPEL) * 1.8;
                n.vx += (mdx / md) * f;
                n.vy += (mdy / md) * f;
            }

            n.vx *= 0.985;
            n.vy *= 0.985;
            n.x += n.vx;
            n.y += n.vy;

            // soft boundary bounce
            if (n.x < 12)      { n.x = 12;      n.vx =  Math.abs(n.vx) * 0.6; }
            if (n.x > w - 12)  { n.x = w - 12;  n.vx = -Math.abs(n.vx) * 0.6; }
            if (n.y < 12)      { n.y = 12;       n.vy =  Math.abs(n.vy) * 0.6; }
            if (n.y > h - 12)  { n.y = h - 12;  n.vy = -Math.abs(n.vy) * 0.6; }
        }

        // draw edges
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                const dx = b.x - a.x, dy = b.y - a.y;
                const d2 = dx * dx + dy * dy;
                if (d2 > connectDist2) continue;
                const t = 1 - Math.sqrt(d2) / connectDist;
                const alpha = t * t * 0.55;
                const lw = t * (a.isHub || b.isHub ? 1.4 : 0.8);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = `rgba(255,215,0,${alpha.toFixed(3)})`;
                ctx.lineWidth = lw;
                ctx.stroke();

                // randomly spawn data pulses on hub edges
                if ((a.isHub || b.isHub) && Math.random() < 0.0005) spawnPulse(a, b);
            }
        }

        // draw data pulses
        pulses = pulses.filter((p) => p.t < 1);
        for (const p of pulses) {
            p.t += dt * 0.55;
            const px = p.ax + (p.bx - p.ax) * p.t;
            const py = p.ay + (p.by - p.ay) * p.t;
            const alpha = Math.sin(p.t * Math.PI);
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, TAU);
            ctx.fillStyle = `rgba(255,240,100,${(alpha * 0.95).toFixed(3)})`;
            ctx.fill();
            // trailing glow
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, TAU);
            ctx.fillStyle = `rgba(255,215,0,${(alpha * 0.18).toFixed(3)})`;
            ctx.fill();
        }

        // draw nodes
        for (const n of nodes) {
            const breathe = 1 + Math.sin(time * 1.2 + n.phase) * 0.18;

            if (n.isHub) {
                // pulse ring
                n.pulse += dt * 0.7;
                if (n.pulse > 1) { n.pulse = 0; n.pulseAlpha = 0.7; }
                n.pulseAlpha *= 0.97;
                const rr = n.r + n.pulse * 26;
                ctx.beginPath();
                ctx.arc(n.x, n.y, rr, 0, TAU);
                ctx.strokeStyle = `rgba(255,215,0,${(n.pulseAlpha).toFixed(3)})`;
                ctx.lineWidth = 1;
                ctx.stroke();

                // outer glow
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r * breathe * 3.5, 0, TAU);
                ctx.fillStyle = "rgba(255,215,0,0.07)";
                ctx.fill();
            }

            // mid glow ring
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r * breathe * 2.2, 0, TAU);
            ctx.fillStyle = n.isHub ? "rgba(255,215,0,0.14)" : "rgba(255,215,0,0.08)";
            ctx.fill();

            // core dot
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r * breathe, 0, TAU);
            ctx.fillStyle = n.isHub ? "rgba(255,230,60,0.95)" : "rgba(255,215,0,0.82)";
            ctx.fill();
        }

        raf = requestAnimationFrame(render);
    }

    function onMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    }
    function onMouseLeave() { mouse.x = -9999; mouse.y = -9999; }

    setSize();
    initNodes();

    canvas.addEventListener("mousemove", onMouseMove, { passive: true });
    canvas.addEventListener("mouseleave", onMouseLeave);

    const onResize = () => { setSize(); initNodes(); };
    window.addEventListener("resize", onResize, { passive: true });

    if (reduced) {
        // static snapshot — just draw once with nodes settled
        lastTs = 0;
        render(0);
        cancelAnimationFrame(raf);
    } else {
        raf = requestAnimationFrame(render);
    }
}


function statBlock(big, small, opts = {}) {
    const strong = el("strong", { class: "count-up glow-text" }, big);
    if (opts.number) {
        strong.dataset.target = String(opts.number);
        strong.dataset.suffix = opts.suffix || "";
        strong.textContent = "0" + (opts.suffix || "");
    }
    return el("div", { class: "hero-stat" },
        strong,
        el("span", {}, small),
    );
}

function animateHeroStats(root) {
    root.querySelectorAll(".hero-stat .count-up[data-target]").forEach((node) => {
        countUp(node, Number(node.dataset.target), { suffix: node.dataset.suffix || "" });
    });
}

function buildFeatures() {
    const grid = el("div", { class: "grid reveal-stagger" });
    FEATURES.forEach((f, index) => {
        const card = el("div", { class: "card reveal", style: { ["--i"]: String(index) } });
        card.append(
            iconTile(f.icon, { size: "lg" }),
            el("h3", { style: { fontSize: "1.05rem", margin: "1rem 0 0.25rem" } }, f.title),
            el("p", { style: { color: "var(--text-muted)", margin: 0, fontSize: "0.92rem" } }, f.body),
        );
        grid.append(card);
    });
    applyStagger(grid);
    return el("section", { class: "section" },
        el("h2", { class: "reveal" }, "Everything you need"),
        el("p", { class: "lede reveal" }, "Industry-grade embeds, no rough edges, no fake features."),
        grid,
    );
}

function buildCTA() {
    const typeEl = el("span", { style: { color: "var(--accent)", fontWeight: "700" } });
    const phrases = ["AI character bot.", "Discord personality.", "custom bot identity.", "AI companion."];
    let pi = 0, ci = 0, deleting = false;
    function tick() {
        const phrase = phrases[pi];
        if (!deleting) {
            typeEl.textContent = phrase.slice(0, ++ci);
            if (ci === phrase.length) { deleting = true; setTimeout(tick, 1800); return; }
        } else {
            typeEl.textContent = phrase.slice(0, --ci);
            if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; }
        }
        setTimeout(tick, deleting ? 40 : 70);
    }
    setTimeout(tick, 500);

    return el("section", { class: "section reveal" },
        el("div", {
            class: "card",
            style: {
                textAlign: "center", padding: "3.5rem 1.5rem",
                background: "linear-gradient(135deg, rgba(255,215,0,0.10), rgba(255,215,0,0.03))",
                borderColor: "rgba(255,215,0,0.35)",
                boxShadow: "0 0 60px rgba(255,215,0,0.12), inset 0 0 80px rgba(255,215,0,0.04)",
            },
        },
            el("h2", { class: "glow-text", style: { margin: "0 0 0.5rem", fontSize: "clamp(1.8rem,4vw,2.8rem)" } }, "Build your own AI character bot"),
            el("p", { style: { margin: "0 auto 1rem", fontSize: "var(--fs-lg)", color: "var(--accent)", fontFamily: "var(--font-mono)", letterSpacing: "0.02em" } },
                typeEl, el("span", { class: "typewriter-cursor" }, "|")),
            el("p", { class: "lede", style: { margin: "0 auto 1.5rem" } },
                "Sign up, fill in your character, paste your Discord and Groq tokens, download. That's it."),
            isLoggedIn()
                ? el("a", { class: "btn btn-primary btn-lg float", href: "#/builder" }, "Open the builder")
                : el("button", { class: "btn btn-primary btn-lg float", onClick: () => openLoginModal({ mode: "signup" }) }, "Create free account"),
        ),
    );
}

async function buildReviewsSection() {
    const wrapper = el("section", { class: "section" },
        el("h2", {}, "What people are saying"),
        el("p", { class: "lede" }, "From the SyncCord community. Sign in to leave your own."),
    );

    let stats = { total_reviews: 0, average_rating: 0 };
    try {
        const { data: statRow } = await sb.from("review_stats").select("*").maybeSingle();
        if (statRow) stats = statRow;
    } catch (err) { console.warn("review_stats failed", err); }

    const statBar = el("div", { style: { display: "flex", gap: "1.5rem", marginBottom: "1.5rem", flexWrap: "wrap" } },
        el("div", {}, el("strong", { style: { fontSize: "1.4rem" } }, String(stats.total_reviews || 0)),
            el("span", { style: { color: "var(--text-muted)", marginLeft: "0.5rem" } }, "reviews")),
        el("div", {}, el("strong", { style: { fontSize: "1.4rem", color: "var(--warn)" } },
            stats.average_rating ? Number(stats.average_rating).toFixed(2) : "—"),
            el("span", { style: { color: "var(--text-muted)", marginLeft: "0.5rem" } }, "avg rating")),
    );
    wrapper.append(statBar);

    if (isLoggedIn()) {
        wrapper.append(buildReviewForm(wrapper));
    } else {
        wrapper.append(el("div", { class: "empty", style: { marginBottom: "1.5rem" } },
            "Sign in to leave a review."));
    }

    const reviewsGrid = el("div", { class: "grid" });
    wrapper.append(reviewsGrid);

    try {
        const { data, error } = await sb
            .from("reviews_with_profile")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(12);
        if (error) throw error;
        if (!data || data.length === 0) {
            reviewsGrid.append(el("div", { class: "empty" }, "No reviews yet. Be the first."));
        } else {
            for (const r of data) reviewsGrid.append(reviewCard(r));
        }
    } catch (err) {
        reviewsGrid.append(el("div", { class: "empty" }, "Could not load reviews right now."));
        console.warn(err);
    }

    return wrapper;
}

function reviewCard(r) {
    const initials = (r.username || "?").slice(0, 2).toUpperCase();
    const avatar = r.avatar_url
        ? el("img", { class: "review-avatar", src: r.avatar_url, alt: "" })
        : el("div", {
            class: "review-avatar",
            style: { display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700 },
        }, initials);
    return el("div", { class: "card review-card reveal" },
        el("div", { class: "review-head" },
            avatar,
            el("div", {},
                el("div", { class: "review-name" }, r.username || "Anonymous"),
                el("div", { class: "review-meta" }, timeAgo(r.created_at)),
            ),
        ),
        el("div", { class: "review-stars" }, STARS(r.rating)),
        el("div", { class: "review-content" }, r.content || ""),
    );
}

function buildReviewForm(reviewsSection) {
    const card = el("div", { class: "card", style: { marginBottom: "1.5rem" } });
    card.append(el("h3", { style: { margin: "0 0 0.75rem", fontSize: "1.05rem" } }, "Write a review"));

    const starInput = el("div", { class: "star-input", style: { marginBottom: "0.75rem" } });
    for (let i = 5; i >= 1; i--) {
        const id = `star-${i}`;
        starInput.append(
            el("input", { type: "radio", name: "rating", id, value: i, required: true }),
            el("label", { for: id, title: `${i} stars` }, "★"),
        );
    }
    const textarea = el("textarea", {
        placeholder: "Share your experience…", maxlength: 2000, rows: 3, required: true,
    });

    const submit = el("button", { class: "btn btn-primary", type: "submit" }, "Post review");
    const form = el("form", {}, starInput, textarea,
        el("div", { style: { marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" } }, submit));

    form.onsubmit = async (event) => {
        event.preventDefault();
        const rating = Number(starInput.querySelector("input:checked")?.value);
        if (!rating) return toast("Pick a star rating.", "warn");
        const user = getUser();
        const username = user.user_metadata?.user_name || user.user_metadata?.full_name || user.email?.split("@")[0];
        submit.disabled = true;
        const orig = submit.textContent;
        submit.innerHTML = '<span class="spinner"></span> Posting…';
        try {
            const { error } = await sb.from("reviews").upsert({
                user_id: user.id,
                content: textarea.value.trim(),
                rating,
                username,
                avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            }, { onConflict: "user_id" });
            if (error) throw error;
            toast("Review posted.", "success");
            location.hash = "#/";
            const main = document.getElementById("view");
            renderLanding(main);
        } catch (err) {
            toast(err.message || "Could not post review.", "error");
        } finally {
            submit.disabled = false;
            submit.textContent = orig;
        }
    };

    return card.append(form), card;
}
