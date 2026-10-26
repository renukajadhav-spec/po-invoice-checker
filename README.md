# PO–Invoice Checker

Upload a purchase order (PO) and its invoice, and see ✓ / ✗ for each check.
The app flags and holds. The manager approves.

**Fake data only.** All names, GSTINs and amounts in this repo are made up.

Live link: https://renukajadhav-spec.github.io/po-invoice-checker/

## Folders
| Path | What it holds |
|---|---|
| `index.html` | Sends visitors on to `frontend/`, so the live link keeps working |
| `frontend/` | The app: `index.html` (page layout), `style.css` (looks), `app.js` (logic, reading and the 6 checks) |
| `backend/` | Python outlines for a future server: `main.py`, `read_documents.py`, `checks.py`, `database.py`. Not used yet |
| `data/gst_rates.csv` | GST rate slabs with valid-from / valid-to dates |
| `docs/` | `requirements.md` (what the app must do), `test_cases.md` (what to test) |
| `tests/` | `test_checks.py`, Python tests for `checks.py` (skipped until it is real) |
| `samples/` | Fake PO and invoice files for testing |
| `requirements.txt` | Python libraries the backend needs |
| `.env` | Secret settings. Stays on the laptop, never pushed (not in this repo) |
| `CLAUDE.md` | Rules for Claude Code in this project |

## How to use it
1. Open the live link (or `frontend/index.html` in a browser).
2. Sign in, then choose a PO file and an invoice file, each as **CSV, PDF or image (JPG/PNG)**.
3. **Review what was read** and correct anything wrong; red boxes are empty and need filling in.
4. Click **Check** and see the summary plus a table: **Check / Status / PO says / Invoice says**.

The 6 checks and the CSV column headings are in [docs/requirements.md](docs/requirements.md).
Fake test files: `samples/po-1001.pdf` + `samples/invoice-501.pdf` (expect 6/6 ✓) and `samples/po-1002.pdf` + `samples/invoice-m-207.png` (expect ✗ over-billing, qty 13 vs 12).

### How PDFs and images are read
| File | Read with |
|---|---|
| CSV | Read directly |
| PDF with typed text | [pdf.js](https://mozilla.github.io/pdf.js/) (free, by Mozilla) |
| Image, or a scanned PDF | [Tesseract.js](https://tesseract.projectnaptha.com/) OCR (free text recognition) |

Clear, typed documents work best. Files are never uploaded anywhere; everything runs in the browser.

## Login
Sign-in is handled by **Supabase Auth** (project `training`).
- **Add a user:** Supabase → Authentication → Users → **Add user → Create new user**, enter email + password, tick **Auto Confirm User**.
- **Public sign-up is off**, so only users added this way can sign in.
- **Who opened it:** Supabase → Authentication → Users shows each person's **Last sign in**.

## Keys
The page uses only the Supabase **publishable** key, which is meant to be public. Any secret key goes in `.env`, which `.gitignore` keeps out of GitHub.

## Later versions
- Python backend doing the reading and checks (needs a server host; GitHub Pages can't run Python)
- Save POs, invoices, vendors and GST rates in Supabase
- Email connection and automatic reminders
- PO tracker for several invoices against one PO
