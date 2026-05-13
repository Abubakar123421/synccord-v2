import sb from "../supabase.js";
import { el, escapeHTML, timeAgo, toast, renderMarkdown, debounce } from "../ui.js";
import { getUser } from "../auth.js";
import { FORUM_TAGS } from "../config.js";

const PAGE_SIZE = 20;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

// ─────────────────────────────────────────────────────────────────────────────
// Forum list view
// ─────────────────────────────────────────────────────────────────────────────

export async function renderForumList(view) {
    view.innerHTML = "";
    const state = { sort: "new", tag: null, search: "" };

    view.append(el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" } },
        el("div", {},
            el("h2", { style: { margin: "0 0 0.25rem" } }, "Community forum"),
            el("p", { class: "lede", style: { margin: 0 } }, "Share errors, setups, builds. Help and get help."),
        ),
        el("a", { class: "btn btn-primary", href: "#/forum/new" }, "+ New post"),
    ));

    const toolbar = el("div", { class: "forum-toolbar", style: { marginTop: "1.5rem" } });
    const searchInput = el("input", { type: "search", placeholder: "Search posts…" });
    const sortSelect = el("select", { style: { width: "auto" } },
        el("option", { value: "new" }, "Newest"),
        el("option", { value: "top" }, "Top voted"),
        el("option", { value: "active" }, "Most active"),
    );

    toolbar.append(searchInput, sortSelect);

    const tagBar = el("div", { style: { display: "flex", gap: "0.4rem", flexWrap: "wrap" } });
    const allTagsBtn = el("button", { class: "tag", type: "button" }, "all");
    
    tagBar.append(allTagsBtn);
    for (const t of FORUM_TAGS) {
        const tagBtn = el("button", { class: "tag", type: "button" }, t);
        
        tagBtn.onclick = () => { state.tag = t; updateActiveTag(); reload(); };
        tagBar.append(tagBtn);
    }
    allTagsBtn.onclick = () => { state.tag = null; updateActiveTag(); reload(); };
    toolbar.append(tagBar);

    function updateActiveTag() {
        Array.from(tagBar.children).forEach((btn) => {
            const active = (btn.textContent === "all" && !state.tag) || btn.textContent === state.tag;
            btn.style.background = active ? "rgba(124,92,255,0.35)" : "";
            btn.style.borderColor = active ? "var(--accent)" : "";
        });
    }
    updateActiveTag();

    view.append(toolbar);

    const listEl = el("div", { class: "forum-list", style: { marginTop: "1rem" } });
    view.append(listEl);

    sortSelect.onchange = () => { state.sort = sortSelect.value; reload(); };
    searchInput.oninput = debounce(() => { state.search = searchInput.value.trim(); reload(); }, 300);

    async function reload() {
        listEl.innerHTML = "<div class='loading-block'><span class='spinner'></span> Loading posts…</div>";
        try {
            let query = sb.from("forum_posts").select("*").limit(PAGE_SIZE);
            if (state.sort === "top") query = query.order("score", { ascending: false });
            else if (state.sort === "active") query = query.order("reply_count", { ascending: false });
            else query = query.order("created_at", { ascending: false });
            if (state.tag) query = query.contains("tags", [state.tag]);
            if (state.search) query = query.ilike("title", `%${state.search}%`);
            const { data, error } = await query;
            if (error) throw error;

            listEl.innerHTML = "";
            if (!data || data.length === 0) {
                listEl.append(el("div", { class: "empty" },
                    "No posts yet. Be the first — start a thread."));
                return;
            }
            const userIds = [...new Set(data.map((p) => p.user_id))];
            const profiles = await fetchProfiles(userIds);
            const userVotes = await fetchUserVotes(data.map((p) => p.id));
            for (const post of data) {
                listEl.append(postRow(post, profiles[post.user_id], userVotes[post.id]));
            }
        } catch (err) {
            console.error(err);
            listEl.innerHTML = `<div class='empty'>Could not load posts: ${escapeHTML(err.message || err)}</div>`;
        }
    }

    reload();
}

function postRow(post, profile, userVote) {
    const tags = (post.tags || []).map((t) => el("span", { class: "tag" }, t));
    const author = profile?.username || "Anonymous";

    const upBtn = el("button", { class: userVote === 1 ? "voted-up" : "", "aria-label": "Upvote" }, "▲");
    const downBtn = el("button", { class: userVote === -1 ? "voted-down" : "", "aria-label": "Downvote" }, "▼");
    const scoreEl = el("span", { class: "score" }, String(post.score ?? 0));

    upBtn.onclick = (event) => { event.preventDefault(); vote(post.id, "post", 1, scoreEl, upBtn, downBtn); };
    downBtn.onclick = (event) => { event.preventDefault(); vote(post.id, "post", -1, scoreEl, upBtn, downBtn); };

    const row = el("div", { class: "card post-row", style: { cursor: "pointer" } },
        el("div", { class: "post-votes" }, upBtn, scoreEl, downBtn),
        el("div", { class: "post-body" },
            el("h3", {}, post.title),
            el("div", { class: "post-meta" },
                el("span", {}, `by ${author}`),
                el("span", {}, timeAgo(post.created_at)),
                el("span", {}, `${post.reply_count || 0} replies`),
                ...tags,
            ),
        ),
    );
    row.onclick = (event) => {
        if (event.target === upBtn || event.target === downBtn || upBtn.contains(event.target) || downBtn.contains(event.target)) return;
        location.hash = `#/forum/${post.id}`;
    };
    return row;
}

async function fetchProfiles(ids) {
    if (!ids.length) return {};
    const { data } = await sb.from("profiles").select("id, username, avatar_url").in("id", ids);
    return Object.fromEntries((data || []).map((p) => [p.id, p]));
}

async function fetchUserVotes(targetIds) {
    const user = getUser();
    if (!user || !targetIds.length) return {};
    const { data } = await sb.from("forum_votes").select("target_id, value")
        .eq("user_id", user.id).in("target_id", targetIds);
    return Object.fromEntries((data || []).map((v) => [v.target_id, v.value]));
}

async function vote(targetId, targetType, value, scoreEl, upBtn, downBtn) {
    const user = getUser();
    if (!user) return toast("Sign in to vote.", "warn");
    try {
        // Check current vote
        const { data: existing } = await sb.from("forum_votes")
            .select("value").eq("user_id", user.id).eq("target_id", targetId).maybeSingle();

        if (existing && existing.value === value) {
            // toggle off
            await sb.from("forum_votes").delete().eq("user_id", user.id).eq("target_id", targetId);
            upBtn.classList.remove("voted-up");
            downBtn.classList.remove("voted-down");
        } else if (existing) {
            await sb.from("forum_votes").update({ value }).eq("user_id", user.id).eq("target_id", targetId);
            upBtn.classList.toggle("voted-up", value === 1);
            downBtn.classList.toggle("voted-down", value === -1);
        } else {
            await sb.from("forum_votes").insert({ user_id: user.id, target_id: targetId, target_type: targetType, value });
            upBtn.classList.toggle("voted-up", value === 1);
            downBtn.classList.toggle("voted-down", value === -1);
        }

        // Refresh score from server (trigger keeps it accurate)
        const table = targetType === "post" ? "forum_posts" : "forum_replies";
        const { data: refreshed } = await sb.from(table).select("score").eq("id", targetId).maybeSingle();
        if (refreshed) scoreEl.textContent = String(refreshed.score);
    } catch (err) {
        toast(err.message || "Could not vote.", "error");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// New post view
// ─────────────────────────────────────────────────────────────────────────────

export async function renderForumCreate(view) {
    view.innerHTML = "";
    const card = el("div", { class: "card" });
    card.append(el("h2", {}, "New forum post"));

    const titleInput = el("input", { type: "text", maxlength: 200, required: true, placeholder: "What's this post about?" });
    const bodyInput = el("textarea", { rows: 8, required: true, maxlength: 20000, placeholder: "Markdown supported. Paste error messages, screenshots, anything that helps." });

    const tagSelector = el("div", { style: { display: "flex", gap: "0.4rem", flexWrap: "wrap" } });
    const selectedTags = new Set();
    for (const t of FORUM_TAGS) {
        const tagBtn = el("button", { class: "tag", type: "button" }, t);
        
        tagBtn.onclick = () => {
            if (selectedTags.has(t)) {
                selectedTags.delete(t);
                tagBtn.style.background = "";
                tagBtn.style.borderColor = "";
            } else {
                selectedTags.add(t);
                tagBtn.style.background = "rgba(124,92,255,0.35)";
                tagBtn.style.borderColor = "var(--accent)";
            }
        };
        tagSelector.append(tagBtn);
    }

    const fileInput = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif" });
    const previewArea = el("div");

    let pendingFile = null;
    fileInput.onchange = () => {
        const file = fileInput.files[0];
        previewArea.innerHTML = "";
        if (!file) { pendingFile = null; return; }
        if (file.size > MAX_IMAGE_BYTES) {
            toast("Image too large (max 4 MB).", "warn");
            fileInput.value = "";
            return;
        }
        pendingFile = file;
        const url = URL.createObjectURL(file);
        previewArea.append(el("img", {
            src: url, style: { maxHeight: "180px", borderRadius: "8px", marginTop: "0.5rem" },
        }));
    };

    const submit = el("button", { class: "btn btn-primary", type: "submit" }, "Publish post");

    const form = el("form", {});
    form.append(
        el("div", { class: "field" }, el("label", { class: "label" }, "Title"), titleInput),
        el("div", { class: "field" }, el("label", { class: "label" }, "Body (markdown)"), bodyInput),
        el("div", { class: "field" }, el("label", { class: "label" }, "Tags (pick any that apply)"), tagSelector),
        el("div", { class: "field" }, el("label", { class: "label" }, "Image (optional)"), fileInput, previewArea),
        el("div", { style: { display: "flex", gap: "0.75rem", justifyContent: "flex-end" } },
            el("a", { class: "btn btn-ghost", href: "#/forum" }, "Cancel"),
            submit,
        ),
    );
    card.append(form);
    view.append(card);

    form.onsubmit = async (event) => {
        event.preventDefault();
        const user = getUser();
        if (!user) return toast("Sign in first.", "warn");
        submit.disabled = true;
        const orig = submit.textContent;
        submit.innerHTML = '<span class="spinner"></span> Posting…';
        try {
            let imageUrl = null;
            if (pendingFile) imageUrl = await uploadImage(pendingFile, user.id);
            const { data, error } = await sb.from("forum_posts").insert({
                user_id: user.id,
                title: titleInput.value.trim(),
                body: bodyInput.value.trim(),
                image_url: imageUrl,
                tags: [...selectedTags],
            }).select("id").single();
            if (error) throw error;
            toast("Post published.", "success");
            location.hash = `#/forum/${data.id}`;
        } catch (err) {
            toast(err.message || "Could not post.", "error");
        } finally {
            submit.disabled = false;
            submit.textContent = orig;
        }
    };
}

async function uploadImage(file, userId) {
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from("forum-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
    });
    if (error) throw error;
    const { data } = sb.storage.from("forum-images").getPublicUrl(path);
    return data.publicUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single post view
// ─────────────────────────────────────────────────────────────────────────────

export async function renderForumPost(view, params) {
    const postId = params.id;

    let post, profile, replies = [], userVotes = {};
    try {
        const { data: postData, error: postError } = await sb
            .from("forum_posts").select("*").eq("id", postId).maybeSingle();
        if (postError) throw postError;
        if (!postData) {
            view.innerHTML = "<div class='empty'>Post not found.</div>";
            return;
        }
        post = postData;

        const { data: profData } = await sb.from("profiles")
            .select("id, username, avatar_url").eq("id", post.user_id).maybeSingle();
        profile = profData;

        const { data: replyData } = await sb.from("forum_replies")
            .select("*").eq("post_id", postId).order("created_at");
        replies = replyData || [];

        const targetIds = [post.id, ...replies.map((r) => r.id)];
        userVotes = await fetchUserVotes(targetIds);
    } catch (err) {
        view.innerHTML = `<div class='empty'>Failed to load: ${escapeHTML(err.message || err)}</div>`;
        return;
    }

    view.innerHTML = "";

    view.append(el("a", { href: "#/forum", class: "btn btn-ghost btn-sm" }, "← Back to forum"));

    const card = el("div", { class: "card post-detail", style: { marginTop: "1rem" } });
    const tags = (post.tags || []).map((t) => el("span", { class: "tag" }, t));

    const upBtn = el("button", { class: userVotes[post.id] === 1 ? "voted-up" : "", "aria-label": "Upvote" }, "▲");
    const downBtn = el("button", { class: userVotes[post.id] === -1 ? "voted-down" : "", "aria-label": "Downvote" }, "▼");
    const scoreEl = el("span", { class: "score" }, String(post.score ?? 0));
    upBtn.onclick = () => vote(post.id, "post", 1, scoreEl, upBtn, downBtn);
    downBtn.onclick = () => vote(post.id, "post", -1, scoreEl, upBtn, downBtn);

    card.append(
        el("div", { style: { display: "flex", gap: "1rem", alignItems: "flex-start" } },
            el("div", { class: "post-votes" }, upBtn, scoreEl, downBtn),
            el("div", { style: { flex: 1 } },
                el("h2", { style: { margin: "0 0 0.5rem" } }, post.title),
                el("div", { class: "post-meta" },
                    el("span", {}, `by ${profile?.username || "Anonymous"}`),
                    el("span", {}, timeAgo(post.created_at)),
                    ...tags,
                ),
            ),
        ),
        el("div", { class: "markdown", html: renderMarkdown(post.body) }),
    );
    if (post.image_url) {
        card.append(el("img", { src: post.image_url, style: { maxWidth: "100%", borderRadius: "10px", marginTop: "0.5rem" } }));
    }

    // Owner controls
    const me = getUser();
    if (me && me.id === post.user_id) {
        const deleteBtn = el("button", { class: "btn btn-danger btn-sm" }, "Delete post");
        deleteBtn.onclick = async () => {
            if (!confirm("Delete this post and all replies?")) return;
            const { error } = await sb.from("forum_posts").delete().eq("id", post.id);
            if (error) return toast(error.message, "error");
            toast("Post deleted.", "info");
            location.hash = "#/forum";
        };
        card.append(el("div", { style: { marginTop: "1rem" } }, deleteBtn));
    }

    view.append(card);

    // Replies
    const profileIds = [...new Set(replies.map((r) => r.user_id))];
    const profiles = await fetchProfiles(profileIds);

    const repliesSection = el("div", { style: { marginTop: "2rem" } });
    repliesSection.append(el("h3", {}, `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`));

    const tree = buildReplyTree(replies);
    if (tree.length === 0) {
        repliesSection.append(el("div", { class: "empty" }, "No replies yet. Be the first to chime in."));
    } else {
        for (const node of tree) repliesSection.append(renderReplyNode(node, profiles, userVotes, post.id));
    }
    view.append(repliesSection);

    // Reply form
    if (me) {
        view.append(buildReplyForm(post.id, null, "Add a reply"));
    } else {
        view.append(el("div", { class: "empty", style: { marginTop: "1rem" } }, "Sign in to reply."));
    }
}

function buildReplyTree(replies) {
    const byParent = new Map();
    for (const r of replies) {
        const parent = r.parent_reply_id || null;
        if (!byParent.has(parent)) byParent.set(parent, []);
        byParent.get(parent).push({ ...r, children: [] });
    }
    function attach(node) {
        const children = byParent.get(node.id) || [];
        node.children = children;
        for (const c of children) attach(c);
        return node;
    }
    return (byParent.get(null) || []).map(attach);
}

function renderReplyNode(node, profiles, userVotes, postId, depth = 0) {
    const author = profiles[node.user_id]?.username || "Anonymous";
    const upBtn = el("button", { class: userVotes[node.id] === 1 ? "voted-up" : "" }, "▲");
    const downBtn = el("button", { class: userVotes[node.id] === -1 ? "voted-down" : "" }, "▼");
    const scoreEl = el("span", { class: "score" }, String(node.score ?? 0));
    upBtn.onclick = () => vote(node.id, "reply", 1, scoreEl, upBtn, downBtn);
    downBtn.onclick = () => vote(node.id, "reply", -1, scoreEl, upBtn, downBtn);

    const replyToggle = el("button", { class: "btn btn-ghost btn-sm" }, "Reply");
    let openForm = null;
    replyToggle.onclick = () => {
        if (openForm) { openForm.remove(); openForm = null; return; }
        openForm = buildReplyForm(postId, node.id, "Reply to this");
        wrapper.append(openForm);
    };

    const wrapper = el("div", { class: depth === 0 ? "card reply" : "reply reply-nested" },
        el("div", { style: { display: "flex", gap: "1rem", alignItems: "flex-start" } },
            el("div", { class: "post-votes" }, upBtn, scoreEl, downBtn),
            el("div", { style: { flex: 1 } },
                el("div", { class: "post-meta", style: { marginBottom: "0.5rem" } },
                    el("strong", { style: { color: "var(--text)" } }, author),
                    el("span", {}, timeAgo(node.created_at))),
                el("div", { class: "markdown", html: renderMarkdown(node.body) }),
                node.image_url
                    ? el("img", { src: node.image_url, style: { maxWidth: "300px", borderRadius: "8px", marginTop: "0.5rem" } })
                    : null,
                el("div", { style: { marginTop: "0.5rem" } }, replyToggle),
            ),
        ),
    );

    for (const child of node.children) {
        wrapper.append(renderReplyNode(child, profiles, userVotes, postId, depth + 1));
    }
    return wrapper;
}

function buildReplyForm(postId, parentId, label) {
    const wrap = el("div", { class: "card", style: { marginTop: "1rem" } });
    wrap.append(el("h4", { style: { margin: "0 0 0.5rem" } }, label));
    const textarea = el("textarea", { rows: 4, placeholder: "Markdown supported.", maxlength: 10000, required: true });
    const fileInput = el("input", { type: "file", accept: "image/*" });
    const submit = el("button", { class: "btn btn-primary btn-sm" }, "Post reply");
    let pendingFile = null;
    fileInput.onchange = () => {
        const f = fileInput.files[0];
        if (f && f.size > MAX_IMAGE_BYTES) { toast("Max 4 MB.", "warn"); fileInput.value = ""; return; }
        pendingFile = f || null;
    };
    const form = el("form", {});
    form.append(
        textarea,
        el("div", { style: { display: "flex", gap: "0.5rem", marginTop: "0.5rem", alignItems: "center", flexWrap: "wrap" } },
            fileInput, el("div", { style: { flex: 1 } }), submit,
        ),
    );
    form.onsubmit = async (event) => {
        event.preventDefault();
        const user = getUser();
        if (!user) return toast("Sign in.", "warn");
        submit.disabled = true;
        try {
            let imageUrl = null;
            if (pendingFile) imageUrl = await uploadImage(pendingFile, user.id);
            const { error } = await sb.from("forum_replies").insert({
                post_id: postId,
                parent_reply_id: parentId,
                user_id: user.id,
                body: textarea.value.trim(),
                image_url: imageUrl,
            });
            if (error) throw error;
            toast("Reply posted.", "success");
            // Reload current post view
            renderForumPost(document.getElementById("view"), { id: postId });
        } catch (err) {
            toast(err.message || "Could not reply.", "error");
        } finally {
            submit.disabled = false;
        }
    };
    wrap.append(form);
    return wrap;
}
