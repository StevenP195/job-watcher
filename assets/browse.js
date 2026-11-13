/* Browse page: open postings with a role switch, employer / location /
   days-open filters, title search, first-seen sort, apply links, and a
   starred shortlist saved in localStorage. */

(async () => {
  const $ = id => document.getElementById(id);
  const { esc, isTrue, isHouston, fmtDate, n, store } = JW;
  let rows;
  try { rows = await JW.loadHistory(); } catch (e) { return JW.showError(e); }

  const last = JW.lastRunDate(rows);
  const open = rows.filter(r => r.status === "open").map(r => ({ ...r, days: JW.daysBetween(r.first_seen, last) }));
  let shortlist = new Set(store.get("jw-shortlist", []));

  $("h-open").textContent = n(open.length);
  $("h-role").textContent = n(open.filter(r => isTrue(r.in_role)).length);

  /* ---------- filter options ---------- */
  const countBy = (xs, f) => xs.reduce((m, x) => m.set(f(x), (m.get(f(x)) || 0) + 1), new Map());
  const employers = [...countBy(open, r => r.employer)].sort((a, b) => a[0].localeCompare(b[0]));
  $("employer").innerHTML = `<option value="">All employers</option>` +
    employers.map(([e, c]) => `<option value="${esc(e)}">${esc(e)} (${c})</option>`).join("");

  // presets first, then the most common individual locations
  const PRESETS = [
    ["", "All locations"],
    ["@houston", "Houston area"],
    ["@texas", "Texas (any city)"],
    ["@remote", "Remote"],
  ];
  const locs = [...countBy(open, r => r.location || "(not given)")].sort((a, b) => b[1] - a[1]).slice(0, 60);
  $("loc").innerHTML = PRESETS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("") +
    `<option disabled>──────────</option>` +
    locs.map(([l, c]) => `<option value="=${esc(l)}">${esc(l.length > 48 ? l.slice(0, 47) + "…" : l)} (${c})</option>`).join("");

  const locMatch = {
    "@houston": r => isHouston(r),
    "@texas": r => /\b(TX|Texas)\b/i.test(r.location),
    "@remote": r => /remote|virtual/i.test(r.location),
  };

  /* ---------- state (remembered per browser) ---------- */
  const state = Object.assign({ role: "role", q: "", employer: "", loc: "", days: "any", sort: "desc" },
                              store.get("jw-browse", {}));
  state.q = "";
  $("q").value = ""; $("employer").value = state.employer; $("loc").value = state.loc;
  $("days").value = state.days; $("sort").value = state.sort;
  if ($("employer").value !== state.employer) state.employer = "";
  if ($("loc").value !== state.loc) state.loc = "";

  const seg = $("role");
  const syncSeg = () => seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === state.role));
  syncSeg();

  /* ---------- render ---------- */
  const PAGE = 150;
  let shown = PAGE;

  function filtered() {
    const q = state.q.trim().toLowerCase();
    const [lo, hi] = state.days === "any" ? [0, Infinity] : state.days.split("-").map(Number);
    return open.filter(r =>
      (state.role === "all" || (state.role === "role" ? isTrue(r.in_role) : shortlist.has(r.posting_id))) &&
      (!q || r.title.toLowerCase().includes(q)) &&
      (!state.employer || r.employer === state.employer) &&
      (!state.loc || (state.loc.startsWith("=") ? (r.location || "(not given)") === state.loc.slice(1) : locMatch[state.loc](r))) &&
      r.days >= lo && r.days <= hi
    ).sort((a, b) => (state.sort === "desc" ? b.first_seen.localeCompare(a.first_seen) : a.first_seen.localeCompare(b.first_seen))
                      || a.employer.localeCompare(b.employer) || a.title.localeCompare(b.title));
  }

  function row(r) {
    const on = shortlist.has(r.posting_id);
    const days = isTrue(r.first_run) ? `≥ ${r.days}` : r.days;
    return `<tr>
      <td><button class="star" data-id="${esc(r.posting_id)}" aria-pressed="${on}" title="${on ? "Remove from" : "Add to"} shortlist">★</button></td>
      <td><div style="font-weight:600">${esc(r.title)}</div>
        <div class="muted small">${esc(r.employer)}${r.department ? " · " + esc(r.department) : ""}
        ${isTrue(r.in_role) ? ' <span class="pill role">My role</span>' : ""}</div>
        <div class="show-sm muted small">${esc(r.location || "—")} · first seen ${fmtDate(r.first_seen)}</div></td>
      <td class="small hide-sm">${esc(r.location || "—")}</td>
      <td class="num small hide-sm">${fmtDate(r.first_seen)}</td>
      <td class="num">${days}</td>
      <td class="num small hide-sm muted">${r.posted_date ? fmtDate(r.posted_date) : "—"}</td>
      <td><a class="apply" href="${esc(r.url)}" target="_blank" rel="noopener">Apply ↗</a></td></tr>`;
  }

  function render() {
    store.set("jw-browse", { ...state, q: "" });
    const data = filtered();
    $("count").textContent = `${n(data.length)} posting${data.length === 1 ? "" : "s"}`;
    $("h-star").textContent = n(shortlist.size);
    $("rows").innerHTML = data.length ? data.slice(0, shown).map(row).join("")
      : `<tr><td colspan="7" class="empty">${state.role === "star"
          ? "No starred postings match. Click ★ on any posting to add it to your shortlist."
          : "No postings match these filters."}</td></tr>`;
    $("more").innerHTML = data.length > shown
      ? `<button class="apply" style="border:0;cursor:pointer" id="more-btn">Show more (${n(data.length - shown)} left)</button>` : "";
    if (data.length > shown) $("more-btn").onclick = () => { shown += PAGE; render(); };
  }

  /* ---------- events ---------- */
  seg.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.role = b.dataset.v; shown = PAGE; syncSeg(); render();
  });
  for (const id of ["employer", "loc", "days", "sort"]) {
    $(id).addEventListener("change", e => { state[id] = e.target.value; shown = PAGE; render(); });
  }
  $("q").addEventListener("input", e => { state.q = e.target.value; shown = PAGE; render(); });
  $("rows").addEventListener("click", e => {
    const b = e.target.closest(".star"); if (!b) return;
    const id = b.dataset.id;
    shortlist.has(id) ? shortlist.delete(id) : shortlist.add(id);
    store.set("jw-shortlist", [...shortlist]);
    b.setAttribute("aria-pressed", shortlist.has(id));
    $("h-star").textContent = n(shortlist.size);
    if (state.role === "star") render();
  });

  render();
})();
