# Test cases

All test data is fake. The sample files are in [`samples/`](../samples/).

| # | Test | Input | Expected result | Result | Date |
|---|---|---|---|---|---|
| 1 | Sign-in, right password | Added user | App screen opens | | |
| 2 | Sign-in, wrong password | Added user, wrong password | Error shown, app stays hidden | | |
| 3 | Everything matches | `po-1001.pdf` + `invoice-501.pdf` | 6/6 ✓, Ready for manager approval | | |
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
