# Test cases

All test data is fake. The sample files are in [`samples/`](../samples/).

| # | Test | Input | Expected result | Result | Date |
|---|---|---|---|---|---|
| 1 | Sign-in, right password | Added user | App screen opens | | |
| 2 | Sign-in, wrong password | Added user, wrong password | Error shown, app stays hidden | | |
| 3 | Everything matches | `po-1001.pdf` + `invoice-501.pdf` | 7/7 ✓, Ready for manager approval | | |
| 4 | Over-billing (image) | `po-1002.pdf` + `invoice-m-207.png` | Items ✗: qty 13 vs PO 12; Hold | | |
| 5 | Vendor details differ | Change invoice vendor GSTIN in review step | Vendor details ✗ | | |
| 6 | Buyer details differ | Change invoice buyer name in review step | Buyer details ✗ | | |
| 7 | Wrong GST rate | Invoice line 12% dated after 22 Sep 2025 | GST rate ✗ (not valid on that date) | | |
| 8 | Wrong tax split | Same-state invoice charging IGST | GST calculation ✗ | | |
| 9 | Line doesn't add up | qty 10 × rate 100, amount 1,050 | Qty × rate ✗ | | |
| 10 | ₹1 rounding | Tax off by ₹0.50 | GST calculation ✓ | | |
| 11 | Item not on PO | Invoice has an extra item | Items ✗ | | |
| 12 | Different PO number | Invoice for another PO | Items ✗ | | |
| 13 | Empty required box | Leave vendor name blank | Red box, check does not run | | |
| 14 | History saved | Run test 3 | "✓ Saved to history"; new row in step 5 shows 7/7 Ready, PO, invoice, vendor, your email | | |
| 15 | History of a Hold | Run test 4 | New row shows 6/7 Hold, Failed checks: Items | | |
| 16 | History seen by all | Sign in as a second added user | Sees the first user's rows with their email under Checked by | | |
| 17 | Failed check not saved | Test 13 (check does not run) | No new history row | | |
| 18 | Invoice before PO | Invoice date 1 day before the PO date | Dates ✗, Hold | | |
| 19 | Invoice same day as PO | Invoice date = PO date | Dates ✓ | | |
| 20 | PO date empty | Clear PO date in review step | Red box, check does not run | | |
| 21 | Row details | Click a new history row | All 7 checks with ✓ / ✗ and reasons; click again closes | | |
| 22 | Older row details | Click a row saved before details existed | "Details were not saved for this older check." | | |
| 23 | Search | Type part of a PO number | Only matching rows; clear the box → all rows back | | |
| 24 | Hold only | Tick Hold only | Only Hold rows | | |
| 25 | Download CSV | Click Download CSV, open in Excel | Columns correct, names and ₹ readable, same rows as the search shows | | |
| 26 | Print / Save as PDF | After a check, click Print / Save as PDF | One white page: result only, checked by + date, footer | | |
| 27 | Dashboard, this month | Compare with this month's rows in Supabase | Checks, Ready %, Hold %, most common failed check all match | | |
| 28 | Dashboard, all time | Period: All time | Checks = number of rows in Supabase | | |
| 29 | Dashboard, last month | Period: Last month (no checks then) | 0 checks, "No checks in this period." | | |
| 30 | Dashboard, custom | Change From or To | Period switches to Custom; whole To day is counted | | |
| 31 | Dashboard, wrong range | From after To | "From date must be on or before the To date", tiles unchanged | | |
| 32 | Re-check, fix a box | Hold row → ↻ Re-check (last column) → fix the wrong box → Check | Step 2 filled + orange banner; new row "Re-check of <date>"; old row "Re-checked → 7/7 Ready" | | |
| 33 | Re-check, corrected file | Re-check → upload a corrected invoice file in step 1 → Check | Only the invoice side is replaced; new row still linked to the old one | | |
| 34 | Cancel re-check | Re-check → Cancel re-check → Check | Banner gone; new row is a normal check (no "Re-check of") | | |
| 35 | Older row | Row saved before Re-check existed | "—" in the Re-check column, no button | | |
| 36 | CSV with re-checks | Download CSV after test 32 | ID and Re-check of ID columns link the two rows | | |
| 37 | Approve | Ready row → ✓ Approve | "✓ Approved by <email> · <time>"; same in Supabase | | |
| 38 | Reject, no reason | Ready row → ✗ Reject → Confirm reject with empty box | Red box, not saved | | |
| 39 | Reject with reason | Type a reason → Confirm reject | "✗ Rejected", by, time and "Reason: …" | | |
| 40 | Change decision | Change → Approve on a rejected row | Now "✓ Approved"; the reject is replaced | | |
| 41 | Hold row | Look at a Hold row's Approval column | "Fix and re-check first", no buttons | | |
| 42 | CSV approval | Download CSV after tests 37–40 | Approval, Approved by, Approved on, Approval note filled | | |
