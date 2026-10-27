// ---------- Next step guide (bar at the bottom of the screen) ----------
let lastResult = null;        // { hold, score } of the result on screen
let checkedSinceEdit = false; // false again once a box in step 2 is changed after Check
let guideKey = "";

// Works out where the user is from what the page shows, and tells them the next step
function updateGuide() {
  const g = $("guide");
  let hidden = false;
  try { hidden = sessionStorage.getItem("guideHidden") === "1"; } catch {}
  g.hidden = hidden;
  $("guideShow").hidden = !hidden;

  const card = id => $(id).closest(".card");
  const reading = ["po", "inv"].some(s => $(s + "Drop").classList.contains("reading"));
  const errorShown = $("error").style.display === "block";
  const resultShown = $("results").style.display === "block" && checkedSinceEdit && lastResult;
  let step, text, go = null, toCheck = false; // toCheck: also show "Go to Check"
  if (reading) {
    [step, text] = ["Step 1 of 4", "Reading the file… please wait."];
  } else if (errorShown) {
    [step, text, go] = ["Fix the problem", "shown in red, then try again.", ["Show the problem", $("error")]];
  } else if (resultShown) {
    step = "Step 4 of 4";
    text = lastResult.hold
      ? `Hold (${lastResult.score}). Follow up with the vendor; when the PO or invoice is corrected, use ↻ Re-check in History.`
      : `Ready (${lastResult.score}). It's saved in History — approve it in the Approval column.`;
    go = ["Go to History ↓", card("historyRows")];
  } else if (recheckOf) {
    [step, text, go, toCheck] = ["Re-check", "Correct the boxes, or upload the corrected file in step 1, then click Check.", ["Go to step 2 ↓", $("review")], true];
  } else if (loadedSides.po && loadedSides.inv) {
    [step, text, go, toCheck] = ["Step 2 of 4", "Check what was read. Fix anything wrong; red boxes must be filled. Then click Check.", ["Go to step 2 ↓", $("review")], true];
  } else if (loadedSides.po || loadedSides.inv) {
    [step, text, go] = ["Step 1 of 4", `Now choose the ${loadedSides.po ? "invoice" : "PO"} file.`, ["Go to step 1 ↑", card("poDrop")]];
  } else {
    [step, text, go] = ["Step 1 of 4", "Choose the PO file and the invoice file.", ["Go to step 1 ↑", card("poDrop")]];
  }

  $("guideStep").textContent = step;
  $("guideText").textContent = text;
  g.classList.toggle("warn", errorShown && !reading);
  const btn = $("guideGo");
  btn.hidden = !go;
  if (go) {
    btn.textContent = go[0];
    btn.onclick = () => go[1].scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("guideCheck").hidden = !toCheck;
  // Slide in again only when the message changes
  if (step + text !== guideKey) {
    guideKey = step + text;
    g.classList.remove("changed");
    void g.offsetWidth;
    g.classList.add("changed");
  }
}

function setGuideHidden(hide) {
  try { hide ? sessionStorage.setItem("guideHidden", "1") : sessionStorage.removeItem("guideHidden"); } catch {}
  if (!hide) guideKey = ""; // show it with the slide-in
  updateGuide();
}

// Jump straight to the Check button: centre it, focus it (Enter then checks) and make it pulse
$("guideCheck").addEventListener("click", () => {
  const c = $("checkBtn");
  c.scrollIntoView({ behavior: "smooth", block: "center" });
  c.focus({ preventScroll: true });
  c.classList.remove("pulse");
  void c.offsetWidth;
  c.classList.add("pulse");
});
$("guideClose").addEventListener("click", () => setGuideHidden(true));
$("guideShow").addEventListener("click", () => setGuideHidden(false));
// Changing a box after Check means the shown result is out of date: back to "click Check"
$("review").addEventListener("input", () => { if (checkedSinceEdit) { checkedSinceEdit = false; updateGuide(); } });
