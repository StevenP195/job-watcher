/* Market page: six findings computed in the browser from history.csv.
   The definitions match jobwatcher/market.py exactly. */

(async () => {
  const { esc, isTrue, isHouston, daysBetween, fmtDate, n, css } = JW;
  let rows;
  try { rows = await JW.loadHistory(); } catch (e) { return JW.showError(e); }

  const last = JW.lastRunDate(rows);
  const first = rows.reduce((m, r) => (!m || r.first_seen < m ? r.first_seen : m), "");
  const days = first && last ? JW.dateRange(first, last) : [];
  const pct = x => (100 * x).toFixed(1) + "%";
  const median = xs => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const countBy = (xs, f) => xs.reduce((m, x) => m.set(f(x), (m.get(f(x)) || 0) + 1), new Map());
  const set = (id, h, p) => {
    document.querySelector(`#${id} .h`).textContent = h;
    document.querySelector(`#${id} .p`).innerHTML = p;
  };
  const short = d => fmtDate(d).replace(/, \d{4}$/, "");

  document.getElementById("m-last").textContent = fmtDate(last);
  document.getElementById("m-total").textContent = n(rows.length);
  document.getElementById("m-days").textContent = n(days.length);

  /* ---------- the numbers ---------- */
  const notFirst = rows.filter(r => !isTrue(r.first_run));
  const openRows = rows.filter(r => r.status === "open");

  // 1. new per day (first-run postings left out), all and my role
  const newAll = countBy(notFirst, r => r.first_seen);
  const newRole = countBy(notFirst.filter(r => isTrue(r.in_role)), r => r.first_seen);
  const newDays = days.slice(1); // day one only has first-run postings
  const totalNew = notFirst.length, totalNewRole = notFirst.filter(r => isTrue(r.in_role)).length;

  // 2. removed per day (every posting with a removed date)
  const removedBy = countBy(rows.filter(r => r.removed_date), r => r.removed_date);
  const removedRoleBy = countBy(rows.filter(r => r.removed_date && isTrue(r.in_role)), r => r.removed_date);
  const totalRemoved = rows.filter(r => r.removed_date).length;

  // 3. open per employer as of the last run
  const emp = [...countBy(openRows, r => r.employer)].sort((a, b) => b[1] - a[1]);
  const empRole = countBy(openRows.filter(r => isTrue(r.in_role)), r => r.employer);

  // 4. days open: removed, not first-run: removed_date - first_seen
  const durations = notFirst.filter(r => r.removed_date).map(r => daysBetween(r.first_seen, r.removed_date));
  const med = median(durations);

  // 5. share removed within 7 days among not-first-run postings first seen >= 7 days before the last run
  const eligible = notFirst.filter(r => daysBetween(r.first_seen, last) >= 7);
  const quick = eligible.filter(r => r.removed_date && daysBetween(r.first_seen, r.removed_date) <= 7);

  // 6. top locations among open postings
  const locs = [...countBy(openRows, r => r.location || "(not given)")].sort((a, b) => b[1] - a[1]);
  const top = locs.slice(0, 12);

  /* ---------- text ---------- */
  if (newDays.length) {
    const peak = newDays.reduce((m, d) => ((newAll.get(d) || 0) > (newAll.get(m) || 0) ? d : m), newDays[0]);
    set("s1", `${n(totalNew)} new postings in ${newDays.length} day${newDays.length > 1 ? "s" : ""} — about ${(totalNew / newDays.length).toFixed(1)} a day, ${n(totalNewRole)} in my role`,
      `A posting is new on the first day a board lists it. Postings that were already open on the first day of
       watching (first run) are left out, because they did not appear that day. The busiest day was
       ${short(peak)} with ${n(newAll.get(peak) || 0)} new postings. The blue line counts every posting; the
       green line counts only titles that pass my title rule (credit, underwriting, banking and M&amp;A analyst roles).`);
  } else {
    set("s1", `Watching began ${fmtDate(first)} — new-posting counts start with the next run`,
      `On the first day every posting is a first-run posting, which this chart leaves out. From the second
       day on, each bar counts postings first seen that day, for all postings and for my role.`);
  }

  if (totalRemoved) {
    const peak = [...removedBy].sort((a, b) => b[1] - a[1])[0];
    set("s2", `${n(totalRemoved)} postings removed so far — the most on ${short(peak[0])} (${n(peak[1])})`,
      `A posting is removed on the first day its board has a raw file but no longer lists it. This counts every
       posting with a removed date on each day, including first-run postings; ${n(rows.filter(r => r.removed_date && isTrue(r.in_role)).length)}
       of them were in my role. A posting that reappears re-opens and loses its removed date.`);
  } else {
    set("s2", "No postings have been removed yet",
      `Removals can only appear after a second day of data, when a board stops listing a posting it listed before.`);
  }

  const openTotal = openRows.length;
  if (emp.length) {
    set("s3", `${emp[0][0]} lists the most open postings: ${n(emp[0][1])} of ${n(openTotal)} (${pct(emp[0][1] / openTotal)})`,
      `Open postings per employer as of the last run (${fmtDate(last)}). The darker bar is the part in my role:
       ${emp.filter(([e]) => empRole.get(e)).sort((a, b) => (empRole.get(b[0]) || 0) - (empRole.get(a[0]) || 0)).slice(0, 3)
         .map(([e]) => `${esc(e)} (${n(empRole.get(e))})`).join(", ")} have the most in-role openings.`);
  }

  if (med !== null) {
    set("s4", `Removed postings stayed open a median of ${med} day${med === 1 ? "" : "s"}`,
      `For each removed posting that was not a first-run posting, days open = removed date − first-seen date.
       The median of the ${n(durations.length)} such postings is <b>${med}</b>. The chart shows how those durations are spread.`);
  } else {
    set("s4", "No removed postings with a known start date yet",
      `Days open needs a posting that was first seen after watching began and later removed. The median
       appears here as soon as the first such posting is taken down.`);
  }

  if (eligible.length) {
    const share = quick.length / eligible.length;
    set("s5", `${pct(share)} of postings were taken down within a week`,
      `Among postings that were not first-run postings and were first seen at least seven days before the last run
       (${n(eligible.length)} postings), ${n(quick.length)} had a removed date seven days or less after their first-seen date.`);
  } else {
    set("s5", "Not enough history yet for the seven-day share",
      `This share needs postings first seen at least seven days before the last run (and not on the first day of
       watching). With history from ${fmtDate(first)} to ${fmtDate(last)}, the first eligible postings appear about
       ${first ? fmtDate(new Date(Date.parse(first) + 8 * 86400000).toISOString().slice(0, 10)) : "a week in"}.`);
  }

  const houCount = openRows.filter(isHouston).length;
  const houRank = locs.findIndex(([l]) => /houston/i.test(l)) + 1;
  set("s6", top.length ? `${top[0][0]} is the most common location (${n(top[0][1])} open); Houston-area postings total ${n(houCount)}` : "No open postings",
    `Open postings grouped by the location text each board reports (a posting listed in several cities is
     counted once under its combined location). ${houRank ? `The largest single Houston entry ranks #${houRank}.` : ""}
     Houston-area postings in my role: <b>${n(openRows.filter(r => isHouston(r) && isTrue(r.in_role)).length)}</b>.`);

  /* ---------- charts ---------- */
  const charts = [];
  function draw() {
    charts.forEach(c => c.destroy()); charts.length = 0;
    const ink = css("--muted"), grid = css("--line"), accent = css("--accent"), green = css("--new"),
          red = css("--removed"), ice = css("--ice");
    Chart.defaults.color = ink;
    Chart.defaults.font.family = css("--font");
    Chart.defaults.borderColor = grid;
    const base = (extra = {}) => ({
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } }, tooltip: { intersect: false, mode: "index" } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } }, ...extra,
    });
    const mk = (id, cfg) => charts.push(new Chart(document.querySelector(`#${id} canvas`), cfg));

    mk("s1", { type: "line", data: { labels: newDays.map(short), datasets: [
      { label: "All postings", data: newDays.map(d => newAll.get(d) || 0), borderColor: accent, backgroundColor: accent + "33", fill: true, tension: .25 },
      { label: "My role", data: newDays.map(d => newRole.get(d) || 0), borderColor: green, backgroundColor: green, tension: .25 },
    ] }, options: base() });

    const remDays = days.slice(1);
    mk("s2", { type: "bar", data: { labels: remDays.map(short), datasets: [
      { label: "All removed", data: remDays.map(d => removedBy.get(d) || 0), backgroundColor: red, borderRadius: 4 },
      { label: "My role", data: remDays.map(d => removedRoleBy.get(d) || 0), backgroundColor: ice, borderRadius: 4 },
    ] }, options: base() });

    mk("s3", { type: "bar", data: { labels: emp.map(([e]) => e), datasets: [
      { label: "In my role", data: emp.map(([e]) => empRole.get(e) || 0), backgroundColor: accent, borderRadius: 3 },
      { label: "Other", data: emp.map(([e, c]) => c - (empRole.get(e) || 0)), backgroundColor: ice, borderRadius: 3 },
    ] }, options: base({ indexAxis: "y", scales: { x: { stacked: true, beginAtZero: true }, y: { stacked: true, grid: { display: false } } } }) });

    const bins = [["0–1", 0, 1], ["2–3", 2, 3], ["4–7", 4, 7], ["8–14", 8, 14], ["15–30", 15, 30], ["31+", 31, 1e9]];
    mk("s4", { type: "bar", data: { labels: bins.map(b => b[0] + " days"), datasets: [
      { label: "Removed postings", data: bins.map(([, lo, hi]) => durations.filter(d => d >= lo && d <= hi).length), backgroundColor: accent, borderRadius: 4 },
    ] }, options: base({ plugins: { legend: { display: false } } }) });

    mk("s5", { type: "doughnut", data: { labels: ["Removed within 7 days", "Still open or removed later"], datasets: [
      { data: eligible.length ? [quick.length, eligible.length - quick.length] : [0, 1], backgroundColor: [red, ice], borderWidth: 0 },
    ] }, options: { responsive: true, maintainAspectRatio: false, cutout: "62%",
      plugins: { legend: { position: "bottom" }, tooltip: { enabled: eligible.length > 0 } } } });

    mk("s6", { type: "bar", data: { labels: top.map(([l]) => l.length > 40 ? l.slice(0, 39) + "…" : l), datasets: [
      { label: "Open postings", data: top.map(([, c]) => c), backgroundColor: top.map(([l]) => /houston/i.test(l) ? green : accent), borderRadius: 3 },
    ] }, options: base({ indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true }, y: { grid: { display: false } } } }) });
  }
  draw();
  document.addEventListener("jw-theme", draw);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
})();
