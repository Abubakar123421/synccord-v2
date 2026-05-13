import sb from "./supabase.js";
import { el, openModal, closeModal, toast } from "./ui.js";

let currentSession = null;
const listeners = new Set();

export async function bootstrapAuth() {
    const { data } = await sb.auth.getSession();
    currentSession = data.session ?? null;
    sb.auth.onAuthStateChange((event, session) => {
        currentSession = session;
        listeners.forEach((fn) => fn(session, event));
    });
}

export function getSession() { return currentSession; }
export function getUser() { return currentSession?.user ?? null; }
export function isLoggedIn() { return Boolean(currentSession?.user); }
export function onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function signOut() {
    await sb.auth.signOut();
    toast("Signed out.", "info");
    location.hash = "#/";
}

export async function signInWithProvider(provider) {
    const redirectTo = `${location.origin}${location.pathname}`;
    const { error } = await sb.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo,
            scopes: provider === "discord" ? "identify email" : undefined,
        },
    });
    if (error) toast(error.message, "error");
}

export async function signInWithEmail(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
        toast(error.message, "error");
        return false;
    }
    toast("Welcome back.", "success");
    return true;
}

export async function signUpWithEmail(email, password, username) {
    const { error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { user_name: username, full_name: username } },
    });
    if (error) {
        toast(error.message, "error");
        return false;
    }
    toast("Account created — check your email if confirmation is enabled.", "success");
    return true;
}

const GoogleLogo = () => `
<svg class="logo" viewBox="0 0 18 18" aria-hidden="true">
  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.13 4.13 0 0 1-1.79 2.71v2.26h2.9c1.69-1.56 2.69-3.86 2.69-6.61z"/>
  <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"/>
  <path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z"/>
  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
</svg>`;

const DiscordLogo = () => `
<svg class="logo" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="#5865F2" d="M20.32 4.78A19.79 19.79 0 0 0 16.5 3.6l-.18.36a17.7 17.7 0 0 0-8.65 0l-.2-.36c-1.36.24-2.7.66-3.85 1.18A20.4 20.4 0 0 0 .76 17.4 19.95 19.95 0 0 0 6.78 20.4l.7-1c-1.05-.4-2.05-.93-2.96-1.55.25-.18.5-.37.73-.56a14.07 14.07 0 0 0 13.5 0c.24.2.49.39.74.57-.92.62-1.93 1.16-2.98 1.55l.7 1c2.18-.7 4.27-1.78 6.05-3a20.32 20.32 0 0 0-3.43-12.62zM8.05 14.85c-1.18 0-2.16-1.07-2.16-2.4 0-1.32.96-2.4 2.16-2.4 1.21 0 2.18 1.08 2.16 2.4 0 1.33-.96 2.4-2.16 2.4zm7.9 0c-1.19 0-2.16-1.07-2.16-2.4 0-1.32.96-2.4 2.16-2.4 1.21 0 2.18 1.08 2.16 2.4 0 1.33-.95 2.4-2.16 2.4z"/>
</svg>`;

const GithubLogo = () => `<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>`;


export function openLoginModal({ mode = "signin" } = {}) {
    openModal((modal, close) => {
        const state = { mode }; // 'signin' | 'signup'

        function render() {
            modal.innerHTML = "";
            modal.append(el("h2", {}, state.mode === "signup" ? "Create your SyncCord account" : "Sign in to SyncCord"));
            modal.append(el("p", { class: "help", style: { marginBottom: "1.25rem" } },
                state.mode === "signup"
                    ? "Free forever. No credit card."
                    : "Use email, Google, or Discord."));

            const oauth = el("div", { class: "oauth-row" });
            const googleBtn = el("button", { class: "oauth-btn", type: "button" });
            googleBtn.innerHTML = GoogleLogo() + "<span>Continue with Google</span>";
            googleBtn.onclick = () => signInWithProvider("google");

            const discordBtn = el("button", { class: "oauth-btn", type: "button" });
            discordBtn.innerHTML = DiscordLogo() + "<span>Continue with Discord</span>";
            discordBtn.onclick = () => signInWithProvider("discord");

            const githubBtn = el("button", { class: "oauth-btn", type: "button" });
            githubBtn.innerHTML = GithubLogo() + "<span>Continue with GitHub</span>";
            githubBtn.onclick = () => signInWithProvider("github");

            oauth.append(googleBtn, discordBtn, githubBtn);
            modal.append(oauth);

            modal.append(el("div", { class: "divider-text" }, "or with email"));

            const form = el("form", { class: "auth-form" });
            const emailField = el("input", {
                type: "email", required: true, placeholder: "you@example.com", autocomplete: "email",
            });
            const passField = el("input", {
                type: "password", required: true, placeholder: "Password (8+ characters)",
                minlength: 8, autocomplete: state.mode === "signup" ? "new-password" : "current-password",
            });

            form.append(
                el("div", { class: "field" }, el("label", { class: "label" }, "Email"), emailField),
            );

            if (state.mode === "signup") {
                const userField = el("input", {
                    type: "text", required: true, placeholder: "Display name", maxlength: 32,
                });
                form.append(el("div", { class: "field" },
                    el("label", { class: "label" }, "Display name"), userField));
                form._userField = userField;
            }
            form.append(el("div", { class: "field" }, el("label", { class: "label" }, "Password"), passField));

            const submit = el("button", {
                class: "btn btn-primary", type: "submit",
                style: { width: "100%", marginTop: "0.5rem" },
            }, state.mode === "signup" ? "Create account" : "Sign in");
            form.append(submit);

            form.onsubmit = async (event) => {
                event.preventDefault();
                submit.disabled = true;
                const orig = submit.textContent;
                submit.innerHTML = '<span class="spinner"></span> Working…';
                try {
                    let success;
                    if (state.mode === "signup") {
                        success = await signUpWithEmail(emailField.value, passField.value, form._userField.value);
                    } else {
                        success = await signInWithEmail(emailField.value, passField.value);
                    }
                    if (success) close();
                } finally {
                    submit.disabled = false;
                    submit.textContent = orig;
                }
            };

            modal.append(form);

            const switchLink = el("p", {
                class: "help", style: { textAlign: "center", marginTop: "1rem" },
            });
            const switchBtn = el("a", { href: "#", style: { color: "var(--accent-2)" } },
                state.mode === "signup" ? "Sign in instead" : "Create one");
            switchBtn.onclick = (event) => {
                event.preventDefault();
                state.mode = state.mode === "signup" ? "signin" : "signup";
                render();
            };
            switchLink.append(
                state.mode === "signup" ? "Have an account? " : "Don't have an account? ",
                switchBtn,
            );
            modal.append(switchLink);
        }
        render();
    });
}

export async function renderAuthSlot() {
    const slot = document.getElementById("auth-slot");
    if (!slot) return;
    slot.innerHTML = "";
    if (isLoggedIn()) {
        const user = getUser();
        let name = user.user_metadata?.user_name
            || user.user_metadata?.full_name
            || user.email?.split("@")[0]
            || "Account";
        const { data: profile } = await sb.from("profiles").select("username, avatar_url").eq("id", user.id).maybeSingle();
        if (profile?.username) name = profile.username;

        const avatarEl = profile?.avatar_url
            ? el("img", { src: profile.avatar_url, alt: "", style: { width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover", verticalAlign: "middle", marginRight: "6px" } })
            : el("span", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent-2))", color: "white", fontWeight: 700, fontSize: "0.75rem", marginRight: "6px" } }, name.slice(0, 2).toUpperCase());

        const profileBtn = el("a", { class: "btn btn-ghost btn-sm", href: "#/profile", style: { display: "inline-flex", alignItems: "center" } }, avatarEl, name);

        const adminBtn = user.email === "abubakarminhas05@gmail.com"
            ? el("a", { class: "btn btn-outline btn-sm", href: "#/admin", style: { color: "var(--warn)" } }, "Admin")
            : null;

        slot.append(
            profileBtn,
            ...(adminBtn ? [adminBtn] : []),
            el("button", { class: "btn btn-outline btn-sm", onClick: signOut }, "Sign out"),
        );
    } else {
        slot.append(
            el("button", {
                class: "btn btn-primary btn-sm",
                onClick: () => openLoginModal({ mode: "signin" }),
            }, "Sign in"),
        );
    }
}

export function requireAuth() {
    if (!isLoggedIn()) {
        toast("Please sign in to access this page.", "warn");
        openLoginModal({ mode: "signin" });
        return false;
    }
    return true;
}
