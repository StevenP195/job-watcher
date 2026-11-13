/* Shared code for all three pages: navigation bar, theme, data loading,
   CSV parsing, date helpers, and service worker registration. */

const JW = (() => {
  const PAGES = [
    { href: "index.html", label: "Today" },
    { href: "browse.html", label: "Browse" },
    { href: "market.html", label: "Market" },
    { href: "news.html", label: "News" },
  ];

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
    },
  };

  /* ---------- theme ---------- */
  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }
  applyTheme(store.get("jw-theme", "auto"));

  function currentTheme() {
    const t = document.documentElement.dataset.theme;
    if (t) return t;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  /* ---------- navigation (one bar, injected on every page) ---------- */
  function renderNav() {
    const here = location.pathname.split("/").pop() || "index.html";
    const links = PAGES.map(p =>
      `<a href="${p.href}"${p.href === here ? ' aria-current="page"' : ""}>${p.label}</a>`).join("");
    const el = document.getElementById("nav");
    el.className = "nav";
    el.innerHTML = `
      <div class="offline-banner">Offline — showing the last data this device loaded.</div>
      <div class="nav-inner">
        <a class="brand" href="index.html" aria-label="Job Watcher home"><img src="assets/icons/icon-192.png" alt="">
          <span class="brand-name">Job Watcher</span> <small>· Houston credit &amp; banking</small></a>
        <nav class="nav-links">${links}</nav>
        <button class="icon-btn" id="theme-btn" title="Toggle light / dark">◐</button>
      </div>`;
    document.getElementById("theme-btn").addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next); store.set("jw-theme", next);
      document.dispatchEvent(new CustomEvent("jw-theme"));
    });
  }

  /* ---------- data ---------- */
  async function fetchData(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    if (res.headers.get("X-JW-Offline")) document.body.classList.add("offline");
    return res;
  }

  async function loadStatus() { return (await fetchData("data/status.json")).json(); }
  async function loadHistory() { return parseCSV(await (await fetchData("data/history.csv")).text()); }

  /* RFC 4180 CSV parser -> array of objects keyed by header */
  function parseCSV(text) {
    const rows = []; let row = [], field = "", i = 0, q = false;
    while (i < text.length) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
      i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    const [head, ...body] = rows.filter(r => r.length > 1 || r[0] !== "");
    return body.map(r => Object.fromEntries(head.map((h, k) => [h, r[k] ?? ""])));
  }

  /* ---------- helpers ---------- */
  const isTrue = v => v === true || String(v).toLowerCase() === "true";
  const isHouston = r => /houston/i.test(r.location || "");
  const toDay = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const daysBetween = (a, b) => Math.round((toDay(b) - toDay(a)) / 86400000);
  const lastRunDate = rows => rows.reduce((m, r) =>
    [r.last_seen, r.removed_date].reduce((mm, d) => (d && d > mm ? d : mm), m), "");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = s => s ? new Date(toDay(s)).toLocaleDateString(undefined,
    { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";
  const fmtTime = iso => iso ? new Date(iso).toLocaleString(undefined,
    { dateStyle: "medium", timeStyle: "short" }) : "—";
  const n = x => Number(x).toLocaleString();
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function dateRange(start, end) {
    const out = [];
    for (let t = toDay(start); t <= toDay(end); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
    return out;
  }

  function showError(err) {
    const main = document.querySelector("main");
    main.insertAdjacentHTML("afterbegin", `<div class="card"><h2>Could not load the data</h2>
      <p class="sub">${esc(err.message)}. If you opened the file directly, run
      <code>python -m jobwatcher serve</code> and visit http://localhost:8000.</p></div>`);
  }

  /* ---------- install / offline ---------- */
  if ("serviceWorker" in navigator) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
  addEventListener("offline", () => document.body.classList.add("offline"));
  addEventListener("online", () => document.body.classList.remove("offline"));

  document.addEventListener("DOMContentLoaded", renderNav);

  return { store, loadStatus, loadHistory, parseCSV, isTrue, isHouston, daysBetween, lastRunDate,
           esc, fmtDate, fmtTime, n, css, dateRange, showError, currentTheme };
})();
