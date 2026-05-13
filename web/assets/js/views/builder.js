import { el, toast } from "../ui.js";

const STORAGE_KEY = "synccord:builder:draft";
const SESSION_KEY = "synccord:builder:session";

const PLACEHOLDER_FIELDS = {
    char_name:        { key: "CHAR_NAME",        quoted: true,  label: "Character name", placeholder: "Aurora", required: true, max: 32 },
    discord_token:    { key: "DISCORD_TOKEN",    quoted: true,  label: "Discord bot token", placeholder: "MTQ5...", required: true, sensitive: true,
                        help: "From the Discord Developer Portal → your application → Bot → Reset Token." },
    groq_api_key:     { key: "GROQ_API_KEY",     quoted: true,  label: "Groq API key", placeholder: "gsk_...", required: true, sensitive: true,
                        help: "Free at console.groq.com — used for the AI replies." },
    char_age:         { key: "CHAR_AGE",         quoted: true,  label: "Age", placeholder: "23 or Unknown", required: true, max: 32 },
    char_origin:      { key: "CHAR_ORIGIN",      quoted: true,  label: "Origin / backstory", textarea: true, required: true, max: 600 },
    char_appearance:  { key: "CHAR_APPEARANCE",  quoted: true,  label: "Appearance", textarea: true, required: true, max: 400 },
    char_personality: { key: "CHAR_PERSONALITY", quoted: true,  label: "Personality", textarea: true, required: true, max: 600 },
    char_style:       { key: "CHAR_STYLE",       quoted: true,  label: "Speaking style", textarea: true, required: true, max: 400 },
    char_likes:       { key: "CHAR_LIKES",       quoted: true,  label: "Likes", textarea: true, required: true, max: 300 },
    char_dislikes:    { key: "CHAR_DISLIKES",    quoted: true,  label: "Dislikes", textarea: true, required: true, max: 300 },
    welcome_message:  { key: "WELCOME_MESSAGE",  quoted: true,  label: "Default welcome message", textarea: true, required: false, max: 300,
                        placeholder: "Hey there, welcome to the server!" },
    nsfw_default:     { key: "NSFW_DEFAULT",     quoted: false, label: "Allow NSFW by default?", boolean: true, required: false },
};

const FIELD_ORDER = [
    "char_name", "char_age",
    "char_origin", "char_appearance",
    "char_personality", "char_style",
    "char_likes", "char_dislikes",
    "welcome_message", "nsfw_default",
    "discord_token", "groq_api_key",
];

const PRESETS = {
    aurora: {
        char_name: "Aurora",
        char_age: "23",
        char_origin: "An off-grid AI researcher who turned her late-night curiosity into a Discord companion. Reads everything, remembers most of it.",
        char_appearance: "Soft features, silver hair tipped with violet, glasses she adjusts when thinking. Wears oversized hoodies with rolled-up sleeves.",
        char_personality: "Warm, curious, gently sarcastic. Treats every question like a puzzle worth solving. Encouraging without being saccharine.",
        char_style: "Casual but precise. Short sentences. Light emoji use (✨, 🙂). Asks one good follow-up question instead of dumping info.",
        char_likes: "Late-night coding sessions, obscure documentation, pour-over coffee, helping people figure things out.",
        char_dislikes: "Vague questions, buzzword soup, anyone being mean for no reason.",
        welcome_message: "Hey, welcome in! Pull up a chair, the kettle's already on. ✨",
    },
    kamii: {
        char_name: "Kamii",
        char_age: "Unknown",
        char_origin: "A battle-hardened military operative who also works as a charismatic VTuber, using entertainment as cover for covert missions.",
        char_appearance: "Sharp-looking, stylish, polished VTuber persona, neat military details, confident presence that mixes cute charm with tactical discipline.",
        char_personality: "Witty, upbeat, full of good humor. Playful and entertaining, but disciplined and serious when duty calls.",
        char_style: "Casual, confident, entertaining. Simple words, light teasing, smooth humor with a cool military edge. Sparing emoji like 🙂 ✨.",
        char_likes: "Making people laugh, streaming, loyal teammates, clean strategy, discipline.",
        char_dislikes: "Boring routines, betrayal, weak teamwork, losing focus.",
        welcome_message: "Oh? A new face spotted. I was getting a bit bored… stick around for a while 🙂",
    },
    librarian: {
        char_name: "Marrow",
        char_age: "Ageless",
        char_origin: "Caretaker of an infinite library hidden between worlds. Knows every book that's ever existed, even the unwritten ones.",
        char_appearance: "Tall, lean, perpetually dust-flecked. Half-moon spectacles, deep emerald coat with too many pockets, fingertips ink-stained.",
        char_personality: "Patient, dry-humored, faintly mysterious. Speaks like someone who has all the time in the world and prefers it that way.",
        char_style: "Measured cadence. Occasional archaic turn of phrase. Never uses emoji. Loves a good metaphor.",
        char_likes: "Marginalia, quiet rooms, tea brewed strong, well-asked questions.",
        char_dislikes: "Folded page corners, hurry, certainty without curiosity.",
        welcome_message: "A new visitor — please, come in. The shelves have been waiting.",
    },
};

export async function renderBuilder(view) {
    view.innerHTML = "";

    const draft = loadDraft();
    const session = loadSessionSecrets();
    const state = { values: { ...defaultValues(), ...draft, ...session } };

    const grid = el("div", { class: "builder-grid" });

    const formCard = el("div", { class: "card" });
    formCard.append(el("h2", { style: { margin: "0 0 0.25rem" } }, "Build your bot"),
        el("p", { class: "lede" },
            "Fill in the personality, paste your tokens, hit download. Your keys never leave the browser."));

    formCard.append(buildPresetRow(state, () => render()));

    const fields = el("div", {});
    formCard.append(fields);

    const actions = el("div", { style: { display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.5rem" } });
    const downloadBtn = el("button", { class: "btn btn-primary btn-lg", type: "button" }, "Download bot package");
    const clearBtn = el("button", { class: "btn btn-ghost", type: "button" }, "Clear draft");
    actions.append(downloadBtn, clearBtn);
    formCard.append(actions);

    const previewCard = el("div", { class: "card preview-card" });

    grid.append(formCard, previewCard);
    view.append(grid);

    function render() {
        fields.innerHTML = "";
        for (const fieldKey of FIELD_ORDER) {
            fields.append(buildField(fieldKey, state, () => {
                renderPreview();
                saveDraft(state.values);
            }));
        }
        renderPreview();
    }

    function renderPreview() {
        previewCard.innerHTML = "";
        previewCard.append(buildPreview(state.values));
    }

    downloadBtn.onclick = async () => {
        if (!validate(state.values)) return;
        downloadBtn.disabled = true;
        const orig = downloadBtn.textContent;
        downloadBtn.innerHTML = '<span class="spinner"></span> Building package…';
        try {
            await downloadPackage(state.values);
            toast("Download started. Check your downloads folder.", "success");
        } catch (err) {
            console.error(err);
            toast(`Download failed: ${err.message || err}`, "error");
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.textContent = orig;
        }
    };

    clearBtn.onclick = () => {
        if (!confirm("Clear all builder fields?")) return;
        state.values = defaultValues();
        saveDraft(state.values);
        render();
    };

    render();
}

function defaultValues() {
    return {
        char_name: "", char_age: "", char_origin: "", char_appearance: "",
        char_personality: "", char_style: "", char_likes: "", char_dislikes: "",
        welcome_message: "Hey there, welcome to the server!",
        nsfw_default: false,
        discord_token: "", groq_api_key: "",
    };
}

function loadDraft() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        delete parsed.discord_token;
        delete parsed.groq_api_key;
        return parsed;
    } catch { return {}; }
}

function saveDraft(values) {
    const safe = { ...values };
    delete safe.discord_token;
    delete safe.groq_api_key;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(safe)); } catch { /* quota */ }
}

function loadSessionSecrets() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function saveSessionSecrets(values) {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            discord_token: values.discord_token || "",
            groq_api_key:  values.groq_api_key  || "",
        }));
    } catch { /* quota */ }
}

function buildPresetRow(state, onPick) {
    const row = el("div", { style: {
        display: "flex", flexWrap: "wrap", gap: "0.5rem",
        marginBottom: "1.5rem", paddingBottom: "1.5rem",
        borderBottom: "1px solid var(--border)",
    } });
    row.append(el("span", { class: "label", style: { width: "100%", margin: 0 } }, "Quick presets"));
    for (const [id, preset] of Object.entries(PRESETS)) {
        row.append(el("button", {
            class: "btn btn-ghost btn-sm", type: "button",
            onClick: () => {
                Object.assign(state.values, preset);
                onPick();
                toast(`Loaded "${preset.char_name}" preset.`, "info");
            },
        }, preset.char_name));
    }
    return row;
}

function buildField(fieldKey, state, onChange) {
    const field = PLACEHOLDER_FIELDS[fieldKey];
    const wrap = el("div", { class: "field" });
    if (!field.boolean) {
        wrap.append(el("label", { class: "label", for: `f-${fieldKey}` }, field.label));
    }

    let input;
    if (field.boolean) {
        input = el("label", { class: "toggle-row", for: `f-${fieldKey}` });
        const checkbox = el("input", { type: "checkbox", id: `f-${fieldKey}`, class: "toggle-input" });
        if (state.values[fieldKey]) checkbox.checked = true;
        checkbox.onchange = () => { state.values[fieldKey] = checkbox.checked; onChange(); };
        const track = el("span", { class: "toggle-track" }, el("span", { class: "toggle-thumb" }));
        const label = el("span", { class: "toggle-label" }, "Enable adult themes for servers that opt in");
        input.append(checkbox, track, label);
    } else if (field.textarea) {
        input = el("textarea", {
            id: `f-${fieldKey}`,
            placeholder: field.placeholder || "",
            maxlength: field.max,
            rows: 3,
        });
        input.value = state.values[fieldKey] || "";
        input.oninput = () => { state.values[fieldKey] = input.value; onChange(); };
    } else {
        input = el("input", {
            id: `f-${fieldKey}`,
            type: field.sensitive ? "password" : "text",
            placeholder: field.placeholder || "",
            maxlength: field.max,
            autocomplete: field.sensitive ? "off" : "on",
            spellcheck: !field.sensitive,
        });
        input.value = state.values[fieldKey] || "";
        input.oninput = () => {
            state.values[fieldKey] = input.value;
            if (field.sensitive) saveSessionSecrets(state.values);
            onChange();
        };
    }
    wrap.append(input);
    if (field.help) wrap.append(el("p", { class: "help" }, field.help));
    return wrap;
}

function buildPreview(values) {
    const wrapper = el("div", {});
    wrapper.append(el("h3", { style: { fontSize: "0.95rem", margin: "0 0 0.75rem", color: "var(--text-muted)" } }, "Preview"));

    const mock = el("div", { class: "discord-mock" });
    mock.append(el("div", { class: "author" },
        el("div", {
            style: {
                width: "32px", height: "32px", borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 700, fontSize: "0.85rem",
            },
        }, (values.char_name || "?").slice(0, 2).toUpperCase()),
        el("span", { class: "author-name" }, values.char_name || "Your bot"),
        el("span", { class: "author-tag" }, "App"),
    ));

    const sample = sampleReply(values);
    mock.append(el("div", {}, sample));
    mock.append(el("div", { class: "embed", style: { marginTop: "0.5rem" } },
        el("div", { style: { color: "#fff", fontWeight: 600, marginBottom: "0.2rem" } }, "Welcome message"),
        el("div", { style: { color: "#b5bac1", fontSize: "0.88rem" } },
            values.welcome_message || "Hey there, welcome to the server!")));

    wrapper.append(mock);

    wrapper.append(el("h3", { style: { fontSize: "0.95rem", margin: "1.5rem 0 0.5rem", color: "var(--text-muted)" } }, "Bundle contents"),
        el("ul", { style: { color: "var(--text-muted)", fontSize: "0.88rem", paddingLeft: "1.2rem" } },
            el("li", {}, "bot.py — your customized bot"),
            el("li", {}, ".env — your Discord & Groq keys"),
            el("li", {}, "requirements.txt"),
            el("li", {}, "README.md — hosting guide"),
        ));

    return wrapper;
}

function sampleReply(values) {
    const traits = (values.char_personality || "friendly and witty").split(",")[0].trim();
    return `Hey 👋 — I'm ${values.char_name || "your bot"}. I keep things ${traits.toLowerCase()} and I only chime in when you mention me. Try /help to see what I can do.`;
}

function validate(values) {
    for (const fieldKey of FIELD_ORDER) {
        const field = PLACEHOLDER_FIELDS[fieldKey];
        if (!field.required) continue;
        const value = values[fieldKey];
        if (typeof value === "boolean") continue;
        if (!value || !String(value).trim()) {
            toast(`Please fill in: ${field.label}`, "warn");
            const node = document.getElementById(`f-${fieldKey}`);
            if (node) { node.scrollIntoView({ behavior: "smooth", block: "center" }); node.focus(); }
            return false;
        }
    }
    if (!String(values.discord_token).startsWith("M") && values.discord_token.length < 50) {
        toast("That doesn't look like a valid Discord token.", "warn");
        return false;
    }
    if (!String(values.groq_api_key).startsWith("gsk_")) {
        toast("Groq keys start with 'gsk_'.", "warn");
        return false;
    }
    return true;
}

async function downloadPackage(values) {
    if (!window.JSZip) throw new Error("JSZip not loaded yet — refresh the page.");
    const templateRes = await fetch("/bot-template.py", { cache: "no-store" });
    if (!templateRes.ok) throw new Error("Could not fetch bot template.");
    let template = await templateRes.text();

    for (const [fieldKey, def] of Object.entries(PLACEHOLDER_FIELDS)) {
        const value = values[fieldKey];
        if (def.boolean) {
            template = template.replaceAll(`__SYNCCORD_${def.key}__`, value ? "True" : "False");
        } else {
            const placeholder = `"__SYNCCORD_${def.key}__"`;
            template = template.replaceAll(placeholder, JSON.stringify(value || ""));
        }
    }

    const remaining = template.match(/__SYNCCORD_[A-Z_]+__/);
    if (remaining) throw new Error(`Template has unfilled placeholder: ${remaining[0]}`);

    const zip = new JSZip();
    zip.file("bot.py", template);
    zip.file(".env", envFile(values));
    zip.file("requirements.txt", "discord.py>=2.4.0\nopenai>=1.40.0\n");
    zip.file("README.md", readmeFor(values));

    const blob = await zip.generateAsync({ type: "blob" });
    const safeName = String(values.char_name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bot";
    triggerDownload(blob, `${safeName}-synccord-bot.zip`);
}

function envFile(values) {
    return [
        "# SyncCord bot environment variables",
        "# These override the values baked into bot.py.",
        "",
        `DISCORD_TOKEN=${values.discord_token}`,
        `GROQ_API_KEY=${values.groq_api_key}`,
        "",
    ].join("\n");
}

function readmeFor(values) {
    const name = values.char_name || "your bot";
    return [
        `# ${name} — built with SyncCord`,
        "",
        "A custom AI Discord character bot. Generated by [SyncCord](https://syncord.app).",
        "",
        "## Run locally",
        "",
        "1. Install Python 3.10+ and [pip](https://pip.pypa.io/en/stable/installation/).",
        "2. Install dependencies:",
        "",
        "   ```bash",
        "   pip install -r requirements.txt",
        "   ```",
        "",
        "3. Run the bot:",
        "",
        "   ```bash",
        "   python bot.py",
        "   ```",
        "",
        "## Host it 24/7",
        "",
        "- **Railway / Render / Fly.io** — push the folder to GitHub, deploy as a worker, paste `python bot.py` as the start command.",
        "- **VPS** — run inside `tmux` or as a `systemd` service.",
        "",
        "## Tokens",
        "",
        "Your Discord and Groq tokens are stored in `.env`. To rotate them later, open `.env` and update the values there — they override the baked-in defaults in `bot.py`.",
        "",
        "## Activate the bot in your server",
        "",
        "After inviting the bot, in any channel run:",
        "",
        "```",
        "/activate #general",
        "```",
        "",
        "From then on the bot only replies in channels you've activated. See `/help` for the full command list.",
        "",
        "Need help? https://discord.gg/qZXSrjdtM2",
        "",
    ].join("\n");
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
