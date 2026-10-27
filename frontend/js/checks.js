// ---------- The 7 checks ----------
function runChecks(po, inv) {
  const P = po[0], I = inv[0];
  const invDate = parseDate(I.invoice_date);
  if (!invDate) throw new Error(`The invoice date "${I.invoice_date}" is not a date I can read. Use a format like 25-09-2025.`);
  const poDate = parseDate(P.po_date);
  if (!poDate) throw new Error(`The PO date "${P.po_date}" is not a date I can read. Use a format like 25-09-2025.`);

  const poByItem = {};
  po.forEach(l => poByItem[norm(l.item)] = l);
  // The first 2 digits of a GSTIN are the state code: same state → CGST + SGST, other state → IGST
  const sameState = I.vendor_gstin.slice(0, 2) === I.buyer_gstin.slice(0, 2);
  const results = [];

  // Names compare without dots, commas and extra spaces ("Pvt. Ltd." = "Pvt Ltd")
  const sameName = (a, b) => norm(a).replace(/[.,]/g, "").replace(/\s+/g, " ") === norm(b).replace(/[.,]/g, "").replace(/\s+/g, " ");

  // 1. Vendor details: pass when the invoice vendor matches the PO vendor
  {
    const issues = [];
    if (I.vendor_gstin !== P.vendor_gstin) issues.push("vendor GSTIN on the invoice is different from the PO");
    if (!sameName(I.vendor_name, P.vendor_name)) issues.push("vendor name on the invoice is different from the PO");
    results.push({
      name: "Vendor details", issues,
      okText: "Vendor name and GSTIN are the same on the PO and the invoice",
      po: [P.vendor_name, P.vendor_gstin],
      inv: [I.vendor_name, I.vendor_gstin]
    });
  }

  // 2. Buyer details: pass when the invoice is billed to the same buyer as the PO
  {
    const issues = [];
    if (!sameName(I.buyer_name, P.buyer_name)) issues.push("buyer name on the invoice is different from the PO");
    if (I.buyer_gstin !== P.buyer_gstin) issues.push("buyer GSTIN on the invoice is different from the PO");
    results.push({
      name: "Buyer details", issues,
      okText: "Buyer name and GSTIN are the same on the PO and the invoice",
      po: [P.buyer_name, P.buyer_gstin],
      inv: [I.buyer_name, I.buyer_gstin]
    });
  }

  // 3. GST rate
  {
    const issues = [];
    const slab = GST_RATES.find(s => invDate >= s.from && (!s.to || invDate <= s.to));
    inv.forEach(l => {
      if (!slab) issues.push(`no GST rates set up for ${showDate(invDate)}`);
      else if (!slab.rates.includes(l.gst_rate)) issues.push(`${l.item}: ${l.gst_rate}% is not a valid GST rate on ${showDate(invDate)}`);
      const p = poByItem[norm(l.item)];
      if (p && p.gst_rate !== l.gst_rate) issues.push(`${l.item}: PO says ${p.gst_rate}%, invoice says ${l.gst_rate}%`);
    });
    results.push({
      name: "GST rate", issues: [...new Set(issues)],
      okText: `Same as the PO, and valid on ${showDate(invDate)}`,
      po: po.map(l => `${l.item}: ${l.gst_rate}%`),
      inv: inv.map(l => `${l.item}: ${l.gst_rate}%`).concat(`Invoice date: ${showDate(invDate)}`)
    });
  }

  // 4. GST calculation
  {
    const issues = [];
    const exp = { cgst: 0, sgst: 0, igst: 0 }, got = { cgst: 0, sgst: 0, igst: 0 };
    inv.forEach(l => {
      const tax = round2(l.amount * l.gst_rate / 100);
      const e = sameState ? { cgst: tax / 2, sgst: tax / 2, igst: 0 } : { cgst: 0, sgst: 0, igst: tax };
      for (const k in e) { exp[k] += e[k]; got[k] += l[k]; }
      const wrong = Object.keys(e).filter(k => Math.abs(e[k] - l[k]) > TOLERANCE);
      if (wrong.length) issues.push(`${l.item}: ` + wrong.map(k => `${k.toUpperCase()} should be ${money(e[k])}, invoice has ${money(l[k])}`).join("; "));
    });
    const fmt = t => sameState ? `CGST ${money(t.cgst)} + SGST ${money(t.sgst)}` + (t.igst ? ` + IGST ${money(t.igst)}` : "")
                               : `IGST ${money(t.igst)}` + (t.cgst || t.sgst ? ` + CGST ${money(t.cgst)} + SGST ${money(t.sgst)}` : "");
    results.push({
      name: "GST calculation", issues,
      okText: `Amount × rate matches the tax (${sameState ? "same state → CGST + SGST" : "other state → IGST"})`,
      po: [`Expected: ${fmt(exp)}`, sameState ? "Same state → CGST + SGST" : "Other state → IGST"],
      inv: [fmt(got)]
    });
  }

  // 5. Qty × rate
  {
    const issues = [];
    inv.forEach(l => {
      const e = round2(l.qty * l.rate);
      if (Math.abs(e - l.amount) > TOLERANCE) issues.push(`${l.item}: ${l.qty} × ${money(l.rate)} = ${money(e)}, invoice says ${money(l.amount)}`);
    });
    results.push({
      name: "Qty × rate", issues,
      okText: "Every line adds up",
      po: inv.map(l => `${l.item}: ${l.qty} × ${money(l.rate)} = ${money(round2(l.qty * l.rate))}`),
      inv: inv.map(l => `${l.item}: ${money(l.amount)}`)
    });
  }

  // 6. Items: same PO, every item ordered, rate as agreed, qty not more than ordered
  {
    const issues = [];
    if (norm(I.po_no) !== norm(P.po_no)) issues.push(`invoice is for ${I.po_no}, but this PO is ${P.po_no}`);
    const qtyByItem = {};
    inv.forEach(l => qtyByItem[norm(l.item)] = (qtyByItem[norm(l.item)] || 0) + l.qty);
    inv.forEach(l => {
      const p = poByItem[norm(l.item)];
      if (!p) { issues.push(`${l.item} is not on the PO`); return; }
      if (Math.abs(p.rate - l.rate) > 0.001) issues.push(`${l.item}: rate ${money(l.rate)}, PO rate ${money(p.rate)}`);
    });
    for (const k in qtyByItem) {
      const p = poByItem[k];
      if (p && qtyByItem[k] > p.qty) issues.push(`${p.item}: invoice qty ${qtyByItem[k]} is more than PO qty ${p.qty} (over-billing)`);
    }
    results.push({
      name: "Items", issues: [...new Set(issues)],
      okText: "Same PO, items, rates, and qty within the PO",
      po: [P.po_no].concat(po.map(l => `${l.item}: ${l.qty} × ${money(l.rate)}`)),
      inv: [`${I.po_no} (invoice ${I.invoice_no})`].concat(inv.map(l => `${l.item}: ${l.qty} × ${money(l.rate)}`))
    });
  }

  // 7. Dates: the invoice cannot be dated before its PO (same day is fine)
  {
    const issues = invDate < poDate ? [`invoice dated ${showDate(invDate)} is before the PO date ${showDate(poDate)}`] : [];
    results.push({
      name: "Dates", issues,
      okText: "Invoice is dated on or after the PO date",
      po: [`PO date: ${showDate(poDate)}`],
      inv: [`Invoice date: ${showDate(invDate)}`]
    });
  }

  return { results, header: I, invDate, poNo: P.po_no };
}

// ---------- Showing the results ----------
function cell(lines, cls) {
  const td = document.createElement("td");
  if (cls) td.className = cls;
  lines.forEach(t => { const d = document.createElement("div"); d.textContent = t; td.appendChild(d); });
  return td;
}

function showResults({ results, header, invDate }) {
  const passed = results.filter(r => r.issues.length === 0);
  const failed = results.filter(r => r.issues.length > 0);
  const s = $("summary");
  s.className = "summary " + (failed.length ? "hold" : "ok");
  s.textContent = failed.length
    ? `${passed.length} of ${results.length} checks passed → Hold, follow up with vendor`
    : `${results.length} of ${results.length} checks passed → Ready for manager approval`;
  if (failed.length) {
    const sm = document.createElement("small");
    sm.textContent = "Failed: " + failed.map(r => r.name).join(", ");
    s.appendChild(sm);
  }

  const f = $("facts");
  f.replaceChildren();
  [["Invoice", header.invoice_no], ["Date", showDate(invDate)], ["Vendor", header.vendor_name], ["PO", header.po_no]]
    .forEach(([k, v]) => { const sp = document.createElement("span"); sp.append(k + ": "); const b = document.createElement("b"); b.textContent = v; sp.appendChild(b); f.appendChild(sp); });

  // Score ring fills up and the number counts up to the passed checks
  const RING = 326.73;
  $("score").className = "score " + (failed.length ? "hold" : "ok");
  $("scoreOf").textContent = "/ " + results.length;
  $("scoreBar").style.transition = "none";
  $("scoreBar").style.strokeDashoffset = RING;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $("scoreBar").style.transition = "";
    $("scoreBar").style.strokeDashoffset = RING * (1 - passed.length / results.length);
  }));
  countUp($("scoreNum"), passed.length, 1300);

  const body = $("resultRows");
  body.replaceChildren();
  results.forEach((r, i) => {
    const ok = r.issues.length === 0;
    const tr = document.createElement("tr");
    tr.className = "row-in" + (ok ? "" : " fail");
    tr.style.animationDelay = (0.6 + i * 0.18) + "s";
    const c = document.createElement("td");
    c.className = "check";
    c.textContent = r.name;
    (ok ? [r.okText] : r.issues).forEach(t => { const w = document.createElement("div"); w.className = "why"; w.textContent = t; c.appendChild(w); });    tr.appendChild(c);
    const st = document.createElement("td");
    st.className = "pass " + (ok ? "ok" : "no");
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = ok ? "✓ Pass" : "✗ Fail";
    badge.style.animationDelay = (0.8 + i * 0.18) + "s";
    st.appendChild(badge);
    tr.appendChild(st);
    tr.appendChild(cell(r.po));
    tr.appendChild(cell(r.inv));
    body.appendChild(tr);
  });
  const res = $("results");
  res.style.display = "block";
  res.classList.remove("show");
  void res.offsetWidth; // restart the entrance animation on every Check
  res.classList.add("show");
  res.scrollIntoView({ behavior: "smooth", block: "start" });
  lastResult = { hold: failed.length > 0, score: `${passed.length}/${results.length}` };
  checkedSinceEdit = true;
  updateGuide();
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function countUp(el, to, ms) {
  if (reduceMotion) { el.textContent = to; return; }
  const start = performance.now();
  const step = now => {
    const t = Math.min(1, (now - start) / ms);
    el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}
