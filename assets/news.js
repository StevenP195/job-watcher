/* News page: headlines per employer; clicking one opens what happened,
   why it matters, and how to bring it up in an interview. */

(async () => {
  const $ = id => document.getElementById(id);
  const { esc, n, store } = JW;
  let data;
  try {
    const res = await fetch("data/news.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`data/news.json: HTTP ${res.status}`);
    if (res.headers.get("X-JW-Offline")) document.body.classList.add("offline");
    data = await res.json();
  } catch (e) { return JW.showError(e); }

  const items = data.items;
  $("n-updated").textContent = JW.fmtTime(data.updated);
  $("n-count").textContent = n(items.length);
  $("n-hou").textContent = n(items.filter(i => i.scope === "houston").length);
  $("n-window").textContent = data.window_days;

  const employers = [...new Set(items.map(i => i.employer))].sort();
  $("employer").innerHTML = `<option value="">All employers</option>` +
    employers.map(e => `<option>${esc(e)}</option>`).join("");

  const state = Object.assign({ scope: "all", employer: "", group: "date", q: "" }, store.get("jw-news", {}));
  state.q = "";
  $("employer").value = state.employer; $("group").value = state.group;
  if ($("employer").value !== state.employer) state.employer = "";
  const seg = $("scope");
  const sync = () => seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === state.scope));
  sync();

  const ago = iso => {
    const h = Math.round((Date.now() - Date.parse(iso)) / 3600000);
    return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
  };

  function card(it) {
    const s = it.prep || {};
    const what = `<div class="nd-part"><h4>What happened</h4><p>${esc(s.what || "")}</p></div>`;
    return `<details class="news-item" data-id="${esc(it.id)}">
      <summary>
        <span class="news-dot ${it.scope}" title="${it.scope === "houston" ? "Houston" : "National"}"></span>
        <span class="news-main"><span class="news-title">${esc(it.title)}</span>
          <span class="news-meta">${esc(it.employer)} · ${esc(it.source || "")} · ${ago(it.published)}
          ${it.scope === "houston" ? '<span class="pill hou">Houston</span>' : ""}
          ${s.event ? `<span class="pill role">${esc(s.event)}</span>` : ""}</span></span>
        <span class="news-chev" aria-hidden="true">›</span>
      </summary>
      <div class="news-detail">
        ${what}
        <div class="nd-part"><h4>Why it’s relevant</h4><p>${esc(s.why || "")}</p></div>
        <div class="nd-part interview"><h4>How to bring it up in an interview</h4><p>${esc(s.interview || "")}</p></div>
        <a class="apply" href="${esc(it.url)}" target="_blank" rel="noopener">Read the article ↗</a>
      </div>
    </details>`;
  }

  function render() {
    store.set("jw-news", { ...state, q: "" });
    const q = state.q.trim().toLowerCase();
    const list = items.filter(i =>
      (state.scope === "all" || i.scope === state.scope) &&
      (!state.employer || i.employer === state.employer) &&
      (!q || i.title.toLowerCase().includes(q)));
    $("count").textContent = `${n(list.length)} headline${list.length === 1 ? "" : "s"}`;
    if (!list.length) { $("news").innerHTML = `<section class="card"><p class="empty">No headlines match.</p></section>`; return; }
    if (state.group === "employer") {
      const groups = {};
      list.forEach(i => (groups[i.employer] ||= []).push(i));
      $("news").innerHTML = Object.keys(groups).sort().map(e => `<section class="card">
        <div class="card-head"><h2>${esc(e)}</h2><span class="muted small">${groups[e].length} headline${groups[e].length > 1 ? "s" : ""}</span></div>
        ${groups[e].map(card).join("")}</section>`).join("");
    } else {
      $("news").innerHTML = `<section class="card">${list.map(card).join("")}</section>`;
    }
  }

  seg.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.scope = b.dataset.v; sync(); render();
  });
  $("employer").addEventListener("change", e => { state.employer = e.target.value; render(); });
  $("group").addEventListener("change", e => { state.group = e.target.value; render(); });
  $("q").addEventListener("input", e => { state.q = e.target.value; render(); });
  render();
})();
