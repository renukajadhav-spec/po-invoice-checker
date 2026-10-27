# CLAUDE.md

Rules for Claude Code in this project.

## Safety rules
1. No passwords or keys in GitHub. `.env` is never committed. Before every push, check the change for secrets and say the result.
2. Fake data only. Use made-up names, GSTINs and amounts. Never real company, client or employee data.
3. Ask before deleting. If a task needs a file, table or data deleted, stop and check with the owner first.

## How we work
- Never work directly on `main`. Every change gets its own branch, then a pull request, then a merge.
- Plan first (Plan mode) for builds. The owner approves the plan before anything is built.
- Ask before adding new database tables.
- After each change, explain what changed and why, in simple words.
- Write "manager", not a person's name, in files and commits.

## The project
- `index.html` (main folder): only redirects to `frontend/` so the GitHub Pages link keeps working. Don't put app code in it.
- `frontend/`: the app that runs today (index.html + style.css + `js/`). Checks run in the browser. `js/` files, loaded in this order: `core.js` (lookup data, helpers), `reading.js` (CSV/PDF/OCR), `review.js` (step 2), `checks.js` (the 7 checks, results), `guide.js` (next step bar), `history.js` (history, re-check, approval, Excel), `dashboard.js`, `app.js` (page wiring, login; last).
- `backend/`: Python outlines only. Not used yet.
- `data/gst_rates.csv`: GST rate slabs. The same rates are also in `GST_RATES` in `frontend/js/core.js`; change both together.
- `docs/requirements.md`: what the app must do. `docs/test_cases.md`: what to test.
- Checks compare the PO with the invoice only. Do not add vendor-list, company or GSTIN check-digit checks.
