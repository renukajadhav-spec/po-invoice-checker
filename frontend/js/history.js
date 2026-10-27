// ---------- History (Supabase table check_history, see docs/check_history.sql) ----------
// The history row being re-checked (set by its Re-check button), or null for a normal check
let recheckOf = null;

// One row per click of Check: which PO and invoice, the result, who checked it,
// and the PO and invoice as reviewed in step 2 so the check can be re-checked later
async function saveHistory({ results, header, invDate, poNo }, poDoc, invDoc) {
  const note = $("historyNote");
  note.textContent = "Saving to history…";
  const failed = results.filter(r => r.issues.length).map(r => r.name);
  const { error } = await db.from("check_history").insert({
    checked_by_email: $("userEmail").textContent,
    po_no: poNo,
    invoice_no: header.invoice_no,
    invoice_date: invDate,
    vendor_name: header.vendor_name,
    passed: results.length - failed.length,
    total: results.length,
    verdict: failed.length ? "Hold" : "Ready for manager approval",
    failed_checks: failed,
    details: results.map(r => ({ name: r.name, issues: r.issues })),
    po_data: poDoc,
    invoice_data: invDoc,
    rechecked_from: recheckOf?.id ?? null
  });
  note.textContent = error ? "Could not save to history: " + error.message : "✓ Saved to history (step 5).";
  if (!error) refreshHistory();
}

// The newest earlier check of this PO no. + invoice no. (capital/small letters ignored), or null
async function findEarlierCheck(poNo, invoiceNo) {
  const exact = s => String(s).trim().replace(/[\\%_]/g, "\\$&"); // % and _ taken literally, not as wildcards
  const { data, error } = await db.from("check_history")
    .select("checked_at, checked_by_email, passed, total, verdict")
    .ilike("po_no", exact(poNo)).ilike("invoice_no", exact(invoiceNo))
    .order("checked_at", { ascending: false }).limit(1);
  if (error) throw new Error("Could not check History for an earlier check of this PO and invoice: " + error.message);
  return data[0] || null;
}

const showTime = iso =>new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function refreshHistory() {
  loadHistory();
  fillDashDates(); // so "This month" stays right if the page was left open overnight
  loadDashboard();
}

// History rows matching the search box and the Hold only tick, newest first
function historyQuery(limit) {
  let q = db.from("check_history").select("*").order("checked_at", { ascending: false }).limit(limit);
  // Keep only characters a PO or invoice number can have, so the search text can't break the query
  const term = $("historySearch").value.replace(/[^A-Za-z0-9\/\-.]/g, "");
  if (term) q = q.or(`po_no.ilike.*${term}*,invoice_no.ilike.*${term}*`);
  if ($("holdOnly").checked) q = q.eq("verdict", "Hold");
  return q;
}

const resultText = h => `${h.passed}/${h.total} ${h.verdict === "Hold" ? "Hold" : "Ready"}`;

// A small grey line under a cell's main text
function subLine(td, text) {
  const d = document.createElement("div");
  d.className = "sub";
  d.textContent = text;
  td.appendChild(d);
  return d;
}

// "renukajadhav334" from "renukajadhav334@gmail.com", to keep History narrow
const shortName = email => String(email || "").split("@")[0];

// ---------- Re-check: load a saved PO and invoice back into step 2 ----------
function startRecheck(h) {
  recheckOf = h;
  setError("");
  renderReview("po", { ...h.po_data, how: "saved check", name: h.po_no });
  renderReview("inv", { ...h.invoice_data, how: "saved check", name: h.invoice_no });
  for (const side of ["po", "inv"]) {
    $(side + "File").value = "";
    $(side + "Name").textContent = "";
    $(side + "Status").textContent = "";
    $(side + "Drop").classList.remove("done");
  }
  $("recheckText").textContent = `Re-checking the check from ${showTime(h.checked_at)}. Correct the boxes, or upload the corrected file in step 1, then click Check.`;
  $("recheckBanner").hidden = false;
  $("review").scrollIntoView({ behavior: "smooth", block: "start" });
  updateGuide();
}

function endRecheck() {
  recheckOf = null;
  $("recheckBanner").hidden = true;
  updateGuide();
}

$("recheckCancel").addEventListener("click", endRecheck);

function smallButton(text, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "small " + cls;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

// The Re-check column: a button when the PO and invoice were saved, otherwise a dash
function recheckCell(h) {
  const td = document.createElement("td");
  if (!(h.po_data && h.invoice_data)) {
    td.className = "empty";
    td.textContent = "—";
    td.title = "Older check: the PO and invoice were not saved, so it can't be re-checked";
    return td;
  }
  const btn = smallButton("↻ Re-check", "recheck-btn", e => { e.stopPropagation(); startRecheck(h); });
  btn.title = "Load this PO and invoice into step 2 to correct or upload the corrected file";
  td.appendChild(btn);
  return td;
}

// ---------- Approval: any signed-in user can approve or reject a Ready check ----------
// The Approval column: buttons while waiting, the decision once made, or a note for Hold rows
function approvalCell(h) {
  const td = document.createElement("td");
  td.className = "approval";
  td.addEventListener("click", e => e.stopPropagation()); // clicks here don't open the row details
  if (h.verdict === "Hold") {
    td.classList.add("empty");
    td.textContent = "Fix and re-check first";
  } else if (h.approval) showDecision(td, h);
  else showDecideButtons(td, h);
  return td;
}

function showDecision(td, h) {
  td.replaceChildren();
  const ok = h.approval === "Approved";
  const d = document.createElement("div");
  d.className = "decision " + (ok ? "ok" : "no");
  d.textContent = ok ? "✓ Approved" : "✗ Rejected";
  td.appendChild(d);
  subLine(td, `by ${shortName(h.approved_by_email)} · ${showTime(h.approved_at)}`).title = h.approved_by_email;
  if (h.approval_note) subLine(td, `Reason: ${h.approval_note}`);
  td.appendChild(smallButton("Change", "change-btn", () => showDecideButtons(td, h)));
}

function showDecideButtons(td, h) {
  td.replaceChildren();
  td.append(
    smallButton("✓ Approve", "approve-btn", () => decide(td, h, "Approved", "")),
    smallButton("✗ Reject", "reject-btn", () => askReason(td, h))
  );
  if (h.approval) td.appendChild(smallButton("Cancel", "", () => showDecision(td, h)));
}

// Reject needs a reason: a small box in the cell, refused while empty
function askReason(td, h) {
  td.replaceChildren();
  const inp = document.createElement("input");
  inp.className = "edit";
  inp.placeholder = "Reason for rejecting";
  inp.setAttribute("aria-label", "Reason for rejecting");
  const confirm = smallButton("Confirm reject", "reject-btn", () => {
    if (!inp.value.trim()) { inp.classList.add("missing"); inp.focus(); return; }
    decide(td, h, "Rejected", inp.value.trim());
  });
  inp.addEventListener("keydown", e => { if (e.key === "Enter") confirm.click(); });
  td.append(inp, confirm, smallButton("Cancel", "", () => h.approval ? showDecision(td, h) : showDecideButtons(td, h)));
  inp.focus();
}

async function decide(td, h, approval, note) {
  td.querySelectorAll("button").forEach(b => b.disabled = true);
  const { data, error } = await db.from("check_history").update({
    approval,
    approval_note: note || null,
    approved_by: currentUser.id,
    approved_by_email: currentUser.email,
    approved_at: new Date().toISOString()
  }).eq("id", h.id).select("id");
  // No error but no row changed means the security rules refused it
  if (error || !data.length) {
    td.querySelectorAll("button").forEach(b => b.disabled = false);
    subLine(td, "Could not save: " + (error ? error.message : "not allowed for this check"));
    return;
  }
  refreshHistory();
}

// Each check with ✓ / ✗ and its reasons, shown under a clicked history row
function detailRow(h) {
  const tr = document.createElement("tr");
  tr.className = "detail";
  const td = tr.insertCell();
  td.colSpan = 6;
  if (!h.details) {
    td.className = "empty";
    td.textContent = "Details were not saved for this older check.";
    return tr;
  }
  h.details.forEach(d => {
    const ok = d.issues.length === 0;
    const line = document.createElement("div");
    line.className = "detail-line" + (ok ? "" : " fail");
    const b = document.createElement("b");
    b.textContent = (ok ? "✓ " : "✗ ") + d.name;
    line.appendChild(b);
    d.issues.forEach(t => { const w = document.createElement("div"); w.className = "why"; w.textContent = t; line.appendChild(w); });
    td.appendChild(line);
  });
  return tr;
}

// The latest 50 checks that match the search, newest first. A newer search replaces an older one still loading.
let historyAsk = 0;
async function loadHistory() {
  const ask = ++historyAsk;
  const body = $("historyRows");
  const message = text => {
    body.replaceChildren();
    const td = body.insertRow().insertCell();
    td.colSpan = 6;
    td.className = "empty";
    td.textContent = text;
  };
  const { data, error } = await historyQuery(50);
  if (ask !== historyAsk) return;
  if (error) return message("Could not load the history: " + error.message);
  const filtered = $("historySearch").value.trim() || $("holdOnly").checked;
  if (!data.length) return message(filtered ? "No checks match your search." : "No checks saved yet.");

  // Links between re-checks: the date of each original, and the latest re-check of each shown row
  const fromIds = data.map(h => h.rechecked_from).filter(Boolean);
  const [orig, later] = await Promise.all([
    fromIds.length ? db.from("check_history").select("id, checked_at").in("id", fromIds) : { data: [] },
    db.from("check_history").select("rechecked_from, passed, total, verdict").in("rechecked_from", data.map(h => h.id)).order("checked_at")
  ]);
  if (ask !== historyAsk) return;
  const origTime = new Map((orig.data || []).map(o => [o.id, o.checked_at]));
  const latest = new Map((later.data || []).map(r => [r.rechecked_from, r])); // oldest first, so the newest wins

  body.replaceChildren();
  data.forEach(h => {
    const tr = body.insertRow();
    const hold = h.verdict === "Hold";
    tr.className = "clickable";
    tr.tabIndex = 0;
    tr.title = "Click to see the reasons";
    const toggle = () => {
      const next = tr.nextElementSibling;
      if (next?.classList.contains("detail")) next.remove();
      else tr.after(detailRow(h));
      tr.classList.toggle("open");
    };
    tr.addEventListener("click", toggle);
    tr.addEventListener("keydown", e => { if (e.target === tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(); } });
    // 6 columns so the table fits one screen: related details share a cell
    const when = cell([showTime(h.checked_at)]);
    subLine(when, "by " + shortName(h.checked_by_email)).title = h.checked_by_email;
    if (h.rechecked_from) subLine(when, origTime.has(h.rechecked_from) ? `Re-check of ${showTime(origTime.get(h.rechecked_from))}` : "Re-check");
    tr.appendChild(when);
    const doc = cell([h.po_no, h.invoice_no]);
    subLine(doc, showDate(h.invoice_date));
    tr.appendChild(doc);
    tr.appendChild(cell([h.vendor_name]));
    const st = cell([], "pass " + (hold ? "hold" : "ok"));
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = resultText(h);
    st.appendChild(badge);
    h.failed_checks.forEach(c => subLine(st, "✗ " + c).classList.add("failed"));
    if (latest.has(h.id)) subLine(st, `Re-checked → ${resultText(latest.get(h.id))}`);
    tr.appendChild(st);
    tr.appendChild(approvalCell(h));
    tr.appendChild(recheckCell(h));
  });
}

let searchTimer;
$("historySearch").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadHistory, 300); });
$("holdOnly").addEventListener("change", loadHistory);
$("historyRefresh").addEventListener("click", refreshHistory);

// ---------- Download history as an Excel file (.xlsx) ----------
const DATE_TIME = "dd-mmm-yyyy hh:mm AM/PM", DATE_ONLY = "dd-mmm-yyyy";

// One entry per Excel column: heading, width (characters), value for a history row, date format if a date
const EXCEL_COLUMNS = [
  ["ID", 6, h => h.id],
  ["Checked on", 21, h => new Date(h.checked_at), DATE_TIME],
  ["Checked by", 28, h => h.checked_by_email],
  ["PO no.", 22, h => h.po_no],
  ["Invoice no.", 20, h => h.invoice_no],
  ["Invoice date", 13, h => localDay(h.invoice_date), DATE_ONLY],
  ["Vendor", 30, h => h.vendor_name],
  ["Passed", 8, h => h.passed],
  ["Total", 7, h => h.total],
  ["Result", 8, h => h.verdict === "Hold" ? "Hold" : "Ready"],
  ["Failed checks", 26, h => h.failed_checks.join(", ")],
  ["Reasons", 60, h => (h.details || []).flatMap(d => d.issues.map(t => `${d.name}: ${t}`)).join("; ")],
  ["Re-check of ID", 14, h => h.rechecked_from ?? ""],
  ["Approval", 11, h => h.approval || (h.verdict === "Hold" ? "" : "Waiting")],
  ["Approved by", 28, h => h.approved_by_email || ""],
  ["Approved on", 21, h => h.approved_at ? new Date(h.approved_at) : "", DATE_TIME],
  ["Approval note", 40, h => h.approval_note || ""]
];

// Excel keeps a date as a number of days since 30 Dec 1899; local time, so it matches the app
const excelDate = d => (d.getTime() - d.getTimezoneOffset() * 60000) / 86400000 + 25569;

async function downloadHistory() {
  const msg = $("historyMsg");
  msg.textContent = "Preparing the Excel file…";
  try {
    await loadScript(LIBS.xlsx);
  } catch {
    msg.textContent = "Could not load the Excel maker. Check your internet connection and try again.";
    return;
  }
  const { data, error } = await historyQuery(1000);
  if (error) { msg.textContent = "Could not download the history: " + error.message; return; }

  const rows = [EXCEL_COLUMNS.map(c => c[0])].concat(data.map(h => EXCEL_COLUMNS.map(([, , get]) => {
    const v = get(h);
    return v instanceof Date ? excelDate(v) : v;
  })));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Show the date numbers as dates
  EXCEL_COLUMNS.forEach(([, , , format], c) => {
    if (!format) return;
    for (let r = 1; r < rows.length; r++) {
      const cellRef = ws[XLSX.utils.encode_cell({ r, c })];
      if (cellRef && cellRef.t === "n") cellRef.z = format;
    }
  });
  ws["!cols"] = EXCEL_COLUMNS.map(c => ({ wch: c[1] }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: EXCEL_COLUMNS.length - 1 } }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "History");
  XLSX.writeFile(wb, `check-history-${new Date().toLocaleDateString("en-CA")}.xlsx`);
  msg.textContent = `✓ Downloaded ${data.length} check${data.length === 1 ? "" : "s"} to Excel.`;
}

$("historyExcel").addEventListener("click", downloadHistory);
