/* Today page: last run time, source status, the four status counts,
   and the new / removed postings in the latest run. */

(async () => {
  const $ = id => document.getElementById(id);
  const { esc, isTrue, isHouston, fmtTime, fmtDate, n } = JW;
  let status, rows;
  try { [status, rows] = await Promise.all([JW.loadStatus(), JW.loadHistory()]); }
  catch (e) { return JW.showError(e); }

  const last = JW.lastRunDate(rows);
  const okCount = status.sources.filter(s => s.ok).length;

  $("run-time").textContent = fmtTime(status.run_time) + " (" + status.run_time.replace("T", " ").replace("Z", " UTC") + ")";
  $("first-run").textContent = fmtDate(status.first_run_date);
  $("sources-ok").textContent = `${okCount} of ${status.sources.length}`;
  $("t-days").textContent = n(status.days_with_success);
  $("t-open").textContent = n(status.open);
  $("t-new").textContent = n(status.new_today);
  $("t-removed").textContent = n(status.removed_today);

  const openRole = rows.filter(r => r.status === "open" && isTrue(r.in_role));
  $("t-open-hint").textContent = `${n(openRole.length)} in my role · ${n(openRole.filter(isHouston).length)} in Houston`;

  const newRows = rows.filter(r => r.first_seen === last && !isTrue(r.first_run));
  const removedRows = rows.filter(r => r.removed_date === last);
  $("t-new-hint").textContent = `${n(newRows.filter(r => isTrue(r.in_role)).length)} in my role`;
  $("t-removed-hint").textContent = `${n(removedRows.filter(r => isTrue(r.in_role)).length)} in my role`;
  $("run-date").textContent = last ? `Latest run date: ${fmtDate(last)} (UTC)` : "";

  /* source status table */
  $("sources").innerHTML = status.sources.map(s => `
    <tr><td>${esc(s.employer || s.name)}${s.error ? `<div class="muted small">${esc(s.error)}</div>` : ""}</td>
      <td class="hide-sm muted">${esc(s.name)}</td>
      <td class="hide-sm">${esc(s.ats || "")}</td>
      <td>${s.ok ? '<span class="pill ok"><span class="dot"></span>OK</span>'
                 : '<span class="pill fail"><span class="dot"></span>Failed</span>'}</td>
      <td class="num">${n(s.count)}</td></tr>`).join("");

  /* new / removed lists */
  const LIMIT = 60;
  const order = (a, b) => (isTrue(b.in_role) - isTrue(a.in_role)) || (isHouston(b) - isHouston(a))
    || a.employer.localeCompare(b.employer) || a.title.localeCompare(b.title);

  function item(r) {
    const tags = [isTrue(r.in_role) ? '<span class="pill role">My role</span>' : "",
                  isHouston(r) ? '<span class="pill hou">Houston</span>' : ""].join(" ");
    return `<li><div class="grow"><a class="t" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
      <div class="m">${esc(r.employer)}${r.location ? " · " + esc(r.location) : ""}</div></div>
      <div>${tags}</div></li>`;
  }

  function list(el, countEl, data, emptyText) {
    const sorted = [...data].sort(order);
    countEl.textContent = `${n(sorted.length)} posting${sorted.length === 1 ? "" : "s"}`;
    if (!sorted.length) { el.innerHTML = `<li class="empty">${emptyText}</li>`; return; }
    el.innerHTML = sorted.slice(0, LIMIT).map(item).join("") + (sorted.length > LIMIT
      ? `<li class="empty"><button class="seg-more" style="all:unset;cursor:pointer;color:var(--accent);font-weight:600">Show all ${n(sorted.length)}</button></li>` : "");
    const more = el.querySelector(".seg-more");
    if (more) more.onclick = () => { el.innerHTML = sorted.map(item).join(""); };
  }

  function render(scope) {
    const keep = r => scope === "all" ? true : scope === "role" ? isTrue(r.in_role) : isTrue(r.in_role) && isHouston(r);
    list($("new-list"), $("new-count"), newRows.filter(keep),
      status.days_with_success <= 1 ? "First day of watching: every posting was already open, so nothing counts as new yet."
                                    : "No new postings in this run.");
    list($("removed-list"), $("removed-count"), removedRows.filter(keep), "No postings were removed in this run.");
  }

  const seg = $("scope");
  seg.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
    JW.store.set("jw-today-scope", b.dataset.v);
    render(b.dataset.v);
  });
  const saved = JW.store.get("jw-today-scope", "all");
  seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === saved));
  render(saved);
})();
