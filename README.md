# PO–Invoice Checker (MVP)

Upload a purchase order (PO) and its invoice, and see ✓ / ✗ for each check.
The app flags and holds. The manager approves.

**Fake data only.** All names, GSTINs and amounts in this repo are made up.

## Login
The app opens with a **Sign in** screen (email + password). Sign-in is handled by **Supabase Auth** (project `training`).

- **Add a user:** Supabase → Authentication → Users → **Add user → Create new user**, enter email + password, tick **Auto Confirm User**.
- **Public sign-up is off**, so only users added this way can sign in.
- **Who opened it:** Supabase → Authentication → Users shows each person's **Last sign in**.
- No password is stored in this repo. The page uses only the Supabase **publishable** key, which is meant to be public; the secret key is never used.
- Limit: the login hides the app screen, but the page code is public in this repo. That's fine here because the app keeps no data and files never leave the browser.

## How to use it
1. Open the live link: https://renukajadhav-spec.github.io/po-invoice-checker/ (or `index.html` in a browser).
2. Sign in, then choose a PO file and an invoice file, each as **CSV, PDF or image (JPG/PNG)**.
3. **Review what was read.** The app fills in two editable tables. Correct anything it read wrongly; red boxes are empty and need filling in.
4. Click **Check**. A summary appears, plus a table with **Check / Status / PO says / Invoice says**.

A CSV file needs these column headings (one row per item):
- PO: `po_no, po_date, vendor_name, vendor_gstin, buyer_name, buyer_gstin, item, hsn, qty, rate, gst_rate`
- Invoice: `invoice_no, invoice_date, po_no, vendor_name, vendor_gstin, buyer_name, buyer_gstin, item, hsn, qty, rate, amount, gst_rate, cgst, sgst, igst`

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
| Vendor details | Vendor name and GSTIN are the same on the PO and the invoice |
| Buyer details | Buyer name and GSTIN are the same on the PO and the invoice |
| GST rate | Same rate as the PO, and the rate is valid on the invoice date |
| GST calculation | Amount × rate = tax; CGST + SGST for the same state, IGST for another state (₹1 rounding allowed) |
| Qty × rate | Qty × rate = amount on every line |
| Items | Same PO number, every item is on the PO, same rate, invoice qty not more than PO qty |

All 6 pass → **Ready for manager approval**. Any fail → **Hold, follow up with vendor**.

## Built-in rules
- GST rates: 0/5/12/18/28% up to 21 Sep 2025; 0/5/18/40% from 22 Sep 2025 (main slabs only)

## How it's built
One file, `index.html` (HTML + CSS + JavaScript), plus free libraries from a CDN: supabase-js for sign-in, and pdf.js / Tesseract.js only when a PDF or image is chosen. No database tables and no secret keys. Files are read in the browser and never uploaded anywhere.

## Later versions
- Smarter reading of messy layouts (for example AI, through a small server that keeps the key safe)
- Email connection and automatic reminders
- PO tracker for partial deliveries / several invoices against one PO
- Save POs, invoices, vendors and GST rates in Supabase
- Corrected invoices marked "Replaced" and "Active"
