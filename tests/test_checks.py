"""Tests for backend/checks.py.

Every test is skipped until checks.py is real. The cases match docs/test_cases.md.
Run with: pytest
"""
import pytest

pytestmark = pytest.mark.skip(reason="checks.py is a placeholder")


def test_vendor_details_differ():
    """Different vendor GSTIN on the invoice -> Vendor details fails."""


def test_buyer_details_differ():
    """Different buyer name on the invoice -> Buyer details fails."""


def test_gst_rate_not_valid_on_date():
    """12% on an invoice dated after 22 Sep 2025 -> GST rate fails."""


def test_gst_split_wrong():
    """Same-state invoice charging IGST -> GST calculation fails."""


def test_gst_rounding_allowed():
    """Tax off by ₹0.50 -> GST calculation passes."""


def test_qty_x_rate_wrong():
    """10 × ₹100 with amount ₹1,050 -> Qty × rate fails."""


def test_item_not_on_po():
    """Extra item on the invoice -> Items fails."""


def test_over_billing():
    """Invoice qty 13 against PO qty 12 -> Items fails."""
