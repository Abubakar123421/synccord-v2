import sb from "../supabase.js";
import { el, escapeHTML, timeAgo, toast } from "../ui.js";
import { getUser, signOut, renderAuthSlot } from "../auth.js";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export async function renderProfile(view) {
    view.innerHTML = "";
    const user = getUser();
    if (!user) {
        view.innerHTML = "<div class='empty'>Sign in to see your profile.</div>";
        return;
    }

    let profile = null;
    try {
        const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
        profile = data || {
            id: user.id,
            username: user.user_metadata?.user_name || user.email?.split("@")[0],
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
            email: user.email,
            provider: user.app_metadata?.provider || "email",
        };
    } catch (err) {
        console.warn(err);
    }

    const layout = el("div", { class: "grid", style: { gridTemplateColumns: "minmax(0, 1fr) 320px", alignItems: "start" } });

    // Main column: edit form + my reviews
    const main = el("div", {});
    main.append(buildEditCard(profile));
    main.append(await buildMyReviewsCard());
    main.append(await buildMyPostsCard());

    // Side column: avatar / account
    layout.append(main, buildSideCard(profile));

    view.append(layout);
}

function buildSideCard(profile) {
    const card = el("div", { class: "card" });
    card.style.position = "sticky";
    card.style.top = "calc(var(--topbar-h) + 1rem)";

    const avatar = profile.avatar_url
        ? el("img", { src: profile.avatar_url, style: {
            width: "100px", height: "100px", borderRadius: "50%",
            objectFit: "cover", border: "3px solid var(--border-strong)",
            display: "block", margin: "0 auto 1rem",
        } })
        : el("div", {
            style: {
                width: "100px", height: "100px", borderRadius: "50%",
                margin: "0 auto 1rem",
                background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2.4rem", color: "white", fontWeight: 700,
            },
        }, (profile.username || "?").slice(0, 2).toUpperCase());

    const fileInput = el("input", { type: "file", accept: "image/*", style: { display: "none" } });
    const uploadBtn = el("button", { class: "btn btn-ghost btn-sm", style: { width: "100%" } }, "Change avatar");
    uploadBtn.onclick = () => fileInput.click();
    fileInput.onchange = () => {
        const file = fileInput.files[0];
        if (!file) return;
        fileInput.value = "";
        openCropModal(file, async (blob) => {
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<span class="spinner"></span> Uploading…';
            try {
                const url = await uploadAvatar(blob, profile.id);
                await sb.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
                toast("Avatar updated.", "success");
                await renderAuthSlot();
                renderProfile(document.getElementById("view"));
            } catch (err) {
                toast(err.message || "Upload failed.", "error");
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = "Change avatar";
            }
        });
    };

    card.append(
        avatar,
        el("h3", { style: { textAlign: "center", margin: "0 0 0.25rem" } }, profile.username || "—"),
        el("p", { style: { textAlign: "center", color: "var(--text-muted)", margin: "0 0 1rem", fontSize: "0.9rem" } }, profile.email || ""),
        uploadBtn, fileInput,
        el("hr", { class: "divider" }),
        el("div", { style: { fontSize: "0.85rem", color: "var(--text-muted)" } },
            el("div", {}, "Provider: ", el("strong", { style: { color: "var(--text)" } }, profile.provider || "email")),
            profile.discord_username
                ? el("div", { style: { marginTop: "0.25rem" } }, "Discord: ",
                    el("strong", { style: { color: "var(--text)" } }, profile.discord_username))
                : null,
        ),
        el("hr", { class: "divider" }),
        el("button", { class: "btn btn-outline btn-sm", style: { width: "100%" }, onClick: signOut }, "Sign out"),
    );
    return card;
}

function openCropModal(file, onConfirm) {
    const objectUrl = URL.createObjectURL(file);

    const img = el("img", { src: objectUrl, style: { maxWidth: "100%", display: "block" } });
    const cropWrap = el("div", { style: { width: "100%", maxHeight: "400px", overflow: "hidden" } });
    cropWrap.append(img);

    const confirmBtn = el("button", { class: "btn btn-primary" }, "Crop & Upload");
    const cancelBtn  = el("button", { class: "btn btn-ghost" }, "Cancel");

    const overlay = el("div", {
        style: {
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
        },
    });

    const modal = el("div", {
        style: {
            background: "var(--surface)", borderRadius: "12px",
            padding: "1.5rem", width: "min(480px, 94vw)",
            display: "flex", flexDirection: "column", gap: "1rem",
        },
    });
    modal.append(
        el("h3", { style: { margin: 0 } }, "Crop avatar"),
        cropWrap,
        el("div", { style: { display: "flex", gap: "0.75rem", justifyContent: "flex-end" } }, cancelBtn, confirmBtn),
    );
    overlay.append(modal);
    document.body.append(overlay);

    const cropper = new window.Cropper(img, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 1,
        restore: false,
        guides: false,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
    });

    function close() {
        cropper.destroy();
        URL.revokeObjectURL(objectUrl);
        overlay.remove();
    }

    cancelBtn.onclick = close;
    confirmBtn.onclick = () => {
        const canvas = cropper.getCroppedCanvas({ width: 256, height: 256, imageSmoothingQuality: "high" });
        canvas.toBlob((blob) => {
            close();
            onConfirm(blob);
        }, "image/webp", 0.88);
    };
}

function resizeImage(file, maxSize = 256) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            canvas.toBlob((blob) => resolve(blob), "image/webp", 0.88);
        };
        img.src = url;
    });
}

async function uploadAvatar(blob, userId) {
    const path = `${userId}/${Date.now()}.webp`;
    const { error } = await sb.storage.from("avatars").upload(path, blob, { upsert: true, cacheControl: "3600", contentType: "image/webp" });
    if (error) throw error;
    const { data } = sb.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
}

function buildEditCard(profile) {
    const card = el("div", { class: "card" });
    card.append(el("h2", { style: { margin: "0 0 0.5rem" } }, "Account"),
        el("p", { class: "lede" }, "Update how others see you."));

    const usernameInput = el("input", { type: "text", maxlength: 32, required: true });
    usernameInput.value = profile.username || "";
    const bioInput = el("textarea", { rows: 3, maxlength: 280, placeholder: "A short bio (optional)" });
    bioInput.value = profile.bio || "";

    const submit = el("button", { class: "btn btn-primary", type: "submit" }, "Save changes");
    const form = el("form", {});
    form.append(
        el("div", { class: "field" }, el("label", { class: "label" }, "Display name"), usernameInput),
        el("div", { class: "field" }, el("label", { class: "label" }, "Bio"), bioInput),
        el("div", { style: { display: "flex", justifyContent: "flex-end" } }, submit),
    );
    form.onsubmit = async (event) => {
        event.preventDefault();
        submit.disabled = true;
        const orig = submit.textContent;
        submit.innerHTML = '<span class="spinner"></span> Saving…';
        try {
            const { error } = await sb.from("profiles").update({
                username: usernameInput.value.trim(),
                bio: bioInput.value.trim() || null,
            }).eq("id", profile.id);
            if (error) throw error;
            toast("Profile updated.", "success");
            await renderAuthSlot();
        } catch (err) {
            toast(err.message || "Save failed.", "error");
        } finally {
            submit.disabled = false;
            submit.textContent = orig;
        }
    };
    card.append(form);
    return card;
}

async function buildMyReviewsCard() {
    const card = el("div", { class: "card", style: { marginTop: "1.5rem" } });
    card.append(el("h2", { style: { margin: "0 0 0.5rem" } }, "My reviews"));
    const list = el("div", {});
    card.append(list);

    const user = getUser();
    try {
        const { data, error } = await sb.from("reviews")
            .select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) {
            list.append(el("div", { class: "empty" }, "You haven't posted any reviews yet."));
            return card;
        }
        for (const r of data) list.append(reviewItem(r, () => buildMyReviewsCard().then((nc) => card.replaceWith(nc))));
    } catch (err) {
        list.append(el("div", { class: "empty" }, `Could not load reviews: ${escapeHTML(err.message)}`));
    }
    return card;
}

function reviewItem(r, refresh) {
    const stars = "★★★★★".slice(0, r.rating).padEnd(5, "☆");
    const wrap = el("div", { style: { borderTop: "1px solid var(--border)", padding: "0.85rem 0" } });
    const display = el("div", {});
    display.append(
        el("div", { class: "review-stars" }, stars),
        el("p", { style: { color: "var(--text-muted)", margin: "0.25rem 0" } }, r.content),
        el("div", { class: "review-meta" }, timeAgo(r.created_at)),
        el("div", { style: { display: "flex", gap: "0.5rem", marginTop: "0.5rem" } },
            el("button", { class: "btn btn-ghost btn-sm", onClick: () => editReview(r, wrap, refresh) }, "Edit"),
            el("button", { class: "btn btn-danger btn-sm", onClick: () => deleteReview(r.id, refresh) }, "Delete"),
        ),
    );
    wrap.append(display);
    return wrap;
}

function editReview(r, wrap, refresh) {
    wrap.innerHTML = "";
    const ratingInput = el("input", { type: "number", min: 1, max: 5, value: r.rating, style: { width: "100px" } });
    const contentInput = el("textarea", { rows: 3, maxlength: 2000 });
    contentInput.value = r.content || "";
    const saveBtn = el("button", { class: "btn btn-primary btn-sm" }, "Save");
    const cancelBtn = el("button", { class: "btn btn-ghost btn-sm", onClick: () => refresh() }, "Cancel");
    const form = el("form", {}, ratingInput, contentInput,
        el("div", { style: { display: "flex", gap: "0.5rem", marginTop: "0.5rem" } }, saveBtn, cancelBtn));
    form.onsubmit = async (event) => {
        event.preventDefault();
        const { error } = await sb.from("reviews").update({
            rating: Number(ratingInput.value),
            content: contentInput.value.trim(),
        }).eq("id", r.id);
        if (error) return toast(error.message, "error");
        toast("Review updated.", "success");
        refresh();
    };
    wrap.append(form);
}

async function deleteReview(id, refresh) {
    if (!confirm("Delete this review?")) return;
    const { error } = await sb.from("reviews").delete().eq("id", id);
    if (error) return toast(error.message, "error");
    toast("Review deleted.", "info");
    refresh();
}

async function buildMyPostsCard() {
    const card = el("div", { class: "card", style: { marginTop: "1.5rem" } });
    card.append(el("h2", { style: { margin: "0 0 0.5rem" } }, "My forum posts"));
    const list = el("div", {});
    card.append(list);
    const user = getUser();
    try {
        const { data, error } = await sb.from("forum_posts")
            .select("id, title, score, reply_count, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) {
            list.append(el("div", { class: "empty" }, "No forum posts yet."));
            return card;
        }
        for (const p of data) {
            list.append(el("div", { style: { padding: "0.6rem 0", borderTop: "1px solid var(--border)" } },
                el("a", { href: `#/forum/${p.id}`, style: { color: "var(--text)", fontWeight: 600 } }, p.title),
                el("div", { class: "post-meta", style: { marginTop: "0.25rem" } },
                    el("span", {}, `${p.score} points`),
                    el("span", {}, `${p.reply_count} replies`),
                    el("span", {}, timeAgo(p.created_at)),
                ),
            ));
        }
    } catch (err) {
        list.append(el("div", { class: "empty" }, "Could not load posts."));
    }
    return card;
}
