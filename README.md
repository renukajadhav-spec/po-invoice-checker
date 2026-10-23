# PO–Invoice Checker (MVP)

Upload a purchase order (PO) and its invoice, and see ✓ / ✗ for each check.
The app flags and holds. The manager approves.

**Fake data only.** All names, GSTINs and amounts in this repo are made up.

## How to use it
1. Open the live link: https://renukajadhav-spec.github.io/po-invoice-checker/ (or `index.html` in a browser).
2. Choose a PO file and an invoice file, each as **CSV, PDF or image (JPG/PNG)**, or pick **Try a sample**.
3. **Review what was read.** The app fills in two editable tables. Correct anything it read wrongly; red boxes are empty and need filling in.
4. Click **Check**. A summary appears, plus a table with **Check / Status / PO says / Invoice says**.

To make your own CSV files, click **Download empty PO template** / **Download empty invoice template**, fill them in Excel (one row per item), and save as **CSV (Comma delimited)**.

### How PDFs and images are read
| File | Read with |
|---|---|
| CSV | Read directly |
| PDF with typed text | [pdf.js](https://mozilla.github.io/pdf.js/) (free, by Mozilla) |
| Image, or a scanned PDF | [Tesseract.js](https://tesseract.projectnaptha.com/) OCR (free text recognition); if no item line is found it tries again with a different page layout |

The app then looks for the fields in the text: PO / invoice number and date next to their labels; GSTINs and names under headings like SUPPLIER / BILL TO (or the letterhead of whoever issued the document); and item lines, meaning any line where qty × rate = amount, whatever the column order. GST % and CGST / SGST / IGST come from the same line or from the tax total lines.

**Limits:** clear, typed documents work best. Blurry photos, handwriting or unusual tables need more fixing in the review step (in testing, OCR once read `29…` as `20…` in a GSTIN). Reading PDFs and images needs internet to load the readers, and the first image downloads an English language file (about 10 MB, then cached). Files are never uploaded anywhere; everything runs in the browser.

Fake test documents are in [`samples/`](samples/): `po-1001.pdf` + `invoice-501.pdf` (expect 6/6 ✓) and `po-1002.pdf` + `invoice-m-207.png` (expect ✗ over-billing, qty 13 vs 12).

## The 6 checks
| Check | Passes when |
|---|---|
| GSTIN | Vendor name and GSTIN are the same on the PO and the invoice. ⚠ Note (does not fail): GSTIN check digit is wrong |
| Company details | Buyer name and GSTIN are the same on the PO and the invoice. ⚠ Note (does not fail): buyer GSTIN is not valid |
| GST rate | Same rate as the PO, and the rate is valid on the invoice date |
| GST calculation | Amount × rate = tax; CGST + SGST for the same state, IGST for another state (₹1 rounding allowed) |
| Qty × rate | Qty × rate = amount on every line |
| PO–invoice match | Same PO number, every item is on the PO, same rate, invoice qty not more than PO qty |

All 6 pass → **Ready for manager approval**. Any fail → **Hold, follow up with vendor**.

## Built-in rules
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
One file, `index.html` (HTML + CSS + JavaScript), plus the free pdf.js and Tesseract.js libraries loaded from a CDN only when a PDF or image is chosen. No database, no login, no keys. Everything runs in the browser, and files are never uploaded anywhere.

## Later versions
- Smarter reading of messy layouts (for example AI, through a small server that keeps the key safe)
- Email connection and automatic reminders
- PO tracker for partial deliveries / several invoices against one PO
- Save POs, invoices, vendors and GST rates in Supabase
- Corrected invoices marked "Replaced" and "Active"
