// Self-contained canvas particle system.
// - Free-floating drift with mouse repulsion
// - On scroll past 25% of the hero, particles morph into the SyncCord wordmark
// - Returns to drift when scrolled back up
// No external dependencies.

const PARTICLE_COUNT_DESKTOP = 320;
const PARTICLE_COUNT_MOBILE  = 140;
const REPULSION_RADIUS = 110;
const REPULSION_STRENGTH = 0.35;
const SPRING = 0.06;        // pull toward target
const FRICTION = 0.86;      // velocity damping
const DRIFT_SPRING = 0.0012;
const PARTICLE_SIZE = 1.6;
const COLORS = [
    "rgba(255, 245, 200, 0.9)",   // warm white
    "rgba(255, 215, 0, 0.95)",    // bright gold
    "rgba(255, 240, 0, 0.85)",    // yellow
];

let canvas, ctx, particles = [], targets = [];
let pointer = { x: -9999, y: -9999, active: false };
let scrollProgress = 0;
let dpr = 1;
let rafId = 0;
let mounted = false;

export function mountParticleField() {
    if (mounted) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const container = document.getElementById("particle-field");
    if (!container) return;
    container.style.background = "transparent";   // override the fallback CSS
    container.style.animation = "none";

    canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block;";
    container.append(canvas);
    ctx = canvas.getContext("2d");

    resize();
    seedParticles();

    window.addEventListener("resize", debounce(() => {
        resize();
        seedParticles();
    }, 200));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", onScroll);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerleave", () => { pointer.active = false; });

    onScroll();
    rafId = requestAnimationFrame(tick);
    mounted = true;
}

function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    targets = sampleRobotTargets();
}

function seedParticles() {
    const isMobile = window.innerWidth < 720;
    const count = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
    particles = new Array(count).fill(0).map((_, i) => {
        const target = targets[i % targets.length] || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        return {
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            tx: target.x,
            ty: target.y,
            color: COLORS[i % COLORS.length],
            size: PARTICLE_SIZE * (0.7 + Math.random() * 1.1),
            // Drift base — a "home" point particles oscillate around when free
            hx: Math.random() * window.innerWidth,
            hy: Math.random() * window.innerHeight,
        };
    });
}

function sampleRobotTargets() {
    // Try the robot emoji first — modern systems render a colorful glyph.
    // We only need shape (alpha), not color. Fall back to a hand-drawn
    // path-based robot if the platform doesn't render the emoji at all.
    const off = document.createElement("canvas");
    const W = window.innerWidth;
    const H = window.innerHeight;
    off.width = W;
    off.height = H;
    const octx = off.getContext("2d");

    const fontSize = Math.min(W * 0.42, 420);
    octx.fillStyle = "#fff";
    octx.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","EmojiOne","sans-serif"`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillText("🤖", W / 2, H * 0.42);

    const step = Math.max(4, Math.round(fontSize / 36));
    const points = harvestPoints(octx, W, H, step);

    if (points.length < 80) {
        // Fallback: draw a stylized robot head + body with paths
        octx.clearRect(0, 0, W, H);
        drawPathRobot(octx, W / 2, H * 0.42, Math.min(W * 0.32, 360));
        return harvestPoints(octx, W, H, step);
    }
    return points;
}

function harvestPoints(octx, W, H, step) {
    const pixels = octx.getImageData(0, 0, W, H).data;
    const points = [];
    for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
            if (pixels[(y * W + x) * 4 + 3] > 128) points.push({ x, y });
        }
    }
    // Shuffle so neighbors don't all pick neighbor targets.
    for (let i = points.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [points[i], points[j]] = [points[j], points[i]];
    }
    return points;
}

function drawPathRobot(ctx, cx, cy, size) {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = Math.max(8, size * 0.04);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const headW = size, headH = size * 0.85;
    const radius = size * 0.12;
    const top = cy - headH / 2;

    // Head
    roundRect(ctx, cx - headW / 2, top, headW, headH, radius);
    ctx.fill();

    // Antennae
    ctx.beginPath();
    ctx.moveTo(cx - headW * 0.28, top);
    ctx.lineTo(cx - headW * 0.28, top - size * 0.18);
    ctx.moveTo(cx + headW * 0.28, top);
    ctx.lineTo(cx + headW * 0.28, top - size * 0.18);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - headW * 0.28, top - size * 0.22, size * 0.05, 0, Math.PI * 2);
    ctx.arc(cx + headW * 0.28, top - size * 0.22, size * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Eye visor — punched out (use destination-out)
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    roundRect(ctx, cx - headW * 0.3, cy - headH * 0.18, headW * 0.6, headH * 0.32, size * 0.06);
    ctx.fill();
    ctx.restore();

    // Eyes inside the visor
    ctx.beginPath();
    ctx.arc(cx - headW * 0.13, cy - headH * 0.02, size * 0.05, 0, Math.PI * 2);
    ctx.arc(cx + headW * 0.13, cy - headH * 0.02, size * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Mouth grille
    ctx.beginPath();
    ctx.lineWidth = Math.max(4, size * 0.025);
    for (let i = -2; i <= 2; i++) {
        ctx.moveTo(cx + i * size * 0.06, cy + headH * 0.18);
        ctx.lineTo(cx + i * size * 0.06, cy + headH * 0.28);
    }
    ctx.stroke();

    // Side ports
    ctx.beginPath();
    ctx.arc(cx - headW * 0.5, cy, size * 0.04, 0, Math.PI * 2);
    ctx.arc(cx + headW * 0.5, cy, size * 0.04, 0, Math.PI * 2);
    ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function onScroll() {
    const onLanding = !location.hash || location.hash === "#/" || location.hash === "#";
    if (!onLanding) {
        scrollProgress = 0;
        return;
    }
    const heroEnd = window.innerHeight * 0.6;
    scrollProgress = clamp(window.scrollY / heroEnd, 0, 1);
}

function onPointer(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
}

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

function tick() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    ctx.clearRect(0, 0, W, H);

    const morph = scrollProgress; // 0 = drift, 1 = locked to wordmark
    const repulsionR2 = REPULSION_RADIUS * REPULSION_RADIUS;

    for (const p of particles) {
        if (morph > 0.01) {
            // Spring toward sampled target, weighted by morph
            const dx = (p.tx - p.x) * SPRING * morph;
            const dy = (p.ty - p.y) * SPRING * morph;
            p.vx += dx;
            p.vy += dy;
        }
        if (morph < 0.99) {
            // Free drift — pulled gently toward home, with random jitter
            const dx = (p.hx - p.x) * DRIFT_SPRING * (1 - morph);
            const dy = (p.hy - p.y) * DRIFT_SPRING * (1 - morph);
            p.vx += dx + (Math.random() - 0.5) * 0.04 * (1 - morph);
            p.vy += dy + (Math.random() - 0.5) * 0.04 * (1 - morph);
        }

        if (pointer.active) {
            const ddx = p.x - pointer.x;
            const ddy = p.y - pointer.y;
            const distSq = ddx * ddx + ddy * ddy;
            if (distSq < repulsionR2 && distSq > 0.01) {
                const dist = Math.sqrt(distSq);
                const force = (1 - dist / REPULSION_RADIUS) * REPULSION_STRENGTH;
                p.vx += (ddx / dist) * force * 6;
                p.vy += (ddy / dist) * force * 6;
            }
        }

        p.vx *= FRICTION;
        p.vy *= FRICTION;
        p.x += p.vx;
        p.y += p.vy;

        // Wrap horizontally during drift so the field feels infinite
        if (morph < 0.5) {
            if (p.x < -10) p.x = W + 10;
            else if (p.x > W + 10) p.x = -10;
            if (p.y < -10) p.y = H + 10;
            else if (p.y > H + 10) p.y = -10;
        }

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }

    rafId = requestAnimationFrame(tick);
}

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function unmountParticleField() {
    if (!mounted) return;
    cancelAnimationFrame(rafId);
    canvas?.remove();
    mounted = false;
}
