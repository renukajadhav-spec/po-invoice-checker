// ---------- Page wiring ----------
function setError(msg) {
  const e = $("error");
  e.textContent = msg || "";
  e.style.display = msg ? "block" : "none";
  if (msg) $("results").style.display = "none";
  updateGuide();
}

function fileType(name) {
  if (/\.csv$/i.test(name)) return "csv";
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.(jpe?g|png)$/i.test(name)) return "image";
  return null;
}

// Any file → a document { header, items, how, name, text }
async function readDocument(file, side, progress) {
  const type = fileType(file.name);
  if (type === "csv") return { ...recordsToDoc(toRecords(await file.text(), COLS[side], FIELDS[side].label), side), how: "CSV", name: file.name };
  if (type === "image") return { ...await readByOcr([file], side, progress), how: "image (OCR)", name: file.name };
  const pdf = await readPdf(file);
  if (pdf.lines) return { ...parseDocument(pdf.lines, side), how: "PDF text", name: file.name };
  return { ...await readByOcr(pdf.images, side, progress), how: "scanned PDF (OCR)", name: file.name };
}

async function handleFile(input, side) {
  setError("");
  const file = input.files[0];
  const status = t => $(side + "Status").textContent = t;
  const drop = $(side + "Drop");
  if (!file) return;
  drop.classList.remove("done", "reading");
  $(side + "Name").textContent = "";
  if (!fileType(file.name)) {
    input.value = "";
    status("");
    return setError(`"${file.name}" is not a CSV, PDF or image file (JPG/PNG).`);
  }
  $(side + "Name").textContent = file.name;
  drop.classList.add("reading");
  status("Reading…");
  updateGuide();
  try {
    const doc = await readDocument(file, side, status);
    renderReview(side, doc);
    drop.classList.replace("reading", "done");
    status(doc.how === "CSV"
      ? `✓ Read ${doc.items.length} item row(s). See step 2.`
      : `✓ Read ${doc.items.length} item line(s) from ${doc.how}. Please check step 2.`);
  } catch (err) {
    drop.classList.remove("reading");
    $(side + "Name").textContent = "";
    input.value = "";
    status("");
    setError(err.message);
  }
  updateGuide();
}

for (const side of ["po", "inv"]) {
  const drop = $(side + "Drop"), input = $(side + "File");
  input.addEventListener("change", () => handleFile(input, side));
  // Drag a file onto the zone as well as clicking it
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove("over")));
  drop.addEventListener("drop", e => {
    e.preventDefault();
    if (!e.dataTransfer.files.length) return;
    input.files = e.dataTransfer.files;
    handleFile(input, side);
  });
}

$("checkBtn").addEventListener("click", async () => {
  setError("");
  if (!loadedSides.po || !loadedSides.inv) return setError("Choose both a PO file and an invoice file first.");
  const btn = $("checkBtn");
  btn.disabled = true; // a double click can't check or save twice
  try {
    const po = collectSide("po"), inv = collectSide("inv");
    const checked = runChecks(po, inv);
    // The same PO + invoice can only be checked once; Re-check in History is the way to check it again
    if (!recheckOf) {
      const earlier = await findEarlierCheck(checked.poNo, checked.header.invoice_no);
      if (earlier) throw new Error(`${checked.poNo} + ${checked.header.invoice_no} was already checked on ${showTime(earlier.checked_at)} by ${shortName(earlier.checked_by_email)} (${resultText(earlier)}). To check it again, use ↻ Re-check in History.`);
    }
    showResults(checked);
    $("printedBy").textContent = `Checked by ${$("userEmail").textContent} on ${showTime(new Date())}`;
    await saveHistory(checked, recordsToDoc(po, "po"), recordsToDoc(inv, "inv"));
  } catch (err) {
    setError(err.message);
    $("error").scrollIntoView({ behavior: "smooth", block: "center" });
  } finally {
    btn.disabled = false;
  }
});

// The rules section, built from the same lookup data the checks use
(function showRules() {
  const r = $("rules");
  const table = (head, rows) => {
    const t = document.createElement("table");
    const hr = t.createTHead().insertRow();
    head.forEach(h => { const th = document.createElement("th"); th.textContent = h; hr.appendChild(th); });
    const tb = t.createTBody();
    rows.forEach(row => { const tr = tb.insertRow(); row.forEach(v => tr.insertCell().textContent = v); });
    return t;
  };
  r.appendChild(table(["GST rates", "Valid from", "Valid to"],
    GST_RATES.map(s => [s.rates.map(x => x + "%").join(", "), showDate(s.from), s.to ? showDate(s.to) : "—"])));
})();

// ---------- Login (Supabase Auth) ----------
// The publishable key is meant to be public; Supabase checks the email and password on its own server.
const SUPABASE_URL = "https://zdfnvemxhwklduqkniod.supabase.co";
const SUPABASE_KEY = "sb_publishable_6sXqMklXanBF4n_yUgc3Xg_4ZHwpF8k";
const db = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);

function showLoginError(msg) {
  const e = $("loginError");
  e.textContent = msg || "";
  e.style.display = msg ? "block" : "none";
  if (msg) shake($("login"));
}

let currentUser = null;

function showSignedIn(user) {
  currentUser = user || null;
  $("login").hidden = !!user;
  $("app").hidden = !user;
  $("userEmail").textContent = user ? user.email : "";
  // Run after the sign-in event finishes: Supabase can stall if asked for data inside its own event
  if (user) { setTimeout(refreshHistory); updateGuide(); }
  else endRecheck();
}

(async function startLogin() {
  if (!db) {
    showLoginError("Could not load the sign-in service. Check your internet connection and refresh the page.");
    $("signInBtn").disabled = true;
    return;
  }
  const auth = db.auth;

  const { data } = await auth.getSession();
  showSignedIn(data.session?.user);
  auth.onAuthStateChange((_event, session) => showSignedIn(session?.user));

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    showLoginError("");
    $("signInBtn").disabled = true;
    $("signInBtn").textContent = "Signing in…";
    const { error } = await auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    $("signInBtn").disabled = false;
    $("signInBtn").textContent = "Sign in";
    if (error) showLoginError(/invalid login/i.test(error.message) ? "Wrong email or password." : error.message);
    else $("password").value = "";
  });

  $("signOutBtn").addEventListener("click", () => auth.signOut());
})();

// ---------- Print / Save as PDF ----------
$("printBtn").addEventListener("click", () => window.print());
