"""The 6 PO vs invoice checks.

PLACEHOLDER: outlines only. Today the checks run in runChecks() in frontend/app.js.
The rules for each check are in docs/requirements.md.

po and inv are lists of lines. Each line is a dict with the header fields
(po_no, vendor_gstin, ...) and the item fields (item, qty, rate, ...).
Each check returns a list of problems; an empty list means ✓.
"""

TOLERANCE = 1  # ₹1 rounding difference allowed


def check_vendor_details(po, inv):
    """Vendor name and GSTIN are the same on the PO and the invoice."""
    raise NotImplementedError


def check_buyer_details(po, inv):
    """Buyer name and GSTIN are the same on the PO and the invoice."""
    raise NotImplementedError


def check_gst_rate(po, inv, gst_rates):
    """Same rate as the PO, and the rate is valid on the invoice date."""
    raise NotImplementedError


def check_gst_calculation(inv):
    """Amount × rate = tax; CGST + SGST for the same state, IGST for another state."""
    raise NotImplementedError


def check_qty_x_rate(inv):
    """Qty × rate = amount on every line."""
    raise NotImplementedError


def check_items(po, inv):
    """Same PO number, every item on the PO, same rate, qty not more than the PO."""
    raise NotImplementedError
