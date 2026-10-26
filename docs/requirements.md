# Requirements

## Goal
Compare a purchase order (PO) with its invoice and show ✓ / ✗ for each check, so the manager only approves invoices that match.
The app flags and holds. The manager approves.

## Who uses it
- Signed-in users only (Supabase Auth, email + password). Public sign-up is off; the app owner adds users.

## What the user does
1. Signs in.
2. Chooses a PO file and an invoice file: CSV, PDF or image (JPG/PNG).
3. Reviews what the app read and corrects anything wrong. Empty required boxes show in red.
4. Clicks **Check** and sees a summary plus a table: Check / Status / PO says / Invoice says.

## Fields read
- PO: `po_no, po_date, vendor_name, vendor_gstin, buyer_name, buyer_gstin, item, hsn, qty, rate, gst_rate`
- Invoice: `invoice_no, invoice_date, po_no, vendor_name, vendor_gstin, buyer_name, buyer_gstin, item, hsn, qty, rate, amount, gst_rate, cgst, sgst, igst`
- Optional: `po_date, hsn, cgst, sgst, igst`

## The 6 checks
| # | Check | Passes when |
|---|---|---|
| 1 | Vendor details | Vendor name and GSTIN are the same on the PO and the invoice |
| 2 | Buyer details | Buyer name and GSTIN are the same on the PO and the invoice |
| 3 | GST rate | Same rate as the PO, and the rate is valid on the invoice date |
| 4 | GST calculation | Amount × rate = tax; CGST + SGST when vendor and buyer GSTINs start with the same state code, otherwise IGST |
| 5 | Qty × rate | Qty × rate = amount on every line |
| 6 | Items | Same PO number, every item is on the PO, same rate, invoice qty not more than PO qty |

- Names match even if dots, commas or extra spaces differ ("Pvt. Ltd." = "Pvt Ltd").
- A difference of up to ₹1 is allowed for rounding.
- All 6 pass → **Ready for manager approval**. Any fail → **Hold, follow up with vendor**.

## Rules the app uses
- GST rates (see `data/gst_rates.csv`): 0/5/12/18/28% up to 21 Sep 2025; 0/5/18/40% from 22 Sep 2025 (main slabs only).
- PO vs invoice only. No checks against a vendor list, our company details or GSTIN check digits.

## Not in this version
- Python backend doing the checks (the files in `backend/` are outlines only)
- Saving POs, invoices, vendors or GST rates in Supabase
- Email connection and reminders
- Several invoices against one PO
