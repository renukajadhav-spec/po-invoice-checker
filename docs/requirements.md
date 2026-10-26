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
4. Clicks **Check** and sees a summary plus a table: Check / Status / PO says / Invoice says. **Print / Save as PDF** gives one clean page of the result, with who checked it and when.
5. Sees the **Dashboard** for the chosen period (default this month; also last month, last 7 / 30 days, this year, all time or custom From–To dates): number of checks, % Ready, % Hold, most common failed check.
6. Sees the **History**: every check by any signed-in user, newest first (latest 50). Can search by PO or invoice number, tick **Hold only**, click a row to see each check's reasons, and **Download Excel** (.xlsx: one row per check, real dates, filter arrows on the header row).
7. **Re-checks** a corrected PO or invoice: the **↻ Re-check** button in the last History column fills step 2 with the saved PO and invoice. The user corrects the boxes or uploads the corrected file, then clicks Check. The new row says "Re-check of <date>", and the old row shows "Re-checked → <result>".
8. **Approves or rejects** a Ready check in the **Approval** column of History. Reject needs a reason. The decision shows who decided and when, and can be changed (the latest decision replaces the old one). Hold rows show "Fix and re-check first". Any signed-in user can approve, so a user could approve their own check; a manager role can be added later.

## History
- Each click of **Check** saves one row in the Supabase table `check_history` (set up with `docs/check_history.sql`).
- Saved: date and time, PO no., invoice no., invoice date, vendor name, checks passed / total, verdict, failed check names, each check's reasons (`details`), who checked.
- Also saved: the PO and invoice as reviewed in step 2 (header details and item lines, `po_data` / `invoice_data`), and which row a re-check is for (`rechecked_from`).
- Approval: `approval` (Approved / Rejected), `approved_by`, `approved_by_email`, `approved_at`, `approval_note`. These 5 are the only columns that can be changed after a row is saved, and only on Ready rows.
- Columns added later: `details` with `docs/check_history_add_details.sql`; `po_data`, `invoice_data`, `rechecked_from` with `docs/check_history_add_recheck.sql`; the approval columns with `docs/check_history_add_approval.sql`. Older rows don't have them, so they can't show reasons or be re-checked.
- Not saved: the uploaded files.
- Every signed-in user can see all rows. Rows can be added but not deleted, and only the approval can be changed.

## Fields read
- PO: `po_no, po_date, vendor_name, vendor_gstin, buyer_name, buyer_gstin, item, hsn, qty, rate, gst_rate`
- Invoice: `invoice_no, invoice_date, po_no, vendor_name, vendor_gstin, buyer_name, buyer_gstin, item, hsn, qty, rate, amount, gst_rate, cgst, sgst, igst`
- Optional: `hsn, cgst, sgst, igst`. PO date is required (the Dates check needs it).

## The 7 checks
| # | Check | Passes when |
|---|---|---|
| 1 | Vendor details | Vendor name and GSTIN are the same on the PO and the invoice |
| 2 | Buyer details | Buyer name and GSTIN are the same on the PO and the invoice |
| 3 | GST rate | Same rate as the PO, and the rate is valid on the invoice date |
| 4 | GST calculation | Amount × rate = tax; CGST + SGST when vendor and buyer GSTINs start with the same state code, otherwise IGST |
| 5 | Qty × rate | Qty × rate = amount on every line |
| 6 | Items | Same PO number, every item is on the PO, same rate, invoice qty not more than PO qty |
| 7 | Dates | The invoice is dated on or after the PO date (same day is fine) |

- Names match even if dots, commas or extra spaces differ ("Pvt. Ltd." = "Pvt Ltd").
- A difference of up to ₹1 is allowed for rounding.
- The same PO no. + invoice no. can only be checked once (capital/small letters ignored). Checking it again shows an error with when, by whom and the result; use **↻ Re-check** in History to check it again.
- All 7 pass → **Ready for manager approval**. Any fail → **Hold, follow up with vendor**.

## Rules the app uses
- GST rates (see `data/gst_rates.csv`): 0/5/12/18/28% up to 21 Sep 2025; 0/5/18/40% from 22 Sep 2025 (main slabs only).
- PO vs invoice only. No checks against a vendor list, our company details or GSTIN check digits.

## Not in this version
- Python backend doing the checks (the files in `backend/` are outlines only)
- Saving POs, invoices, vendors or GST rates as their own records in Supabase (History keeps only a copy of each checked PO and invoice)
- Email connection and reminders
- Several invoices against one PO
