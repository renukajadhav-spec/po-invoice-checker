# PO–Invoice Checker (MVP)

Upload a purchase order (PO) and its invoice, and see ✓ / ✗ for each check.
The app flags and holds. The manager approves.

**Fake data only.** All names, GSTINs and amounts in this repo are made up.

## How to use it
1. Open `index.html` in a browser (or the live GitHub Pages link).
2. Choose a PO file and an invoice file (`.csv`), or pick **Try a sample**.
3. Click **Check**. A summary appears, plus a table with **Check / Status / PO says / Invoice says**.

To make your own files, click **Download empty PO template** / **Download empty invoice template**, fill them in Excel (one row per item), and save as **CSV (Comma delimited)**.

## The 6 checks
| Check | Passes when |
|---|---|
| GSTIN | Vendor GSTIN is valid (format + check digit), same as on the PO, and in the vendor list |
| Company details | Invoice is billed to our company name and GSTIN |
| GST rate | Same rate as the PO, and the rate is valid on the invoice date |
| GST calculation | Amount × rate = tax; CGST + SGST for the same state, IGST for another state (₹1 rounding allowed) |
| Qty × rate | Qty × rate = amount on every line |
| PO–invoice match | Same PO number, every item is on the PO, same rate, invoice qty not more than PO qty |

All 6 pass → **Ready for manager approval**. Any fail → **Hold, follow up with vendor**.

## Built-in rules (fake)
- Our company: Sunrise Demo Traders Pvt Ltd, `27AAKCS1234D1ZM` (Maharashtra)
- Vendors: Kaveri Paper Mart, Mysore Office Supplies, Patel Packaging Co
- GST rates: 0/5/12/18/28% up to 21 Sep 2025; 0/5/18/40% from 22 Sep 2025 (main slabs only)

## Samples
| Sample | Expected |
|---|---|
| 1. All correct | 6/6 ✓ |
| 2. PO qty 12, invoice qty 13 | ✗ PO–invoice match (over-billing) |
| 3. 12% invoice dated 15 Sep 2025 | 6/6 ✓ (12% was valid then) |
| 4. 12% invoice dated 25 Sep 2025 | ✗ GST rate |
| 5. Wrong buyer GSTIN + wrong tax | ✗ Company details, ✗ GST calculation |

## How it's built
One file, `index.html` (HTML + CSS + JavaScript). No database, no login, no keys. Everything runs in the browser, and files are never uploaded anywhere.

## Later versions
- PDF upload
- Email connection and automatic reminders
- PO tracker for partial deliveries / several invoices against one PO
- Save POs, invoices, vendors and GST rates in Supabase
- Corrected invoices marked "Replaced" and "Active"
