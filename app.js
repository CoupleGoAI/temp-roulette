/* ═══════════════════════════════════════════════════════════════════
   EDIT HERE — challenges
   ═══════════════════════════════════════════════════════════════════ */

// Challenge wheel. `wheel` is the short label on the wheel (optional; defaults to title).
const CHALLENGES = [
  { title: "Mirror Me",        tag: "Quick",   text: "One of you moves slowly while the other copies like a mirror. Then switch roles." },
  { title: "Team Countdown",   tag: "Focus",   text: "Count from 1 to 20 out loud, one number each, taking turns. Mess up? Start over." },
  { title: "Copy My Face",     tag: "Silly",   text: "Take turns pulling three different faces while your partner copies each one exactly." },
  { title: "Secret Handshake", tag: "Team",    text: "Invent a 5-move secret handshake and perform it twice without a mistake." },
  { title: "Back to Back",     tag: "Balance", text: "Stand back to back, link arms, sit down to the floor and stand up again together." },
  { title: "Team Alphabet",    tag: "Focus",   text: "Say the alphabet together, alternating letters, as fast as you can." },
  { title: "Who Knows Who?",   tag: "Know",    text: "Name your partner's favourite food, song and childhood hero. Three answers each." },
  { title: "Blind High Five",  tag: "Trust",   text: "Close your eyes, take three steps apart, turn around and high five on the first try." },
];


const SPIN_TURNS_MIN = 5;       // minimum full rotations before landing
const SPIN_TURNS_MAX = 6;       // maximum full rotations before landing
const COULOMB_DECEL = 36;       // deg/s²: bearing friction, dominant near the end
const VISCOUS_DRAG = 0.55;      // 1/s: speed-proportional drag, dominant while spinning fast
const LAND_PAUSE_MS = 1050;     // celebration moment before the challenge card
const SPIN_FAILSAFE_MS = 6500;   // never leave the kiosk stuck on a disabled spin button
const IDLE_DEG_PER_S = 5;        // slow attract rotation while waiting

/* ═══════════════════════════════════════════════════════════════════ */

const LOGO = "logo.webp";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
document.querySelector(".brand img").src = LOGO;
const NS = "http://www.w3.org/2000/svg";
const C = 300, R = 268;

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
function polar(r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}
function splitLabel(label) {
  if (label.length <= 9 || !label.includes(" ")) return [label];
  const words = label.split(" ");
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
    const score = Math.abs(a.length - b.length);
    if (!best || score < best.score) best = { a, b, score };
  }
  return [best.a, best.b];
}

const SEG_FILL = {
  plum: "#2b1a43",   // Trust Plum slice
  pink: "#b94f70",   // Deep Signal (dark pink) slice
};

function buildWheel(svg, segments) {
  svg.innerHTML = "";
  const N = segments.length, step = 360 / N;

  // Ids are suffixed per wheel: a gradient inside a hidden (display:none) SVG does not render.
  const uid = svg.id;
  const defs = svgEl("defs");
  defs.innerHTML = `
    <linearGradient id="rimGrad-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f48ba6"/><stop offset="1" stop-color="#cc7be8"/>
    </linearGradient>
    <linearGradient id="giftGrad-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8f4aaa"/><stop offset="1" stop-color="#cc7be8"/>
    </linearGradient>
    <clipPath id="hubClip-${uid}"><circle cx="${C}" cy="${C}" r="50"/></clipPath>`;
  svg.appendChild(defs);
  const FILL = { plum: SEG_FILL.plum, pink: SEG_FILL.pink, special: `url(#giftGrad-${uid})` };

  // Rim (static)
  svg.appendChild(svgEl("circle", { cx: C, cy: C, r: R + 22, fill: "#2b1a43" }));
  svg.appendChild(svgEl("circle", { cx: C, cy: C, r: R + 22, fill: "none", stroke: `url(#rimGrad-${uid})`, "stroke-width": 6 }));

  // Rotating group
  const g = svgEl("g", { class: "wheel-rot" });
  segments.forEach((seg, i) => {
    const a0 = i * step, a1 = a0 + step, mid = a0 + step / 2;
    const p0 = polar(R, a0), p1 = polar(R, a1);
    const fill = FILL[seg.color] || (i % 2 ? FILL.pink : FILL.plum);
    const path = svgEl("path", {
      d: `M${C} ${C} L${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A${R} ${R} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`,
      fill, stroke: "#1e1230", "stroke-width": 3, "data-i": i,
    });
    g.appendChild(path);

    const words = splitLabel(seg.wheel || seg.title || seg.label);
    const lines = seg.emoji ? [seg.emoji, ...words] : words;
    const maxLen = Math.max(...words.map((l) => l.length));
    const tp = polar(R * 0.6, mid);
    const text = svgEl("text", {
      x: tp.x, y: tp.y, "text-anchor": "middle", "dominant-baseline": "central",
      class: "seg-label" + (maxLen > 10 ? " small" : ""),
      transform: `rotate(${mid - 90} ${tp.x} ${tp.y})`,
    });
    const LINE = 29;
    lines.forEach((ln, li) => {
      const ts = svgEl("tspan", { x: tp.x, dy: li === 0 ? -(lines.length - 1) * LINE / 2 : LINE });
      if (seg.emoji && li === 0) ts.setAttribute("class", "seg-emoji");
      ts.textContent = ln;
      text.appendChild(ts);
    });
    g.appendChild(text);
  });
  // Rim dots rotate with the wheel
  for (let i = 0; i < N * 3; i++) {
    const p = polar(R + 12, i * (360 / (N * 3)));
    g.appendChild(svgEl("circle", { cx: p.x, cy: p.y, r: 3.2, fill: "rgba(255,255,255,0.6)" }));
  }
  svg.appendChild(g);

  // Hub with logo (static, stays upright)
  svg.appendChild(svgEl("circle", { cx: C, cy: C, r: 60, fill: "#1e1230" }));
  svg.appendChild(svgEl("circle", { cx: C, cy: C, r: 56, fill: "#ffffff" }));
  const img = svgEl("image", { x: C - 50, y: C - 50, width: 100, height: 100, "clip-path": `url(#hubClip-${svg.id})` });
  img.setAttributeNS("http://www.w3.org/1999/xlink", "href", LOGO);
  img.setAttribute("href", LOGO);
  svg.appendChild(img);

  return { svg, g, N, rot: 0, idle: false, anim: null, raf: null, last: 0 };
}

function setRot(w) { w.g.setAttribute("transform", `rotate(${w.rot} ${C} ${C})`); }

function tick(w, now) {
  if (w.anim) {
    const anim = w.anim;

    if (anim.kind === "physics") {
      const elapsed = Math.min((now - anim.t0) / 1000, anim.stopTime);
      const { omega0, coulomb, viscous } = anim;

      // Rigid-body wheel with two real loss mechanisms:
      //   dω/dt = -(coulomb + viscous * ω)
      // Coulomb friction gives a finite stop; viscous drag removes more energy at high speed.
      const travelled =
        (omega0 + coulomb / viscous) * (1 - Math.exp(-viscous * elapsed)) / viscous
        - (coulomb / viscous) * elapsed;

      w.rot = anim.from + travelled;
      setRot(w);

      if (elapsed >= anim.stopTime) {
        // Snap only sub-pixel numerical drift, not the visible motion.
        w.rot = anim.to;
        setRot(w);
        w.anim = null;
        anim.resolve();
      }
    } else {
      const p = Math.min(1, (now - anim.t0) / anim.dur);
      w.rot = anim.from + (anim.to - anim.from) * p;
      setRot(w);
      if (p >= 1) { w.anim = null; anim.resolve(); }
    }
  } else if (w.idle && !reducedMotion) {
    const dt = Math.min(0.1, (now - w.last) / 1000);
    w.rot = (w.rot + IDLE_DEG_PER_S * dt) % 360;
    setRot(w);
  }
  w.last = now;
  if (w.anim || (w.idle && !reducedMotion)) w.raf = requestAnimationFrame((t) => tick(w, t));
  else w.raf = null;
}
function ensureLoop(w) {
  if (w.raf == null) { w.last = performance.now(); w.raf = requestAnimationFrame((t) => tick(w, t)); }
}
function setIdle(w, on) { w.idle = on; if (on) ensureLoop(w); }

function finishSpinNow(w) {
  if (!w.anim) return;
  const anim = w.anim;
  w.rot = anim.to;
  setRot(w);
  w.anim = null;
  anim.resolve();
}

function stoppingDistance(omega0, coulomb, viscous) {
  return omega0 / viscous
    - (coulomb / (viscous * viscous)) * Math.log(1 + viscous * omega0 / coulomb);
}

function stoppingTime(omega0, coulomb, viscous) {
  return Math.log(1 + viscous * omega0 / coulomb) / viscous;
}

function initialVelocityForDistance(distance, coulomb, viscous) {
  // Monotonic equation, solved once per spin. This lets the physical model
  // land exactly on the selected slice without altering its deceleration.
  let lo = 0;
  let hi = 720;
  while (stoppingDistance(hi, coulomb, viscous) < distance) hi *= 1.5;

  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (stoppingDistance(mid, coulomb, viscous) < distance) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function spinTo(w, index) {
  return new Promise((resolve) => {
    const step = 360 / w.N, mid = index * step + step / 2;
    const jitter = (Math.random() - 0.5) * step * 0.6;
    const targetMod = (((360 - mid - jitter) % 360) + 360) % 360;
    const cur = ((w.rot % 360) + 360) % 360;
    let delta = targetMod - cur;
    if (delta < 0) delta += 360;

    const turns = reducedMotion
      ? 1
      : SPIN_TURNS_MIN + Math.floor(Math.random() * (SPIN_TURNS_MAX - SPIN_TURNS_MIN + 1));
    const distance = turns * 360 + delta;
    const to = w.rot + distance;

    w.idle = false;

    if (reducedMotion) {
      w.anim = {
        kind: "linear",
        t0: performance.now(),
        dur: 700,
        from: w.rot,
        to,
        resolve,
      };
    } else {
      const omega0 = initialVelocityForDistance(distance, COULOMB_DECEL, VISCOUS_DRAG);
      w.anim = {
        kind: "physics",
        t0: performance.now(),
        from: w.rot,
        to,
        omega0,
        coulomb: COULOMB_DECEL,
        viscous: VISCOUS_DRAG,
        stopTime: stoppingTime(omega0, COULOMB_DECEL, VISCOUS_DRAG),
        resolve,
      };
    }

    ensureLoop(w);
  });
}
function highlight(w, index) {
  w.g.classList.add("has-win");
  w.g.querySelectorAll("path").forEach((p) => p.classList.toggle("is-win", +p.dataset.i === index));
}
function clearHighlight(w) {
  w.g.classList.remove("has-win");
  w.g.querySelectorAll("path").forEach((p) => p.classList.remove("is-win"));
}

/* ─── State & screens ─── */
const state = { challengeIndex: null, lastChallengeIndex: -1, busy: false };

const challengeWheel = buildWheel($("challengeWheel"), CHALLENGES);

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id));
  document.querySelectorAll(".steps li").forEach((li) => {
    li.classList.toggle("is-active", true);
    li.classList.remove("is-done");
  });
  setIdle(challengeWheel, id === "screen-spin");
  window.scrollTo(0, 0);
}

/* ─── 1 · Challenge spin ─── */
$("spinChallengeBtn").addEventListener("click", async () => {
  if (state.busy) return;

  state.busy = true;
  const button = $("spinChallengeBtn");
  button.disabled = true;
  clearHighlight(challengeWheel);

  let idx;
  do {
    idx = Math.floor(Math.random() * CHALLENGES.length);
  } while (CHALLENGES.length > 1 && idx === state.lastChallengeIndex);

  try {
    await Promise.race([
      spinTo(challengeWheel, idx),
      wait(SPIN_FAILSAFE_MS),
    ]);

    // If a browser throttled animation frames, force the wheel to its exact landing point.
    finishSpinNow(challengeWheel);

    const challenge = CHALLENGES[idx];
    highlight(challengeWheel, idx);
    state.challengeIndex = idx;
    state.lastChallengeIndex = idx;

    const wheelRect = document.querySelector(".wheel-wrap").getBoundingClientRect();
    window.burstConfetti?.({
      x: wheelRect.left + wheelRect.width / 2,
      y: wheelRect.top + wheelRect.height * 0.36,
    });
    window.showWinnerMoment?.(challenge.title);

    const wrap = document.querySelector(".wheel-wrap");
    wrap.classList.remove("is-celebrating");
    void wrap.offsetWidth;
    wrap.classList.add("is-celebrating");

    await wait(LAND_PAUSE_MS);
    wrap.classList.remove("is-celebrating");
    openChallenge(challenge);
  } catch (error) {
    console.error("Spin failed", error);
    openChallenge(CHALLENGES[idx]);
  } finally {
    button.disabled = false;
    state.busy = false;
  }
});

/* ─── 2 · Challenge ─── */
function openChallenge(ch) {
  $("chBadge").textContent = ch.tag ? `Your challenge · ${ch.tag}` : "Your challenge";
  $("chTitle").textContent = ch.title;
  $("chText").textContent = ch.text;
  showScreen("screen-challenge");
}

$("chSkip").addEventListener("click", () => {
  clearHighlight(challengeWheel);
  showScreen("screen-spin");
});

/* ─── Reset ─── */
function resetAll() {
  state.challengeIndex = null;
  state.busy = false;
  clearHighlight(challengeWheel);
  $("spinChallengeBtn").disabled = false;
  showScreen("screen-spin");
}
$("resetBtn").addEventListener("click", resetAll);

/* ─── Tablet niceties ─── */
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Keep the screen awake on the event tablet (Safari 16.4+, Chrome).
let wakeLock = null;
async function keepAwake() {
  try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => (wakeLock = null)); } } catch (_) {}
}
document.addEventListener("pointerdown", keepAwake, { once: true });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });

// Fullscreen button only where the browser supports it (iPad Safari does, iPhone doesn't).
const fsBtn = $("fullscreenBtn");
const docEl = document.documentElement;
if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
  fsBtn.hidden = false;
  fsBtn.addEventListener("click", () => {
    const isFs = document.fullscreenElement || document.webkitFullscreenElement;
    if (isFs) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl);
  });
  const sync = () => {
    const label = (document.fullscreenElement || document.webkitFullscreenElement) ? "Exit fullscreen" : "Fullscreen";
    fsBtn.setAttribute("aria-label", label); fsBtn.title = label;
  };
  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
}

// Block pinch-zoom / double-tap zoom on iPad so the wheel stays put.
document.addEventListener("gesturestart", (e) => e.preventDefault());
let lastTouch = 0;
document.addEventListener("touchend", (e) => { const now = Date.now(); if (now - lastTouch < 300) e.preventDefault(); lastTouch = now; }, { passive: false });

// Deep-link for previewing the selected challenge: ?screen=challenge
const preview = new URLSearchParams(location.search).get("screen");
if (preview === "challenge") { state.challengeIndex = 0; state.lastChallengeIndex = 0; openChallenge(CHALLENGES[0]); }
else showScreen("screen-spin");
