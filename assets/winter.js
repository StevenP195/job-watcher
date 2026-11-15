/* Winter effects shared by every page:
   - falling snow (white flakes with flecks of evergreen) in the header
   - on the Market page, an energy landscape instead (see energySVG below)
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
    burst(x, y, n = 40, color = "255,255,255") {
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 2.4;
        this.bursts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.4,
                           r: 0.8 + Math.random() * 2, life: 1, color });
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
      if (snow) parts.push(`<path d="M${x - half} ${bot} Q${x - half * .6} ${bot + 5} ${x - half * .3} ${bot + 1} Q${x} ${bot + 6}
        ${x + half * .3} ${bot + 1} Q${x + half * .6} ${bot + 5} ${x + half} ${bot}" stroke="${snow}" stroke-width="3.2" fill="none"
        stroke-linecap="round" opacity=".9"/>`);
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
     aria-label="A snowy night: a guiding star over pine trees, a log cabin, a deer, a little tree, a string of lights and a polar bear with hot cocoa">
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
    <linearGradient id="deerFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d3e5f6"/></linearGradient>
    <radialGradient id="bearFill" cx=".42" cy=".35" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f3f8fc"/><stop offset="1" stop-color="#dbe8f4"/></radialGradient>
    <filter id="bulbGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
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

  <!-- snowy log cabin with a warm window and chimney smoke -->
  <g class="cabin" transform="translate(712 314) scale(.9)">
    <path class="smoke" d="M18 -52 q-6 -8 0 -15 q6 -7 0 -14 q-5 -6 1 -12" stroke="#dbe9f5" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>
    <rect x="14" y="-50" width="8" height="18" fill="#5a3b28"/><rect x="12.5" y="-52" width="11" height="4" rx="2" fill="#f4f9ff"/>
    <rect x="-27" y="-26" width="54" height="26" fill="#6b4a33"/>
    <path d="M-27 -19 h54 M-27 -12 h54 M-27 -5 h54" stroke="#563a27" stroke-width="1.4"/>
    <rect class="window-glow" x="-19" y="-19" width="13" height="11" rx="1" fill="#ffd479"/>
    <path d="M-12.5 -19 v11 M-19 -13.5 h13" stroke="#6b4a33" stroke-width="1.4"/>
    <rect x="6" y="-18" width="11" height="18" fill="#3f291b"/>
    <path d="M-36 -24 L0 -50 L36 -24 Q30 -20 24 -23 Q12 -18 0 -22 Q-12 -18 -24 -23 Q-30 -20 -36 -24 Z" fill="#f7fbff"/>
    <path d="M-34 -24 Q-20 -27 0 -26 Q20 -27 34 -24" stroke="#c9dcef" stroke-width="1.5" fill="none"/>
    <ellipse cx="0" cy="1" rx="44" ry="4" fill="#ffffff"/>
  </g>
  <path d="M0 372 Q240 338 470 366 Q640 384 820 360 Q1020 336 1200 366 V460 H0 Z" fill="url(#hillB)"/>
  ${flecks}

  <!-- deer: slender white painted silhouette (grazing; lifts its head on hover) -->
  <g class="deer" transform="translate(452 364) scale(1.05)">
    <ellipse cx="2" cy="1" rx="34" ry="4" fill="#9fc1df" opacity=".45"/>
    <path d="M-26 -30 C-29 -20 -23 -13 -25 0 L-21.5 0 C-20 -12 -23 -20 -19 -29 Z" fill="#c9dcef"/>
    <path d="M22 -30 C20 -20 25 -12 23 0 L26.5 0 C28 -12 26 -21 28 -30 Z" fill="#c9dcef"/>
    <path d="M-32 -40 C-34 -51 -21 -57 -2 -55 C14 -54 26 -53 32 -47 C36 -41 34 -31 27 -28 C10 -25 -12 -25 -25 -28 C-32 -30 -34 -35 -32 -40 Z" fill="url(#deerFill)"/>
    <path d="M-18 -30 C-21 -19 -16 -12 -18 0 L-14.5 0 C-13 -12 -16 -20 -12 -29 Z" fill="url(#deerFill)"/>
    <path d="M28 -32 C27 -21 31 -12 30 0 L33.5 0 C35 -12 32 -22 33 -33 Z" fill="url(#deerFill)"/>
    <path d="M-31 -47 C-36 -50 -37 -44 -33 -42 Z" fill="#ffffff"/>
    <path d="M-20 -50 C-6 -46 10 -46 24 -50" stroke="#b9d1ea" stroke-width="1.2" fill="none" opacity=".7"/>
    <g class="deer-head">
      <path d="M20 -50 C24 -62 30 -71 34 -78 L43 -75 C39 -65 35 -54 33 -45 Z" fill="url(#deerFill)"/>
      <path d="M33 -80 C37 -86 46 -86 53 -81 C57 -78 57 -74 53 -73 C47 -72 40 -73 35 -74 Z" fill="#ffffff"/>
      <path d="M36 -82 L28 -88 L35 -86 Z" fill="#eaf3fb"/>
      <circle cx="44" cy="-79.5" r="1.4" fill="#16467e"/>
      <circle cx="55" cy="-76" r="1.2" fill="#2a3c50"/>
      <g stroke="#f4f9ff" stroke-width="1.8" fill="none" stroke-linecap="round">
        <path d="M39 -84 C38 -93 35 -100 30 -107 M37 -94 L30 -97 M35 -100 L37 -107 M32 -104 L26 -106"/>
        <path d="M42 -84 C43 -93 47 -99 51 -105 M44 -93 L50 -95 M47 -99 L46 -106 M49 -103 L55 -104"/>
      </g>
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

  <!-- polar bear in a knit scarf (waves when you hover him) with a cocoa mug -->
  <g class="bear" transform="translate(800 374)" tabindex="0" role="button" aria-label="Polar bear: hover to say hello">
    <ellipse cx="4" cy="2" rx="44" ry="6" fill="#9fc1df" opacity=".5"/>
    <ellipse cx="-16" cy="-7" rx="15" ry="10" fill="url(#bearFill)"/><ellipse cx="16" cy="-7" rx="15" ry="10" fill="url(#bearFill)"/>
    <g fill="#2b3a4a" opacity=".55"><circle cx="-22" cy="-6" r="1.6"/><circle cx="-16" cy="-5" r="1.6"/><circle cx="-10" cy="-6" r="1.6"/>
      <circle cx="10" cy="-6" r="1.6"/><circle cx="16" cy="-5" r="1.6"/><circle cx="22" cy="-6" r="1.6"/></g>
    <path d="M-34 -22 C-41 -58 -30 -86 0 -88 C30 -86 41 -58 34 -22 C30 -8 -30 -8 -34 -22 Z" fill="url(#bearFill)"/>
    <ellipse cx="0" cy="-40" rx="19" ry="23" fill="#ffffff" opacity=".7"/>
    <path d="M-29 -72 C-44 -64 -47 -46 -41 -35 C-38 -30 -31 -32 -30 -38 C-30 -48 -26 -58 -21 -65 Z" fill="url(#bearFill)"/>
    <g class="bear-arm">
      <path d="M29 -72 C44 -64 47 -46 41 -35 C38 -30 31 -32 30 -38 C30 -48 26 -58 21 -65 Z" fill="url(#bearFill)"/>
      <g fill="#2b3a4a" opacity=".5"><circle cx="37" cy="-36" r="1.3"/><circle cx="40" cy="-38.5" r="1.3"/><circle cx="34" cy="-34.5" r="1.3"/></g>
    </g>
    <g class="bear-head">
      <circle cx="-19" cy="-126" r="8.5" fill="url(#bearFill)"/><circle cx="19" cy="-126" r="8.5" fill="url(#bearFill)"/>
      <circle cx="-19" cy="-126" r="4" fill="#f6c9cf"/><circle cx="19" cy="-126" r="4" fill="#f6c9cf"/>
      <circle cx="0" cy="-105" r="27" fill="url(#bearFill)"/>
      <ellipse cx="0" cy="-95" rx="13" ry="10" fill="#ffffff"/>
      <ellipse cx="0" cy="-99" rx="4.8" ry="3.4" fill="#1b2b3c"/><ellipse cx="-1.4" cy="-100.2" rx="1.4" ry=".9" fill="#5b6f84"/>
      <path d="M0 -96 V-93 M-5 -92 Q0 -87 5 -92" stroke="#1b2b3c" stroke-width="1.7" fill="none" stroke-linecap="round"/>
      <path d="M-15 -109 Q-11 -113 -7 -109 M7 -109 Q11 -113 15 -109" stroke="#1b2b3c" stroke-width="2.3" fill="none" stroke-linecap="round"/>
      <circle cx="-17" cy="-99" r="4" fill="#ff9aa6" opacity=".55"/><circle cx="17" cy="-99" r="4" fill="#ff9aa6" opacity=".55"/>
    </g>
    <path d="M-26 -84 C-12 -75 12 -75 26 -84 L27 -72 C12 -63 -12 -63 -27 -72 Z" fill="#d62f45"/>
    <path d="M-20 -77 l2 3 l2 -3 M-11 -74.5 l2 3 l2 -3 M-2 -73.5 l2 3 l2 -3 M7 -74.5 l2 3 l2 -3 M16 -77 l2 3 l2 -3" stroke="#fff" stroke-width="1.3" fill="none"/>
    <path d="M-23 -71 C-10 -64 10 -64 23 -71" stroke="#fff" stroke-width="1" stroke-dasharray="1.5 3" fill="none"/>
    <path class="scarf-tail" d="M-12 -72 C-19 -56 -26 -40 -36 -22 L-23 -17 C-15 -35 -9 -52 -2 -68 Z" fill="#c8283d"/>
    <path d="M-13 -62 l9 3 M-18 -51 l10 3 M-23 -40 l10 4 M-28 -30 l10 4" stroke="#fff" stroke-width="1.5"/>
    <path d="M-16 -57 l2 2 l2 -2 M-21 -46 l2 2 l2 -2 M-26 -35 l2 2 l2 -2" stroke="#fff" stroke-width="1" fill="none"/>
    <path d="M-34 -21 l-2 7 M-31 -20 l-1.5 7 M-28 -19 l-1 7 M-25 -18 l-.5 7" stroke="#c8283d" stroke-width="2" stroke-linecap="round"/>
    <!-- cocoa mug with marshmallows and heart-shaped steam -->
    <g transform="translate(62 -2)">
      <path class="steam heart" d="M0 -40 C-2 -47 -12 -49 -12 -57 C-12 -64 -3 -65 0 -59 C3 -65 12 -64 12 -57 C12 -49 2 -47 0 -40"
            stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path class="steam s2" d="M-8 -36 q-5 -8 0 -15 q5 -7 0 -14" stroke="#fff" stroke-width="1.6" fill="none" opacity=".6" stroke-linecap="round"/>
      <path d="M-15 -31 h30 l-2.5 29 q-12.5 6 -25 0 Z" fill="#d62f45"/>
      <path d="M15 -24 q12 0 11 9 q-1 9 -12 7" stroke="#d62f45" stroke-width="4" fill="none"/>
      <ellipse cx="0" cy="-31" rx="15" ry="3.6" fill="#5a3018"/>
      <rect x="-9" y="-36" width="6" height="5" rx="1.6" fill="#fff"/><rect x="-2" y="-37" width="6" height="5" rx="1.6" fill="#f4f4f4"/>
      <rect x="5" y="-35" width="6" height="5" rx="1.6" fill="#fff"/>
      <path d="M0 -24 v15 M-7 -16.5 h14 M-5 -22 l10 11 M5 -22 l-10 11" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M-3 -24 l3 2 l3 -2 M-3 -9 l3 -2 l3 2" stroke="#fff" stroke-width="1" fill="none"/>
    </g>
  </g>

</svg>`;
  }

  // C9-style bulbs hanging from a swagged wire, colors from a classic string of lights
  function garland() {
    const colors = ["#e8384f", "#ffd34d", "#2fbf71", "#3f8cff", "#ff8a2b", "#a66bff"];
    const swags = [[-10, 300], [300, 600], [600, 900], [900, 1210]];
    let wire = "", bulbs = "", k = 0;
    for (const [x0, x1] of swags) {
      const cx = (x0 + x1) / 2, y0 = 4, cy = 52;
      wire += `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y0} `;
      for (const t of [.14, .32, .5, .68, .86]) {
        const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1;
        const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y0;
        const tilt = (t - .5) * 50, c = colors[k % colors.length];
        bulbs += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt.toFixed(0)})">
          <rect x="-2.6" y="0" width="5.2" height="5" rx="1" fill="#2f4f3a"/>
          <path class="c9" style="animation-delay:${(k % 7) * .29}s" d="M0 4 C-6 8 -7 16 0 23 C7 16 6 8 0 4 Z" fill="${c}"/>
          <path d="M-2 9 C-3 12 -3 15 -1.5 17" stroke="#fff" stroke-width="1.2" opacity=".55" fill="none" stroke-linecap="round"/></g>`;
        k++;
      }
    }
    return `<path d="${wire}" stroke="#20372a" stroke-width="1.8" fill="none"/>${bulbs}`;
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

  /* ------------------------------------------------------------ energy scene (Market page)
     A Houston-style energy landscape, original SVG: skyline, refinery with a
     flare, pump jacks feeding a pipeline, wind turbines, and an LNG tanker. */
  function energySVG() {
    const stars = Array.from({ length: 60 }, (_, i) => {
      const x = (i * 197) % 1200, y = (i * 83) % 230, r = (i % 5 === 0) ? 1.6 : .9;
      return `<circle class="twinkle" style="animation-delay:${(i % 9) * .37}s" cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`;
    }).join("");

    // skyline: [x, width, height above the 352 baseline]
    const B = [[500, 34, 70], [538, 40, 120], [582, 30, 95], [616, 46, 165], [666, 36, 130],
               [706, 52, 190], [762, 34, 150], [800, 44, 110], [848, 30, 80]];
    let sky = "", wins = "", k = 0;
    B.forEach(([x, w, h], i) => {
      const top = 352 - h, fill = i % 2 ? "#143f73" : "#0f3160";
      sky += `<rect x="${x}" y="${top}" width="${w}" height="${h + 40}" fill="${fill}"/>`;
      if (i === 5) sky += `<path d="M${x + w / 2 - 7} ${top} l7 -30 l7 30 Z" fill="${fill}"/>`;
      if (i === 3) sky += `<rect x="${x + 8}" y="${top - 12}" width="${w - 16}" height="12" fill="${fill}"/>
        <rect x="${x + 16}" y="${top - 22}" width="${w - 32}" height="10" fill="${fill}"/>`;
      if (i === 1) sky += `<path d="M${x} ${top} L${x + w} ${top - 16} V${top} Z" fill="${fill}"/>`;
      for (let wy = top + 8; wy < 340; wy += 11) for (let wx = x + 5; wx < x + w - 6; wx += 8) {
        k++;
        if ((k * 7 + i * 3) % 5 === 0) continue;
        wins += `<rect class="win" style="--d:${((k * 13) % 29) * .05}s" x="${wx}" y="${wy}" width="4" height="6" fill="#ffd479"/>`;
      }
    });

    const turbine = (x, base, h, dur) => `<g class="turbine" transform="translate(${x} ${base - h})" tabindex="0" role="button"
        aria-label="Wind turbine: click to spin it up">
      <circle r="${h * .5}" fill="transparent"/>
      <path d="M-3.2 ${h} L-1.6 0 h3.2 L3.2 ${h} Z" fill="#eef5fb"/>
      <g class="blades" style="animation-duration:${dur}s">
        ${[0, 120, 240].map(a => `<path transform="rotate(${a})" d="M0 0 C5 -${h * .14} 4 -${h * .42} 0 -${h * .5} C-2 -${h * .3} -2.5 -${h * .1} 0 0 Z" fill="#ffffff"/>`).join("")}
      </g>
      <circle r="4" fill="#cfe2f3"/>
    </g>`;

    const jack = (x, base, s, delay) => `<g class="jack" transform="translate(${x} ${base}) scale(${s})">
      <rect x="-42" y="-4" width="88" height="5" rx="2" fill="#0f3160"/>
      <path d="M-12 -4 L0 -46 L12 -4 M-7 -22 H7" stroke="#16467e" stroke-width="4" fill="none" stroke-linejoin="round"/>
      <rect x="-42" y="-24" width="19" height="20" rx="2" fill="#16467e"/>
      <g class="beam" style="animation-delay:${delay}s">
        <path d="M-34 -46 H30" stroke="#2a74b0" stroke-width="5.5" stroke-linecap="round"/>
        <path d="M29 -60 Q47 -46 35 -29 L29 -34 Z" fill="#2a74b0"/>
        <path d="M-32 -46 V-16" stroke="#7cc4e4" stroke-width="2.5"/>
      </g>
      <path d="M38 -30 V-4" stroke="#5e9bd8" stroke-width="1.5"/>
      <rect x="33" y="-9" width="10" height="9" rx="1" fill="#0f3160"/>
    </g>`;

    const domes = [-58, -24, 10, 44].map(x => `<path d="M${x - 15} -14 A15 15 0 0 1 ${x + 15} -14 Z" fill="#eef5fb"/>
      <path d="M${x - 9} -22 A12 12 0 0 1 ${x + 2} -28" stroke="#fff" stroke-width="1.5" fill="none" opacity=".8"/>`).join("");
    const flecks = Array.from({ length: 30 }, (_, i) =>
      `<circle cx="${(i * 263) % 640}" cy="${394 + (i * 37) % 50}" r="${i % 3 ? 1.3 : 2}" fill="${i % 4 ? "#5cc69a" : "#2f8f6b"}" opacity=".7"/>`).join("");

    return `
<svg class="scene-art" viewBox="0 0 1200 460" preserveAspectRatio="xMidYMax slice" role="img"
     aria-label="A Houston energy landscape at night: a skyline, a refinery flare, pump jacks, a pipeline, wind turbines and an LNG tanker">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#050d1c"/><stop offset=".45" stop-color="#0b2a55"/>
      <stop offset=".8" stop-color="#1f5d9c"/><stop offset="1" stop-color="#9fcbee"/>
    </linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#e9f6ff" stop-opacity=".9"/>
      <stop offset=".3" stop-color="#7cc4e4" stop-opacity=".4"/><stop offset="1" stop-color="#1f5d9c" stop-opacity="0"/></radialGradient>
    <radialGradient id="flareGlow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".85"/>
      <stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
    <linearGradient id="hillA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b7cc4"/><stop offset="1" stop-color="#16467e"/></linearGradient>
    <linearGradient id="hillB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfe2f3"/></linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a74b0"/><stop offset="1" stop-color="#0b2a55"/></linearGradient>
  </defs>

  <rect width="1200" height="460" fill="url(#sky)"/>
  ${stars}
  <circle cx="930" cy="74" r="70" fill="url(#glow)"/><circle cx="930" cy="74" r="20" fill="#eef7ff"/>

  <path d="M0 330 Q180 268 380 318 T760 300 T1200 312 V460 H0 Z" fill="url(#hillA)" opacity=".9"/>
  ${turbine(940, 322, 150, 9)}${turbine(1040, 316, 195, 11)}${turbine(1140, 322, 130, 8)}

  <g class="skyline">${sky}${wins}</g>

  <g class="refinery">
    <rect x="424" y="262" width="14" height="130" rx="6" fill="#143f73"/>
    <rect x="444" y="288" width="11" height="104" rx="5" fill="#0f3160"/>
    <path d="M424 290 h14 M424 310 h14 M424 330 h14" stroke="#2a74b0" stroke-width="1.5"/>
    <circle cx="474" cy="342" r="15" fill="#143f73"/><path d="M464 340 A12 12 0 0 1 474 330" stroke="#2a74b0" stroke-width="1.5" fill="none"/>
    <path d="M406 392 V238" stroke="#143f73" stroke-width="4"/>
    <g transform="translate(406 236)">
      <g class="flare" tabindex="0" role="button" aria-label="Flare stack: click for sparks">
        <circle class="flare-glow" r="24" fill="url(#flareGlow)"/>
        <path class="flame" d="M0 2 C-9 -6 -4 -16 0 -27 C3 -17 10 -8 0 2 Z" fill="#ffb347"/>
        <path class="flame f2" d="M0 1 C-4 -4 -2 -9 0 -15 C2 -9 5 -4 0 1 Z" fill="#fff1b8"/>
      </g>
    </g>
  </g>

  <path d="M0 372 Q240 338 470 366 Q640 384 820 360 Q1020 336 1200 366 V460 H0 Z" fill="url(#hillB)"/>
  ${flecks}

  <!-- pipeline from the wells to the refinery -->
  <path d="M60 386 H300 Q350 386 378 372 L404 362" stroke="#5e9bd8" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path class="flow" d="M60 386 H300 Q350 386 378 372 L404 362" stroke="#ffffff" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M100 386 v8 M180 386 v8 M260 386 v8" stroke="#2f5f9a" stroke-width="3"/>
  ${jack(120, 380, 1, 0)}${jack(262, 384, .82, -1.3)}

  <!-- ship channel and LNG tanker -->
  <path d="M640 460 Q720 420 840 412 Q1010 402 1200 406 V460 Z" fill="url(#water)"/>
  <path class="wave" d="M700 446 q10 -5 20 0 t20 0 M900 452 q10 -5 20 0 t20 0 M1080 440 q10 -5 20 0 t20 0 M800 430 q8 -4 16 0 t16 0"
        stroke="#a6dbf2" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>
  <g transform="translate(990 432)">
    <g class="tanker">
      <rect x="62" y="-38" width="20" height="24" rx="2" fill="#f4f9ff"/>
      <path d="M66 -32 h12 M66 -26 h12" stroke="#2a74b0" stroke-width="2"/>
      <rect x="69" y="-48" width="6" height="10" fill="#7cc4e4"/>
      ${domes}
      <path d="M-92 -14 H90 L100 -14 L88 4 H-82 Z" fill="#0f3160"/>
      <path d="M-84 0 H90" stroke="#7cc4e4" stroke-width="2.5"/>
      <text x="-30" y="-3" font-size="8" font-family="Arial, sans-serif" font-weight="700" fill="#a6dbf2" letter-spacing="2">LNG</text>
    </g>
  </g>
</svg>`;
  }

  function buildEnergyScene() {
    const footer = document.createElement("footer");
    footer.className = "scene energy";
    footer.innerHTML = `
      <div class="scene-stage" tabindex="0" aria-label="Hover or tap to power up the scene and read Clarence's note">
        ${energySVG()}
        <div class="note" aria-live="polite">
          ${QUOTE.map((l, i) => `<span class="note-line ${l.cls}" style="--i:${i}">${l.t}</span>`).join("")}
        </div>
        <div class="scene-hint">✦ hover to power up · click a turbine or the flare</div>
      </div>
      <div class="pipe-band" aria-hidden="true"></div>`;
    document.body.appendChild(footer);

    const stage = footer.querySelector(".scene-stage");
    const snow = addSnow(stage, { density: 6500, green: 0.1, wind: 0.35 });
    const onKey = fn => e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

    stage.addEventListener("click", e => {
      if (e.target.closest(".turbine, .flare")) return;
      if (matchMedia("(hover: none)").matches) stage.classList.toggle("on");
    });
    footer.querySelectorAll(".turbine").forEach(t => {
      const spin = () => { t.classList.toggle("fast"); stage.classList.add("on"); };
      t.addEventListener("click", spin);
      t.addEventListener("keydown", onKey(spin));
    });
    const flare = footer.querySelector(".flare");
    const sparks = () => {
      const r = flare.getBoundingClientRect(), s = stage.getBoundingClientRect();
      snow.burst(r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, 55, "255,190,90");
      flare.classList.remove("burst"); void flare.getBBox(); flare.classList.add("burst");
      stage.classList.add("on");
    };
    flare.addEventListener("click", sparks);
    flare.addEventListener("keydown", onKey(sparks));
    stage.addEventListener("mouseleave", () => stage.classList.remove("on"));
    if (location.hash === "#clarence") stage.classList.add("on");
  }

  function buildScene() {
    if (/market\.html$/.test(location.pathname)) return buildEnergyScene();
    const footer = document.createElement("footer");
    footer.className = "scene";
    footer.innerHTML = `
      <div class="scene-stage" tabindex="0" aria-label="Hover or tap to read Clarence's note">
        ${sceneSVG()}
        <svg class="garland-art" viewBox="0 0 1200 80" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${garland()}</svg>
        <div class="note" aria-live="polite">
          ${QUOTE.map((l, i) => `<span class="note-line ${l.cls}" style="--i:${i}">${l.t}</span>`).join("")}
        </div>
        <div class="scene-hint">✦ hover to read · click the little tree · wave at the bear</div>
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
    const bear = footer.querySelector(".bear");
    const wave = () => { bear.classList.add("wave"); clearTimeout(bear._t); bear._t = setTimeout(() => bear.classList.remove("wave"), 3200); };
    bear.addEventListener("click", wave);
    bear.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); wave(); } });
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
