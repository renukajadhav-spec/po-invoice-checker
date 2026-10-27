// ---------- Dashboard: checks in the chosen period ----------
const ymd = d => d.toLocaleDateString("en-CA"); // local date as YYYY-MM-DD
const localDay = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

// From / To dates for each Period choice (Custom keeps whatever dates are typed in)
function dashRange(period) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const day = (yy, mm, dd) => ymd(new Date(yy, mm, dd));
  switch (period) {
    case "month":     return { from: day(y, m, 1), to: ymd(now) };
    case "lastMonth": return { from: day(y, m - 1, 1), to: day(y, m, 0) };
    case "7":         return { from: day(y, m, d - 6), to: ymd(now) };
    case "30":        return { from: day(y, m, d - 29), to: ymd(now) };
    case "year":      return { from: day(y, 0, 1), to: ymd(now) };
    case "all":       return { from: "", to: "" };
  }
}

function fillDashDates() {
  const r = dashRange($("dashPeriod").value);
  if (r) { $("dashFrom").value = r.from; $("dashTo").value = r.to; }
}

let dashAsk = 0;
async function loadDashboard() {
  const ask = ++dashAsk;
  const from = $("dashFrom").value, to = $("dashTo").value;
  if (from && to && from > to) { $("dashNote").textContent = "From date must be on or before the To date."; return; }

  // The whole To day counts: up to midnight at the start of the next day
  let q = db.from("check_history").select("verdict, failed_checks");
  if (from) q = q.gte("checked_at", localDay(from).toISOString());
  if (to) { const end = localDay(to); end.setDate(end.getDate() + 1); q = q.lt("checked_at", end.toISOString()); }
  const { data, error } = await q;
  if (ask !== dashAsk) return;
  if (error) { $("dashNote").textContent = "Could not load the dashboard: " + error.message; return; }
  $("dashRange").textContent = from || to ? `Showing ${from ? showDate(from) : "the start"} – ${to ? showDate(to) : "today"}` : "Showing all time";

  const n = data.length;
  const hold = data.filter(h => h.verdict === "Hold").length;
  const counts = {};
  data.forEach(h => h.failed_checks.forEach(c => counts[c] = (counts[c] || 0) + 1));
  const [top, topN] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [];
  const readyPct = n ? Math.round((n - hold) / n * 100) : 0;

  $("dashChecks").textContent = n;
  $("dashReady").textContent = n ? readyPct + "%" : "—";
  $("dashReadyN").textContent = n ? `${n - hold} of ${n}` : "";
  $("dashHold").textContent = n ? (100 - readyPct) + "%" : "—";
  $("dashHoldN").textContent = n ? `${hold} of ${n}` : "";
  $("dashTop").textContent = top || "—";
  $("dashTopN").textContent = top ? `failed ${topN} time${topN > 1 ? "s" : ""}` : "";
  $("dashNote").textContent = n ? "" : "No checks in this period.";
}

$("dashPeriod").addEventListener("change", () => { fillDashDates(); loadDashboard(); });
["dashFrom", "dashTo"].forEach(id => $(id).addEventListener("change", () => { $("dashPeriod").value = "custom"; loadDashboard(); }));
fillDashDates();
