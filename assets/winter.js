/* Winter effects shared by every page:
   - falling snow (white flakes with flecks of evergreen) in the header
   - the night scene at the bottom of the page: swirling starry sky, pines,
     a deer, a little tree, a polar bear with cocoa, and a knit border.
     Hovering (or tapping) the scene lights the tree and writes Clarence's note
     in cursive; clicking the tree shakes the snow off its branches.
   All artwork is original and drawn here in SVG. */

(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------ snow */
  class Snow {
    constructor(canvas, { density = 9000, green = 0.12, wind = 0.25 } = {}) {
      this.c = canvas; this.ctx = canvas.getContext("2d");
      this.density = density; this.green = green; this.wind = wind;
      this.flakes = []; this.bursts = []; this.running = false; this.t = 0;
      new ResizeObserver(() => this.resize()).observe(canvas);
      new IntersectionObserver(([e]) => (e.isIntersecting ? this.start() : this.stop())).observe(canvas);
      this.resize();
    }
    resize() {
      const r = this.c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      if (!r.width || !r.height) return;
      this.w = r.width; this.h = r.height;
      this.c.width = r.width * dpr; this.c.height = r.height * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const want = Math.round((r.width * r.height) / this.density);
      while (this.flakes.length < want) this.flakes.push(this.flake(true));
      this.flakes.length = want;
      if (reduceMotion) this.draw();
    }
    flake(anywhere) {
      const z = Math.random();               // depth: 0 far .. 1 near
      const greenFleck = Math.random() < this.green;
      return {
        x: Math.random() * (this.w || 1), y: anywhere ? Math.random() * (this.h || 1) : -6,
        r: greenFleck ? 0.9 + z * 1.3 : 0.7 + z * 2.4,
        vy: 0.25 + z * 0.9, sway: 0.4 + Math.random() * 1.2, phase: Math.random() * 6.28,
        color: greenFleck ? (Math.random() < .5 ? "92,198,154" : "47,143,107") : "255,255,255",
        a: greenFleck ? 0.75 : 0.45 + z * 0.5,
      };
    }
    burst(x, y, n = 40) {
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 2.4;
        this.bursts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.4,
                           r: 0.8 + Math.random() * 2, life: 1, color: "255,255,255" });
      }
      this.start();
    }
    start() { if (!this.running && !reduceMotion) { this.running = true; requestAnimationFrame(() => this.loop()); } }
    stop() { this.running = false; }
    loop() {
      if (!this.running) return;
      this.t += 0.016; this.step(); this.draw();
      requestAnimationFrame(() => this.loop());
    }
    step() {
      for (const f of this.flakes) {
        f.y += f.vy; f.x += Math.sin(this.t * f.sway + f.phase) * 0.35 + this.wind * f.vy * 0.4;
        if (f.y > this.h + 6) Object.assign(f, this.flake(false));
        if (f.x > this.w + 6) f.x = -6; else if (f.x < -6) f.x = this.w + 6;
      }
      for (const b of this.bursts) { b.x += b.vx; b.y += b.vy; b.vy += 0.06; b.vx *= 0.99; b.life -= 0.012; }
      this.bursts = this.bursts.filter(b => b.life > 0);
    }
    draw() {
      const { ctx } = this;
      ctx.clearRect(0, 0, this.w, this.h);
      for (const f of [...this.flakes, ...this.bursts]) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${f.color},${f.life !== undefined ? f.life : f.a})`;
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function addSnow(host, opts) {
    const c = document.createElement("canvas");
    c.className = "snow-canvas"; c.setAttribute("aria-hidden", "true");
    host.prepend(c);
    return new Snow(c, opts);
  }

  /* ------------------------------------------------------------ scene art */
  const pine = (x, base, h, body, shade, snow) => {
    const w = h * 0.42, tiers = 5, parts = [];
    for (let i = 0; i < tiers; i++) {
      const top = base - h + (h * i) / tiers * 0.82, bot = top + h * 0.34, half = w * (0.35 + 0.65 * (i + 1) / tiers) / 1.4;
      parts.push(`<path d="M${x} ${top} L${x + half} ${bot} Q${x + half * .5} ${bot - 5} ${x + half * .25} ${bot + 2}
        Q${x} ${bot - 4} ${x - half * .3} ${bot + 2} Q${x - half * .55} ${bot - 5} ${x - half} ${bot} Z" fill="${body}"/>`);
      parts.push(`<path d="M${x} ${top + 3} L${x - half * .8} ${bot - 2} Q${x - half * .4} ${bot - 6} ${x} ${bot - 3} Z" fill="${shade}" opacity=".55"/>`);
      if (snow) parts.push(`<path d="M${x} ${top} L${x + half * .55} ${top + h * .19} Q${x + half * .2} ${top + h * .15} ${x} ${top + h * .2}
        Q${x - half * .25} ${top + h * .15} ${x - half * .5} ${top + h * .18} Z" fill="${snow}" opacity=".9"/>`);
    }
    parts.push(`<rect x="${x - 3}" y="${base - 4}" width="6" height="10" fill="${shade}"/>`);
    return `<g class="pine">${parts.join("")}</g>`;
  };

  function sceneSVG() {
    const rings = Array.from({ length: 11 }, (_, i) =>
      `<circle cx="0" cy="0" r="${22 + i * 19}" fill="none" stroke="url(#ringStroke)" stroke-width="${7 - i * .4}"
        stroke-dasharray="${60 + i * 25} ${18 + i * 6}" opacity="${.55 - i * .04}"/>`).join("");
    const stars = Array.from({ length: 70 }, (_, i) => {
      const x = (i * 197) % 1200, y = (i * 83) % 250, r = (i % 5 === 0) ? 1.6 : .9;
      return `<circle class="twinkle" style="animation-delay:${(i % 9) * .37}s" cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`;
    }).join("");
    const left = [[90, 378, 150, "#5e9bd8", "#2f5f9a", "#e8f3fc"], [175, 384, 185, "#7fb6e8", "#3e72ad", "#f1f8ff"],
                  [255, 380, 135, "#5e9bd8", "#2f5f9a", "#e8f3fc"], [40, 392, 115, "#9cc8ee", "#5e8fc6", "#ffffff"]]
      .map(a => pine(...a)).join("");
    const right = [[1020, 380, 250, "#f4f9fd", "#a9c7e3", null], [1105, 372, 300, "#ffffff", "#b8d3ea", null],
                   [960, 388, 170, "#e6f0f9", "#9dbcd9", null], [1170, 392, 190, "#d9e9f6", "#8fb2d4", null],
                   [880, 396, 120, "#7fb6e8", "#3e72ad", "#f1f8ff"]].map(a => pine(...a)).join("");
    const lights = [[586, 318], [612, 310], [580, 296], [608, 287], [590, 272], [612, 262], [598, 249]]
      .map(([x, y], i) => `<circle class="bulb" style="animation-delay:${i * .23}s" cx="${x}" cy="${y}" r="3.6"
        fill="${["#ff5a6e", "#ffd34d", "#5cc69a", "#62b3ff", "#ff9f43", "#c38bff", "#ff5a6e"][i]}"/>`).join("");
    const flecks = Array.from({ length: 46 }, (_, i) =>
      `<circle cx="${(i * 263) % 1200}" cy="${392 + (i * 37) % 52}" r="${i % 3 ? 1.3 : 2}" fill="${i % 4 ? "#5cc69a" : "#2f8f6b"}" opacity=".7"/>`).join("");

    return `
<svg class="scene-art" viewBox="0 0 1200 460" preserveAspectRatio="xMidYMax slice" role="img"
     aria-label="A snowy night: a guiding star over pine trees, a deer, a little tree and a polar bear with hot cocoa">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#050d1c"/><stop offset=".45" stop-color="#0b2a55"/>
      <stop offset=".8" stop-color="#1f5d9c"/><stop offset="1" stop-color="#9fcbee"/>
    </linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#e9f6ff" stop-opacity=".95"/>
      <stop offset=".25" stop-color="#7cc4e4" stop-opacity=".5"/><stop offset="1" stop-color="#1f5d9c" stop-opacity="0"/></radialGradient>
    <linearGradient id="ringStroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a6dbf2"/><stop offset="1" stop-color="#2a74b0"/></linearGradient>
    <linearGradient id="hillA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b7cc4"/><stop offset="1" stop-color="#16467e"/></linearGradient>
    <linearGradient id="hillB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfe2f3"/></linearGradient>
    <radialGradient id="starGlow"><stop offset="0" stop-color="#fff7c2"/><stop offset=".4" stop-color="#ffe066" stop-opacity=".6"/>
      <stop offset="1" stop-color="#ffe066" stop-opacity="0"/></radialGradient>
  </defs>

  <rect width="1200" height="460" fill="url(#sky)"/>
  ${stars}
  <g transform="translate(760 120)">
    <circle r="150" fill="url(#glow)"/>
    <g class="swirl">${rings}</g>
    <g class="guiding-star"><path d="M0 -30 L5 -5 L30 0 L5 5 L0 30 L-5 5 L-30 0 L-5 -5 Z" fill="#fff"/>
      <path d="M0 -14 L3 -3 L14 0 L3 3 L0 14 L-3 3 L-14 0 L-3 -3 Z" fill="#cfefff" transform="rotate(45)"/></g>
  </g>

  <path d="M0 330 Q180 268 380 318 T760 300 T1200 312 V460 H0 Z" fill="url(#hillA)" opacity=".9"/>
  ${left}
  ${right}
  <path d="M0 372 Q240 338 470 366 Q640 384 820 360 Q1020 336 1200 366 V460 H0 Z" fill="url(#hillB)"/>
  ${flecks}

  <!-- deer -->
  <g class="deer" transform="translate(452 360)">
    <ellipse cx="0" cy="-30" rx="27" ry="12" fill="#f4f9ff"/>
    <rect x="-20" y="-24" width="4" height="26" rx="2" fill="#e3eef9"/><rect x="-11" y="-22" width="4" height="24" rx="2" fill="#f4f9ff"/>
    <rect x="12" y="-24" width="4" height="26" rx="2" fill="#e3eef9"/><rect x="20" y="-22" width="4" height="24" rx="2" fill="#f4f9ff"/>
    <path d="M-27 -34 q-6 -3 -5 4" stroke="#f4f9ff" stroke-width="4" fill="none" stroke-linecap="round"/>
    <g class="deer-head">
      <path d="M18 -38 L30 -62 L38 -58 L28 -34 Z" fill="#f4f9ff"/>
      <ellipse cx="38" cy="-64" rx="10" ry="6" fill="#f4f9ff" transform="rotate(20 38 -64)"/>
      <path d="M33 -69 l-4 -16 m2 6 l-7 -4 m9 -8 l-5 -6 M39 -70 l4 -15 m-2 6 l7 -5 m-5 -7 l5 -5" stroke="#f4f9ff" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="41" cy="-66" r="1.3" fill="#16467e"/>
    </g>
  </g>

  <!-- little tree -->
  <g class="little-tree" tabindex="0" role="button" aria-label="Little tree: click to shake off the snow">
    <ellipse cx="600" cy="374" rx="34" ry="8" fill="#a8d0f0"/>
    <path d="M570 372 Q585 362 600 368 Q615 360 632 372 Q616 378 600 375 Q585 380 570 372 Z" fill="#62a0dc"/>
    <g class="tree-top">
      <path d="M600 372 Q598 330 601 300 Q603 272 606 246 Q612 236 622 240" stroke="#7a4a24" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M600 330 Q586 322 576 326 M601 312 Q618 302 628 306 M602 290 Q588 282 580 286 M604 270 Q620 262 628 266" stroke="#7a4a24" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <g fill="#2f8f6b">
        <path d="M576 326 l-6 -4 m6 4 l-7 1 m7 -1 l-4 5 M628 306 l6 -4 m-6 4 l7 1 m-7 -1 l4 5 M580 286 l-6 -4 m6 4 l-7 1 m7 -1 l-4 5 M628 266 l6 -4 m-6 4 l7 1 m-7 -1 l4 5" stroke="#2f8f6b" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M606 246 l-5 -6 m5 6 l2 -8 m-2 8 l6 -4" stroke="#2f8f6b" stroke-width="2.2" stroke-linecap="round"/>
      </g>
      <path class="tree-snow" d="M574 324 q4 -4 10 -1 M624 304 q4 -4 8 0 M578 284 q4 -4 9 -1 M624 264 q4 -4 8 0" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>
      <line x1="622" y1="240" x2="622" y2="250" stroke="#ccc" stroke-width="1"/>
      <circle cx="622" cy="256" r="7" fill="#d62f45"/><circle cx="619.5" cy="253.5" r="2" fill="#ff9aa6"/>
      <g class="lights">${lights}</g>
      <g class="tree-star" transform="translate(606 236)">
        <circle r="18" fill="url(#starGlow)"/>
        <path d="M0 -9 L2.6 -2.8 L9 -2.8 L3.8 1.2 L5.6 7.6 L0 3.8 L-5.6 7.6 L-3.8 1.2 L-9 -2.8 L-2.6 -2.8 Z" fill="#ffd34d"/>
      </g>
    </g>
  </g>

  <!-- polar bear with a red scarf and cocoa -->
  <g class="bear" transform="translate(800 330)">
    <ellipse cx="0" cy="34" rx="34" ry="30" fill="#ffffff"/>
    <ellipse cx="-20" cy="60" rx="12" ry="7" fill="#f2f7fb"/><ellipse cx="20" cy="60" rx="12" ry="7" fill="#f2f7fb"/>
    <circle cx="0" cy="-6" r="22" fill="#ffffff"/>
    <circle cx="-16" cy="-22" r="7" fill="#ffffff"/><circle cx="16" cy="-22" r="7" fill="#ffffff"/>
    <circle cx="-16" cy="-22" r="3.5" fill="#1b2b3c"/><circle cx="16" cy="-22" r="3.5" fill="#1b2b3c"/>
    <path d="M-9 -9 q3 -3 6 0 M3 -9 q3 -3 6 0" stroke="#1b2b3c" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="0" cy="0" rx="5" ry="3.5" fill="#1b2b3c"/>
    <path d="M-5 5 q5 5 10 0" stroke="#1b2b3c" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M-22 12 q22 12 44 0 l1 9 q-23 12 -46 0 Z" fill="#d62f45"/>
    <path d="M10 18 l6 34 l-12 2 l-3 -34 Z" fill="#d62f45"/>
    <path d="M-16 15 l4 8 M-8 18 l3 8 M0 19 l2 8 M8 18 l1 8 M7 30 h9 M8 38 h9 M9 46 h9" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
    <!-- cocoa mug -->
    <g transform="translate(52 40)">
      <path class="steam" d="M-4 -10 q-6 -10 0 -18 q6 -8 0 -16" stroke="#fff" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round"/>
      <path class="steam s2" d="M6 -10 q-6 -10 0 -18 q6 -8 0 -16" stroke="#fff" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/>
      <path d="M-12 -8 h26 l-2 26 q-11 5 -22 0 Z" fill="#d62f45"/>
      <path d="M14 -2 q10 0 9 8 q-1 7 -10 6" stroke="#d62f45" stroke-width="3.5" fill="none"/>
      <ellipse cx="1" cy="-8" rx="13" ry="3" fill="#6b3b1f"/>
      <circle cx="-3" cy="-9" r="2.6" fill="#fff"/><circle cx="4" cy="-9.5" r="2.4" fill="#fff"/>
      <path d="M1 0 v12 M-5 6 h12 M-3 2 l8 8 M5 2 l-8 8" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;
  }

  function knitBand() {
    const navy = "#123a6b", w = "#ffffff", red = "#c8364a", g = "#2f8f6b";
    const v = (x, y, c) => `<path d="M${x} ${y} l3 5 l3 -5" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56"><rect width="48" height="56" fill="${navy}"/>`;
    for (let x = 0; x < 48; x += 8) s += v(x + 1, 3, w) + v(x + 1, 50, w);
    for (let x = 0; x < 48; x += 8) s += v(x + 1, 10, red) + v(x + 1, 43, red);
    s += v(9, 19, w) + v(21, 17, g) + v(33, 19, w) + v(15, 25, g) + v(27, 25, g) + v(9, 31, w) + v(21, 33, g) + v(33, 31, w);
    s += v(21, 25, w) + v(1, 25, red) + v(41, 25, red) + "</svg>";
    return `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
  }

  const QUOTE = [
    { t: 'Remember <u>no</u> man', cls: "" },
    { t: "is a failure who has", cls: "" },
    { t: "<u>friends</u>.", cls: "" },
    { t: "Thanks for the wings!", cls: "gap" },
    { t: "Love", cls: "sign" },
    { t: "Clarence", cls: "sign2" },
  ];

  function buildScene() {
    const footer = document.createElement("footer");
    footer.className = "scene";
    footer.innerHTML = `
      <div class="scene-stage" tabindex="0" aria-label="Hover or tap to read Clarence's note">
        ${sceneSVG()}
        <div class="note" aria-live="polite">
          ${QUOTE.map((l, i) => `<span class="note-line ${l.cls}" style="--i:${i}">${l.t}</span>`).join("")}
        </div>
        <div class="scene-hint">✦ hover to read · click the little tree</div>
      </div>
      <div class="knit" aria-hidden="true"></div>`;
    document.body.appendChild(footer);
    footer.querySelector(".knit").style.backgroundImage = knitBand();

    const stage = footer.querySelector(".scene-stage");
    const snow = addSnow(stage, { density: 5200, green: 0.1, wind: 0.15 });

    // touch screens: tap toggles the note
    stage.addEventListener("click", e => {
      if (e.target.closest(".little-tree")) return;
      if (matchMedia("(hover: none)").matches) stage.classList.toggle("on");
    });
    const tree = footer.querySelector(".little-tree");
    const shake = () => {
      tree.classList.remove("shake"); void tree.getBBox(); tree.classList.add("shake");
      const r = tree.getBoundingClientRect(), s = stage.getBoundingClientRect();
      snow.burst(r.left - s.left + r.width / 2, r.top - s.top + r.height * 0.35, 60);
      stage.classList.add("on");
    };
    tree.addEventListener("click", shake);
    tree.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); shake(); } });
    stage.addEventListener("mouseleave", () => stage.classList.remove("on"));
    if (location.hash === "#clarence") stage.classList.add("on");  // link straight to the note
  }

  function init() {
    document.querySelectorAll(".hero").forEach(h => addSnow(h, { density: 2600, green: 0.14, wind: 0.3 }));
    buildScene();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
