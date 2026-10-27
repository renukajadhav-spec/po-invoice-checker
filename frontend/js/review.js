// ---------- Review step: editable tables ----------
const loadedSides = { po: false, inv: false };

function makeInput(field, value) {
  const inp = document.createElement("input");
  inp.className = "edit";
  inp.dataset.f = field;
  inp.value = value ?? "";
  inp.setAttribute("aria-label", NICE[field]);
  const mark = () => inp.classList.toggle("missing", !OPTIONAL.includes(field) && inp.value.trim() === "");
  inp.addEventListener("input", mark);
  mark();
  return inp;
}

function addItemRow(tbody, side, item = {}) {
  const tr = tbody.insertRow();
  FIELDS[side].items.forEach(k => tr.insertCell().appendChild(makeInput(k, item[k])));
  const del = document.createElement("button");
  del.type = "button";
  del.className = "small";
  del.textContent = "✕";
  del.title = "Delete this row";
  del.addEventListener("click", () => tr.remove());
  tr.insertCell().appendChild(del);
}

// A GSTIN read by OCR: amber dashed box and a hint until the user has looked at it (typed in it, or clicked in and out).
// Only a reading aid: OCR can mix up O/0, I/1, S/5, B/8, and one wrong letter changes the Vendor/Buyer result.
function markToVerify(wrap, inp) {
  inp.classList.add("verify");
  const hint = document.createElement("div");
  hint.className = "verify-hint";
  hint.textContent = "⚠ Read from an image — compare with the picture";
  wrap.appendChild(hint);
  const done = () => { inp.classList.remove("verify"); hint.remove(); };
  inp.addEventListener("input", done, { once: true });
  inp.addEventListener("blur", done, { once: true });
}

function renderReview(side, doc) {
  const box = $("review-" + side), f = FIELDS[side];
  box.replaceChildren();

  const h = document.createElement("h3");
  h.textContent = f.label;
  const how = document.createElement("div");
  how.className = "how";
  how.textContent = `Read from ${doc.how}: ${doc.name}`;
  box.append(h, how);

  const ocr = /OCR/.test(doc.how || "");
  if (ocr) {
    const warn = document.createElement("div");
    warn.className = "ocr-warn";
    warn.textContent = "⚠ Read from an image: OCR can misread letters (O/0, I/1, S/5, B/8). Check the highlighted GSTINs against the picture.";
    box.appendChild(warn);
  }

  const fields = document.createElement("div");
  fields.className = "fields";
  f.header.forEach(k => {
    const wrap = document.createElement("div");
    const lab = document.createElement("label");
    lab.textContent = NICE[k] + (OPTIONAL.includes(k) ? " (optional)" : "");
    const inp = makeInput(k, doc.header[k]);
    wrap.append(lab, inp);
    if (ocr && k.endsWith("_gstin")) markToVerify(wrap, inp);
    fields.appendChild(wrap);
  });
  box.appendChild(fields);

  const wrap = document.createElement("div");
  wrap.className = "tablewrap";
  const table = document.createElement("table");
  table.className = "items";
  const hr = table.createTHead().insertRow();
  [...f.items.map(k => NICE[k]), ""].forEach(t => { const th = document.createElement("th"); th.textContent = t; hr.appendChild(th); });
  const tbody = table.createTBody();
  doc.items.forEach(it => addItemRow(tbody, side, it));
  if (!doc.items.length) addItemRow(tbody, side);
  wrap.appendChild(table);
  box.appendChild(wrap);

  const add = document.createElement("button");
  add.type = "button";
  add.className = "small";
  add.textContent = "+ Add item row";
  add.style.marginTop = "6px";
  add.addEventListener("click", () => addItemRow(tbody, side));
  box.appendChild(add);

  if (doc.text) {
    const d = document.createElement("details");
    d.style.marginTop = "10px";
    const s = document.createElement("summary");
    s.textContent = "Show the text that was read";
    const pre = document.createElement("pre");
    pre.textContent = doc.text;
    d.append(s, pre);
    box.appendChild(d);
  }

  loadedSides[side] = true;
  $("review").style.display = "block";
  $("results").style.display = "none";
}

// Review tables → checked records (one per item, header details repeated), ready for the checks
function collectSide(side) {
  const box = $("review-" + side), f = FIELDS[side];
  const header = {};
  box.querySelectorAll(".fields .edit").forEach(i => header[i.dataset.f] = i.value.trim());
  const items = [...box.querySelectorAll("table.items tbody tr")].map(tr => {
    const it = {};
    tr.querySelectorAll(".edit").forEach(i => it[i.dataset.f] = i.value.trim());
    return it;
  }).filter(it => Object.values(it).some(v => v !== ""));

  if (!items.length) throw new Error(`${f.label}: add at least one item row.`);
  const empty = f.header.filter(k => !OPTIONAL.includes(k) && !header[k]).map(k => NICE[k]);
  items.forEach((it, n) => f.items.forEach(k => { if (!OPTIONAL.includes(k) && !it[k]) empty.push(`${NICE[k]} (row ${n + 1})`); }));
  if (empty.length) throw new Error(`${f.label}: fill in the red boxes first: ${empty.join(", ")}.`);

  return items.map((it, n) => {
    const rec = { ...header, ...it };
    for (const k of NUMBER_FIELDS) {
      if (!(k in rec)) continue;
      rec[k] = ["cgst", "sgst", "igst"].includes(k) && rec[k] === "" ? 0 : num(rec[k]);
      if (isNaN(rec[k])) throw new Error(`${f.label}, row ${n + 1}: "${NICE[k]}" is not a number.`);
    }
    rec.vendor_gstin = norm(rec.vendor_gstin);
    rec.buyer_gstin = norm(rec.buyer_gstin);
    return rec;
  });
}
