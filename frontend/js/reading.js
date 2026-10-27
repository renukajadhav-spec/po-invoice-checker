// ---------- Reading CSV files ----------
function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  row.push(cell); rows.push(row);
  return rows.filter(r => r.some(v => v.trim() !== ""));
}

// CSV text → one record (all fields as text) per item row
function toRecords(text, cols, label) {
  const rows = parseCSV(text);
  if (rows.length === 0) throw new Error(`The ${label} file is empty.`);
  const head = rows[0].map(h => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  const missing = cols.filter(c => !head.includes(c));
  if (missing.length) throw new Error(`The ${label} file is missing these columns: ${missing.join(", ")}. Start from the template.`);
  if (rows.length < 2) throw new Error(`The ${label} file has headings but no item rows.`);
  return rows.slice(1).map(r => {
    const rec = {};
    head.forEach((h, i) => rec[h] = (r[i] ?? "").trim());
    return rec;
  });
}

// Records → a document: header details from the first row, every row as an item line
function recordsToDoc(records, side) {
  const header = {}, f = FIELDS[side];
  f.header.forEach(k => header[k] = records[0][k] ?? "");
  const items = records.map(r => Object.fromEntries(f.items.map(k => [k, r[k] ?? ""])));
  return { header, items };
}

// ---------- Reading PDFs and images ----------
const LIBS = {
  pdf:       "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  ocr:       "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
  xlsx:      "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"  // SheetJS, only writes the History Excel file
};
const scriptLoads = {};
function loadScript(src) {
  return scriptLoads[src] ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => { delete scriptLoads[src]; reject(new Error("Could not load the PDF/image reader. Check your internet connection and try again.")); };
    document.head.appendChild(s);
  });
}

// pdf.js gives separate pieces of text with positions; put pieces at the same height onto one line
function groupLines(pieces) {
  const rows = [];
  for (const p of pieces) {
    const row = rows.find(r => Math.abs(r.y - p.y) < 3);
    if (row) row.pieces.push(p); else rows.push({ y: p.y, pieces: [p] });
  }
  return rows.sort((a, b) => b.y - a.y)
             .map(r => r.pieces.sort((a, b) => a.x - b.x).map(p => p.s.trim()).join("  "));
}

// One OCR worker is started once and reused; psm is Tesseract's page layout mode
let ocrWorker = null, ocrProgress = () => {};
async function ocrToLines(image, psm, progress, part) {
  await loadScript(LIBS.ocr);
  ocrProgress = m => progress(m.status === "recognizing text"
    ? `Reading the text${part}… ${Math.round(m.progress * 100)}%`
    : `Getting the text reader ready (${m.status})…`);
  ocrWorker ||= Tesseract.createWorker("eng", 1, { logger: m => ocrProgress(m) });
  const worker = await ocrWorker;
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await worker.recognize(image);
  return data.text.split("\n");
}

// OCR can miss table rows, so if no item line is found, read again with a different page layout mode
async function readByOcr(images, side, progress) {
  let best = null;
  for (const [psm, tryLabel] of [["3", ""], ["6", ", 2nd try"], ["4", ", 3rd try"]]) {
    let lines = [];
    for (let i = 0; i < images.length; i++) {
      const page = images.length > 1 ? `page ${i + 1} of ${images.length}` : "";
      const part = page || tryLabel ? ` (${[page, tryLabel.slice(2)].filter(Boolean).join(", ")})` : "";
      lines = lines.concat(await ocrToLines(images[i], psm, progress, part));
    }
    const doc = parseDocument(lines, side);
    if (!best) best = doc;
    else if (doc.items.length > best.items.length) {
      for (const k in doc.header) doc.header[k] ||= best.header[k];
      best = doc;
    }
    if (best.items.length) break;
  }
  return best;
}

// A PDF with typed text gives its lines; a scanned PDF (only pictures of pages) gives page images for OCR
async function readPdf(file) {
  await loadScript(LIBS.pdf);
  pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pieces = content.items.filter(i => i.str.trim()).map(i => ({ x: i.transform[4], y: i.transform[5], s: i.str }));
    lines = lines.concat(groupLines(pieces));
  }
  if (lines.join("").replace(/\s/g, "").length >= 20) return { lines };

  const images = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    images.push(canvas);
  }
  return { images };
}

// ---------- Finding the fields in the text that was read ----------
const GSTIN_RE = /\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]/g;
const DATE_SRC = "(\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}[-\\/.]\\d{1,2}[-\\/.]\\d{4}|\\d{1,2}[-\\s][A-Za-z]{3,9}[-\\s,]+\\d{4}|[A-Za-z]{3,9}\\.?\\s+\\d{1,2},?\\s+\\d{4})";
const BUYER_WORDS  = /bill(ed)?\s*to|buyer|customer|ship(ped)?\s*to|consignee|invoice\s*to/i;
const VENDOR_WORDS = /supplier|vendor|seller|sold\s*by/i;
const TOTAL_WORDS  = /total|round\s*off|in\s+words|balance|grand|cgst|sgst|igst|taxable/i;
const TABLE_HEAD_WORDS = /description|particulars|\bitem\b|\bhsn\b|\bqty\b|quantity/i;
// A heading on its own ("SUPPLIER", "BILL TO") or with the name after a colon ("Bill To: Sunrise …")
const HEADING_RE = /^(supplier|vendor|seller|sold\s*by|bill(?:ed)?\s*to|ship(?:ped)?\s*to(?:\s*\/\s*bill(?:ed)?\s*to)?|buyer|customer|consignee)\s*(?:[:\-]\s*(.*))?$/i;
const DOC_TITLES = /tax\s*invoice|purchase\s*order|^invoice$|original|duplicate|triplicate/i;

// Two or more spaces are kept: they separate columns that sit side by side on one line
const cleanLine = l => l.replace(/[|₹]/g, " ").replace(/\bRs\.?/gi, " ").replace(/\t/g, "  ").replace(/ {3,}/g, "  ").trim();
const columns = l => l.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);

function valueAfter(lines, labelSrc, valueSrc) {
  const re = new RegExp(labelSrc + "\\s*[:\\-]?\\s*" + valueSrc, "i");
  for (const l of lines) { const m = l.match(re); if (m && /\d/.test(m[1])) return m[1].replace(/[.,;:]$/, ""); }
  return "";
}

function findDate(lines, labels) {
  for (const label of labels) {
    const v = valueAfter(lines, label, DATE_SRC);
    if (v && parseDate(v)) return parseDate(v);
  }
  return "";
}

function findGstins(lines) {
  // Remember which section each GSTIN sits in (vendor or buyer); two sections side by side share one line
  let roles = [];
  const found = [];
  for (const l of lines) {
    const b = l.search(BUYER_WORDS), v = l.search(VENDOR_WORDS);
    if (b >= 0 && v >= 0) roles = b < v ? ["buyer", "vendor"] : ["vendor", "buyer"];
    else if (b >= 0) roles = ["buyer"];
    else if (v >= 0) roles = ["vendor"];
    const gs = l.toUpperCase().replace(/\s/g, "").match(GSTIN_RE) || [];
    gs.forEach((g, i) => found.push({ g, role: roles.length > 1 ? roles[i] : roles[0] }));
  }
  const unique = [...new Map(found.map(f => [f.g, f])).values()];
  let buyer = unique.find(f => f.role === "buyer");
  const vendor = unique.find(f => f !== buyer && f.role === "vendor") || unique.find(f => f !== buyer);
  if (!buyer) buyer = unique.find(f => f !== vendor);
  return { vendor: vendor?.g || "", buyer: buyer?.g || "" };
}

// Names under headings like SUPPLIER / BILL TO (one heading, or two side by side on one line)
function findNames(lines) {
  const names = {};
  const roleOf = h => /supplier|vendor|seller|sold/i.test(h) ? "vendor" : "buyer";
  const take = (role, name) => {
    // "Kaveri Paper Mart, Nashik, Maharashtra": the name ends where the address starts
    name = (name || "").split(",")[0].replace(/\s+/g, " ").replace(/[:]$/, "").trim();
    if (!names[role] && /[A-Za-z]{3}/.test(name) && !/gstin|\bpan\b|state|address|contact|plot|road|street/i.test(name)) names[role] = name;
  };
  for (let i = 0; i < lines.length; i++) {
    const whole = lines[i].replace(/\s+/g, " ").match(HEADING_RE);
    const heads = whole ? [whole] : columns(lines[i]).map(c => c.match(HEADING_RE));
    if (!heads.length || !heads.every(Boolean)) continue;
    const next = columns(lines[i + 1] || "");
    heads.forEach((h, c) => take(roleOf(h[1]), h[2] || (heads.length > 1 ? next[c] : next.join(" "))));
  }
  return names;
}

// The company that issued the document: its letterhead at the top, or "For <company>" above the signature
function findIssuer(lines) {
  for (const l of lines.slice(0, 5)) {
    const s = l.replace(/\s+/g, " ");
    if (/[A-Za-z]{3}/.test(s) && !DOC_TITLES.test(s) && !/gstin|\bpan\b|plot|road|street|@/i.test(s)) return columns(l)[0];
  }
  for (const l of [...lines].reverse()) {
    const c = columns(l).find(c => /^for\s+[A-Za-z]/i.test(c));
    if (c) return c.replace(/^for\s+/i, "");
  }
  return "";
}

// Every number on a line, with its position (GSTINs and dates are blanked out first)
function numbersIn(line) {
  const blank = m => " ".repeat(m.length);
  const s = line.toUpperCase().replace(GSTIN_RE, blank).replace(new RegExp(DATE_SRC, "g"), blank);
  const out = [];
  const re = /(?<![A-Z\d\-\/.,])(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(\s?%)?(?![A-Z\d])/g;
  let m;
  while ((m = re.exec(s))) {
    out.push({ v: Number(m[1].replace(/,/g, "")), pct: !!m[2], idx: m.index, int: /^\d+$/.test(m[1]), digits: m[1].length });
  }
  return out;
}

const near = (a, b) => Math.abs(a - b) <= TOLERANCE;

// An item line is any line where some qty × rate = amount, whatever the column order
function parseItemLine(line, taxType) {
  if (TOTAL_WORDS.test(line)) return null;
  const nums = numbersIn(line);
  const plain = nums.filter(n => !n.pct);
  if (plain.length < 3) return null;

  let best = null;
  for (const q of plain) for (const r of plain) for (const a of plain) {
    if (q === r || q === a || r === a || !(q.v > 0 && r.v > 0 && a.v > 0)) continue;
    if (!near(q.v * r.v, a.v) || a.v < r.v) continue;
    let score = (q.idx < r.idx && r.idx < a.idx ? 2 : 0) + (q.int ? 1 : 0) - (q.v === 1 && q === plain[0] ? 1 : 0);
    if (!best || score > best.score || (score === best.score && a.v > best.a.v)) best = { q, r, a, score };
  }
  if (!best) return null;
  const { q, r, a } = best;
  const used = new Set([q, r, a]);

  const hsn = plain.find(n => !used.has(n) && n.int && [4, 6, 8].includes(n.digits) && n.idx < q.idx);
  if (hsn) used.add(hsn);

  // GST %: a % that is a GST rate, or two equal halves (CGST 9% + SGST 9% → 18%)
  const pcts = nums.filter(n => n.pct).map(n => n.v);
  let gst = pcts.find(p => p > 0 && ALL_RATES.includes(p));
  if (gst === undefined && pcts.length && ALL_RATES.includes(pcts[0] * 2)) gst = pcts[0] * 2;

  // Tax amounts: first by value (amount × rate), else by position after the amount
  const rest = plain.filter(n => !used.has(n) && n.idx > a.idx);
  const tryRates = gst !== undefined ? [gst] : ALL_RATES.filter(x => x > 0);
  let cgst = "", sgst = "", igst = "";
  for (const g of tryRates) {
    const halves = rest.filter(n => near(n.v, a.v * g / 200));
    const full = rest.find(n => near(n.v, a.v * g / 100));
    if (halves.length >= 2) { cgst = halves[0].v; sgst = halves[1].v; igst = 0; gst ??= g; break; }
    if (full) { igst = full.v; cgst = 0; sgst = 0; gst ??= g; break; }
  }
  if (cgst === "" && igst === "") {
    if (taxType === "cs" && rest.length >= 2) { cgst = rest[0].v; sgst = rest[1].v; igst = 0; }
    else if (taxType === "i" && rest.length >= 1) { igst = rest[0].v; cgst = 0; sgst = 0; }
  }

  const firstIdx = Math.min(...[...used].map(n => n.idx));
  const item = line.slice(0, firstIdx).replace(/^\s*\d+[.)]?\s+/, "").replace(/[^A-Za-z0-9)]+$/, "").trim();

  return { item, hsn: hsn ? String(hsn.v) : "", qty: q.v, rate: r.v, amount: a.v, gst_rate: gst ?? "", cgst, sgst, igst };
}

// The last amount on a line such as "CGST @ 9% 4,590.00"
function lastAmount(line) {
  const plain = numbersIn(line).filter(n => !n.pct);
  return plain.length ? plain[plain.length - 1].v : null;
}

function parseDocument(rawLines, side) {
  const lines = rawLines.map(cleanLine).filter(Boolean);
  const text = lines.join("\n");
  const g = findGstins(lines);
  const taxType = /\bCGST\b/i.test(text) ? "cs" : /\bIGST\b/i.test(text) ? "i" : "";

  const names = findNames(lines);
  const issuer = findIssuer(lines); // a PO is issued by the buyer, an invoice by the vendor

  const header = {
    po_no: valueAfter(lines, "(?:\\bP\\.?\\s?O\\.?|Purchase\\s+Order|Order)\\s*(?:No\\.?|Number|#)", "([A-Z0-9][A-Z0-9\\-\\/]*)")
        || valueAfter(lines, "", "\\b(PO[-\\/][A-Z0-9\\-\\/]+)"),
    vendor_gstin: g.vendor,
    vendor_name: names.vendor || (side === "inv" ? issuer : ""),
    buyer_gstin: g.buyer,
    buyer_name: names.buyer || (side === "po" ? issuer : "")
  };
  if (side === "po") {
    header.po_date = findDate(lines, ["P\\.?\\s?O\\.?\\s*Date", "Order\\s*Date", "\\bDated?"]);
  } else {
    header.invoice_no = valueAfter(lines, "(?:Invoice|Inv\\.?|Bill)\\s*(?:No\\.?|Number|#)", "([A-Z0-9][A-Z0-9\\-\\/]*)")
                     || valueAfter(lines, "", "\\b(INV[-\\/][A-Z0-9\\-\\/]+)");
    header.invoice_date = findDate(lines, ["Invoice\\s*Date", "Inv\\.?\\s*Date", "Bill\\s*Date", "(?<!P\\.?O\\.?\\s|Order\\s|Due\\s)\\bDated?"]);
  }

  // A long description can wrap onto lines above and below its numbers ("Ergonomic Office Chair (Mesh" / numbers / "Back)")
  const rows = lines.map(l => parseItemLine(l, taxType));
  const at = rows.map((it, i) => it ? i : -1).filter(i => i >= 0);
  const isStop = l => TOTAL_WORDS.test(l) || TABLE_HEAD_WORDS.test(l);
  const isText = l => /[A-Za-z]/.test(l) && !isStop(l);
  const claimed = new Set();
  const textLines = (from, to, step) => {
    const out = [];
    for (let j = from; j !== to && out.length < 3; j += step) {
      if (isStop(lines[j])) break;
      if (isText(lines[j]) && !claimed.has(j)) step > 0 ? out.push(j) : out.unshift(j);
    }
    return out;
  };
  const items = at.map((i, n) => {
    const it = rows[i];
    const prev = n ? at[n - 1] : -1, next = n < at.length - 1 ? at[n + 1] : lines.length;
    let above = [], below = [];
    if (!it.item) {
      above = textLines(i - 1, prev, -1);
      below = textLines(i + 1, next, 1).slice(0, Math.max(above.length, 1));
    } else if (next === lines.length || rows[next].item) {
      below = textLines(i + 1, next, 1);
    }
    [...above, ...below].forEach(j => claimed.add(j));
    it.item = [...above.map(j => lines[j]), it.item, ...below.map(j => lines[j])].join(" ")
      .replace(/^\s*\d+[.)]?\s+/, "").replace(/\s+/g, " ").trim();
    return it;
  });

  // If the item lines had no tax amounts, use the CGST / SGST / IGST total lines, shared out by amount
  if (side === "inv" && items.length && items.every(it => it.cgst === "" && it.igst === "")) {
    const totals = { cgst: 0, sgst: 0, igst: 0 };
    let any = false;
    for (const l of lines) for (const k of ["cgst", "sgst", "igst"]) {
      if (new RegExp("\\b" + k + "\\b", "i").test(l) && !/total/i.test(l.replace(new RegExp(k, "i"), ""))) {
        const v = lastAmount(l);
        if (v !== null) { totals[k] += v; any = true; }
      }
    }
    if (any) {
      const sum = items.reduce((s, it) => s + it.amount, 0);
      for (const k in totals) {
        let left = totals[k];
        items.forEach((it, i) => {
          it[k] = i === items.length - 1 ? round2(left) : round2(totals[k] * it.amount / sum);
          left -= it[k];
        });
      }
    }
  }

  const f = FIELDS[side];
  return {
    header: Object.fromEntries(f.header.map(k => [k, header[k] ?? ""])),
    items: items.map(it => Object.fromEntries(f.items.map(k => [k, it[k] ?? ""]))),
    text: rawLines.join("\n")
  };
}
