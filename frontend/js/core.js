// ---------- Lookup data (all fake) ----------

// GST Rates table with Valid From / Valid To (simplified: main slabs only)
const GST_RATES = [
  { from: "2017-07-01", to: "2025-09-21", rates: [0, 5, 12, 18, 28] },
  { from: "2025-09-22", to: null,         rates: [0, 5, 18, 40] }
];
const ALL_RATES = [0, 5, 12, 18, 28, 40];

// The fields on each side: header details (once per document) and item columns (once per line)
const FIELDS = {
  po:  { label: "PO",
         header: ["po_no", "po_date", "vendor_name", "vendor_gstin", "buyer_name", "buyer_gstin"],
         items:  ["item", "hsn", "qty", "rate", "gst_rate"] },
  inv: { label: "Invoice",
         header: ["invoice_no", "invoice_date", "po_no", "vendor_name", "vendor_gstin", "buyer_name", "buyer_gstin"],
         items:  ["item", "hsn", "qty", "rate", "amount", "gst_rate", "cgst", "sgst", "igst"] }
};
const PO_COLS  = [...FIELDS.po.header,  ...FIELDS.po.items];
const INV_COLS = [...FIELDS.inv.header, ...FIELDS.inv.items];
const COLS = { po: PO_COLS, inv: INV_COLS };

const NICE = {
  po_no: "PO no.", po_date: "PO date", invoice_no: "Invoice no.", invoice_date: "Invoice date",
  vendor_name: "Vendor name", vendor_gstin: "Vendor GSTIN", buyer_name: "Buyer name", buyer_gstin: "Buyer GSTIN",
  item: "Item", hsn: "HSN", qty: "Qty", rate: "Rate", amount: "Amount", gst_rate: "GST %",
  cgst: "CGST", sgst: "SGST", igst: "IGST"
};
const OPTIONAL = ["hsn", "cgst", "sgst", "igst"];
const NUMBER_FIELDS = ["qty", "rate", "amount", "gst_rate", "cgst", "sgst", "igst"];

// ---------- Small helpers ----------
const $ = id => document.getElementById(id);
const norm = s => String(s ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const money = n => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const round2 = n => Math.round(n * 100) / 100;
const TOLERANCE = 1; // ₹1 rounding difference allowed

function num(s) {
  const t = String(s ?? "").replace(/[₹,\s%]/g, "");
  return t === "" ? NaN : Number(t);
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

// Accepts 2025-09-25, 25-09-2025, 25/09/2025, 25.09.2025, 25-Sep-2025, 25 Sep 2025, 25 September, 2025 or September 25, 2025. Returns "YYYY-MM-DD" or null.
function parseDate(s) {
  s = String(s ?? "").trim();
  let y, m, d, x;
  if ((x = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [y, m, d] = [+x[1], +x[2], +x[3]];
  else if ((x = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/))) [d, m, y] = [+x[1], +x[2], +x[3]];
  else if ((x = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]+(\d{4})$/))) [d, m, y] = [+x[1], MONTHS.indexOf(x[2].toUpperCase()) + 1, +x[3]];
  else if ((x = s.match(/^([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/))) [m, d, y] = [MONTHS.indexOf(x[1].toUpperCase()) + 1, +x[2], +x[3]];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function showDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${+d} ${MONTHS[m - 1][0] + MONTHS[m - 1].slice(1).toLowerCase()} ${y}`;
}
