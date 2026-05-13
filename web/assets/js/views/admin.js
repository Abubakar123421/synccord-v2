import sb from "../supabase.js";
import { el, escapeHTML, timeAgo, toast } from "../ui.js";
import { getUser } from "../auth.js";

const ADMIN_EMAIL = "abubakarminhas05@gmail.com";

export function isAdmin() {
    const user = getUser();
    return !!(user && user.email === ADMIN_EMAIL);
}

export async function renderAdmin(view) {
    view.innerHTML = "";

    if (!isAdmin()) {
        view.append(el("div", { class: "empty" }, "Access denied."));
        return;
    }

    view.append(el("div", {},
        el("h2", { style: { margin: "0 0 0.25rem" } }, "Admin Panel"),
        el("p", { class: "lede", style: { margin: "0 0 1.5rem" } }, "Manage reviews, forum posts, and users."),
    ));

    const tabs = el("div", { style: { display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" } });
    const sections = {};

    function makeTab(label, key, renderFn) {
        const btn = el("button", { class: "btn btn-ghost" }, label);
        const section = el("div", { style: { display: "none" } });
        sections[key] = { btn, section, renderFn };
        btn.onclick = () => activateTab(key);
        tabs.append(btn);
        view.append(section);
    }

    function activateTab(key) {
        for (const [k, { btn, section }] of Object.entries(sections)) {
            const active = k === key;
            btn.className = active ? "btn btn-primary" : "btn btn-ghost";
            section.style.display = active ? "block" : "none";
        }
        const { section, renderFn } = sections[key];
        section.innerHTML = "";
        renderFn(section);
    }

    makeTab("Reviews", "reviews", renderReviewsTab);
    makeTab("Forum Posts", "posts", renderPostsTab);
    makeTab("Forum Replies", "replies", renderRepliesTab);
    makeTab("Users", "users", renderUsersTab);

    view.prepend(tabs);
    activateTab("reviews");
}

// ─────────────────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────────────────
async function renderReviewsTab(section) {
    section.innerHTML = "<div class='loading-block'><span class='spinner'></span> Loading…</div>";
    const { data, error } = await sb.from("reviews")
        .select("id, username, rating, content, created_at, user_id")
        .order("created_at", { ascending: false });
    if (error) { section.innerHTML = `<div class='empty'>${escapeHTML(error.message)}</div>`; return; }

    const table = buildTable(
        ["User", "Rating", "Content", "Posted", "Action"],
        (data || []).map(r => [
            r.username || "Anonymous",
            "★".repeat(r.rating) + "☆".repeat(5 - r.rating),
            truncate(r.content, 80),
            timeAgo(r.created_at),
            dangerBtn("Delete", () => confirmDelete(
                "Delete this review?",
                () => sb.from("reviews").delete().eq("id", r.id),
                section, () => renderReviewsTab(section)
            )),
        ])
    );
    section.innerHTML = "";
    section.append(el("p", { class: "lede", style: { marginBottom: "1rem" } }, `${data.length} reviews`), table);
}

// ─────────────────────────────────────────────────────────────
// FORUM POSTS
// ─────────────────────────────────────────────────────────────
async function renderPostsTab(section) {
    section.innerHTML = "<div class='loading-block'><span class='spinner'></span> Loading…</div>";
    const { data, error } = await sb.from("forum_posts")
        .select("id, title, user_id, score, reply_count, created_at")
        .order("created_at", { ascending: false });
    if (error) { section.innerHTML = `<div class='empty'>${escapeHTML(error.message)}</div>`; return; }

    const table = buildTable(
        ["Title", "Score", "Replies", "Posted", "Action"],
        (data || []).map(p => [
            el("a", { href: `#/forum/${p.id}`, style: { color: "var(--text)", fontWeight: 600 } }, truncate(p.title, 60)),
            p.score,
            p.reply_count,
            timeAgo(p.created_at),
            dangerBtn("Delete", () => confirmDelete(
                "Delete this post and all its replies?",
                () => sb.from("forum_posts").delete().eq("id", p.id),
                section, () => renderPostsTab(section)
            )),
        ])
    );
    section.innerHTML = "";
    section.append(el("p", { class: "lede", style: { marginBottom: "1rem" } }, `${data.length} posts`), table);
}

// ─────────────────────────────────────────────────────────────
// FORUM REPLIES
// ─────────────────────────────────────────────────────────────
async function renderRepliesTab(section) {
    section.innerHTML = "<div class='loading-block'><span class='spinner'></span> Loading…</div>";
    const { data, error } = await sb.from("forum_replies")
        .select("id, body, user_id, post_id, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
    if (error) { section.innerHTML = `<div class='empty'>${escapeHTML(error.message)}</div>`; return; }

    const table = buildTable(
        ["Body", "Post ID", "Posted", "Action"],
        (data || []).map(r => [
            truncate(r.body, 80),
            el("a", { href: `#/forum/${r.post_id}`, style: { color: "var(--accent)", fontSize: "0.8rem" } }, r.post_id.slice(0, 8) + "…"),
            timeAgo(r.created_at),
            dangerBtn("Delete", () => confirmDelete(
                "Delete this reply?",
                () => sb.from("forum_replies").delete().eq("id", r.id),
                section, () => renderRepliesTab(section)
            )),
        ])
    );
    section.innerHTML = "";
    section.append(el("p", { class: "lede", style: { marginBottom: "1rem" } }, `${data.length} replies (last 200)`), table);
}

// ─────────────────────────────────────────────────────────────
// USERS  (derived from profiles table)
// ─────────────────────────────────────────────────────────────
async function renderUsersTab(section) {
    section.innerHTML = "<div class='loading-block'><span class='spinner'></span> Loading…</div>";
    const { data, error } = await sb.from("profiles")
        .select("id, username, email, provider, created_at")
        .order("created_at", { ascending: false });
    if (error) { section.innerHTML = `<div class='empty'>${escapeHTML(error.message)}</div>`; return; }

    const table = buildTable(
        ["Username", "Email", "Provider", "Joined", "Action"],
        (data || []).map(u => [
            u.username || "—",
            u.email || "—",
            u.provider || "email",
            timeAgo(u.created_at),
            u.email === ADMIN_EMAIL
                ? el("span", { style: { color: "var(--text-muted)", fontSize: "0.8rem" } }, "owner")
                : dangerBtn("Delete all content", () => confirmDelete(
                    `Delete ALL reviews, posts and replies from ${u.username || u.email}? This cannot be undone.`,
                    async () => {
                        await sb.from("reviews").delete().eq("user_id", u.id);
                        await sb.from("forum_posts").delete().eq("user_id", u.id);
                        await sb.from("forum_replies").delete().eq("user_id", u.id);
                        return { error: null };
                    },
                    section, () => renderUsersTab(section)
                )),
        ])
    );
    section.innerHTML = "";
    section.append(el("p", { class: "lede", style: { marginBottom: "1rem" } }, `${data.length} users`), table);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function buildTable(headers, rows) {
    const thead = el("thead", {},
        el("tr", {}, ...headers.map(h => el("th", { style: { textAlign: "left", padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", borderBottom: "1px solid var(--border)" } }, h)))
    );
    const tbody = el("tbody", {});
    if (!rows.length) {
        tbody.append(el("tr", {}, el("td", { colspan: headers.length, style: { padding: "2rem", textAlign: "center", color: "var(--text-muted)" } }, "Nothing here.")));
    }
    for (const cells of rows) {
        const tr = el("tr", {});
        for (const cell of cells) {
            const td = el("td", { style: { padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--border)", fontSize: "0.875rem", color: "var(--text-muted)", verticalAlign: "middle" } });
            td.append(cell instanceof Node ? cell : document.createTextNode(String(cell)));
            tr.append(td);
        }
        tbody.append(tr);
    }
    return el("div", { style: { overflowX: "auto" } },
        el("table", { style: { width: "100%", borderCollapse: "collapse", background: "var(--surface)", borderRadius: "10px", overflow: "hidden" } }, thead, tbody)
    );
}

function dangerBtn(label, onClick) {
    const btn = el("button", { class: "btn btn-danger btn-sm" }, label);
    btn.onclick = onClick;
    return btn;
}

function truncate(str, n) {
    const s = String(str || "");
    return s.length > n ? s.slice(0, n) + "…" : s;
}

async function confirmDelete(message, deleteFn, section, refresh) {
    if (!confirm(message)) return;
    try {
        const { error } = await deleteFn();
        if (error) throw error;
        toast("Deleted.", "info");
        refresh();
    } catch (err) {
        toast(err.message || "Delete failed.", "error");
    }
}
