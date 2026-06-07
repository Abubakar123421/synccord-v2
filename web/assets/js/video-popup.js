import { el, openModal } from "./ui.js";

export function showVideoPopup() {
    // Check if video popup has already been shown in this session
    if (sessionStorage.getItem("synccord_video_shown")) {
        return;
    }

    // Only show if the user is on the landing page
    const currentHash = location.hash || "#/";
    if (currentHash !== "#/") {
        return;
    }

    openModal((modal, close) => {
        modal.classList.add("video-modal");

        // Close button at top right
        const closeBtn = el("button", {
            class: "video-modal-close",
            "aria-label": "Close",
            onClick: () => {
                sessionStorage.setItem("synccord_video_shown", "true");
                close();
            }
        }, "×");

        // Top tag badge
        const badge = el("div", { 
            class: "tag breathe", 
            style: { alignSelf: "center", marginBottom: "0.75rem", gap: "0.5rem" } 
        }, "★ NEW VIDEO");

        // Header
        const title = el("h2", { 
            style: { 
                textAlign: "center", 
                margin: "0 0 0.5rem 0", 
                fontSize: "var(--fs-lg)", 
                color: "var(--accent)",
                fontFamily: "var(--font-display)",
                textShadow: "0 0 20px rgba(255, 215, 0, 0.3)"
            } 
        }, "Watch out this new video to see new videos of SyncCord!");

        // Description
        const desc = el("p", { 
            style: { 
                color: "var(--text-muted)", 
                fontSize: "var(--fs-xs)", 
                textAlign: "center", 
                margin: "0 0 1.25rem 0",
                lineHeight: "1.4"
            } 
        }, "Get a quick overview of how SyncCord V2 helps you build custom AI-powered Discord character bots without coding.");

        // Video iframe container
        const videoContainer = el("div", { class: "video-container" },
            el("iframe", {
                src: "https://www.youtube.com/embed/ZSHz5fCuS4o?autoplay=1",
                title: "SyncCord V2 Tutorial Video",
                frameborder: "0",
                allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                allowfullscreen: true
            })
        );

        // Footer buttons
        const footerBar = el("div", { 
            style: { 
                display: "flex", 
                justifyContent: "center", 
                gap: "0.75rem", 
                marginTop: "1.25rem" 
            } 
        },
            el("button", {
                class: "btn btn-primary btn-sm",
                onClick: () => {
                    sessionStorage.setItem("synccord_video_shown", "true");
                    close();
                }
            }, "Skip & Enter Site"),
            el("a", {
                class: "btn btn-ghost btn-sm",
                href: "https://www.youtube.com/watch?v=ZSHz5fCuS4o",
                target: "_blank",
                rel: "noopener"
            }, "Watch on YouTube")
        );

        modal.append(closeBtn, badge, title, desc, videoContainer, footerBar);

        // Mark as shown immediately so if they click the overlay backdrop (which closes modal) it registers
        sessionStorage.setItem("synccord_video_shown", "true");
    });
}
