"""Reads a PO or invoice file and returns its fields.

PLACEHOLDER: outlines only. Today this is done in the browser by
readDocument / readPdf / readByOcr / parseDocument in frontend/app.js.
"""


def read_csv(path):
    """Read a CSV file with the column headings in docs/requirements.md."""
    raise NotImplementedError


def read_pdf(path):
    """Read a PDF with typed text into lines."""
    raise NotImplementedError


def read_image(path):
    """Read an image or scanned PDF with OCR into lines."""
    raise NotImplementedError


def parse_document(lines, side):
    """Find the header fields and item lines. side is "po" or "inv"."""
    raise NotImplementedError
