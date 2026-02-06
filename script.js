/****************************************************
 * Attendance Pro - Mobile Only (Facebook style cards)
 * + ✅ Print Summary A4 (Portrait) 2 pages
 ****************************************************/

const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxIz2rJ-HxNX2Pe0Tw7_GURp11X_8Jd0C_es_3irLjOPG3iVl-aaur2Lc6gqy-PTdbU/exec";

let cachedData = null;
let currentTab = "daily";
let isAdmin = false;

const STORAGE_KEY_ADMIN = "attendance_admin_pass";

/* -------------------------
   Helpers
-------------------------- */
function $(id) { return document.getElementById(id); }

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", !!hidden);
}

function showLoader(show) { setHidden($("loader"), !show); }

function showError(msg) {
  $("error-text").textContent = msg || "សូមព្យាយាមម្ដងទៀត។";
  setHidden($("error-panel"), false);
}
function hideError() { setHidden($("error-panel"), true); }
function showEmpty(show) { setHidden($("empty-state"), !show); }

let toastTimer = null;
function showToast(msg) {
  const toast = $("toast");
  $("toast-text").textContent = msg || "Done";
  setHidden(toast, false);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setHidden(toast, true), 2200);
}

function setAdminUI(on) {
  isAdmin = !!on;
  $("admin-status").textContent = on ? "Mode: Admin" : "Mode: User";
  $("admin-status").style.background = on ? "rgba(230,30,37,.12)" : "";
  $("admin-status").style.color = on ? "#991b1b" : "";
  setHidden($("logoutRow"), !on);
  if (cachedData) render();
}

/* -------------------------
   Normalize table
-------------------------- */
function normalizeTable(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return { headerIdx: 0, header: [], body: [] };
  }

  const rowsToScan = Math.min(8, data.length);
  let headerIdx = 0;
  let bestCount = -1;

  for (let r = 0; r < rowsToScan; r++) {
    const row = data[r] || [];
    const count = row.reduce((acc, cell) => acc + (String(cell || "").trim() !== "" ? 1 : 0), 0);
    if (count > bestCount) {
      bestCount = count;
      headerIdx = r;
    }
  }

  let last = -1;
  for (let r = headerIdx; r < rowsToScan; r++) {
    const row = data[r] || [];
    for (let c = row.length - 1; c >= 0; c--) {
      if (String(row[c] || "").trim() !== "") {
        last = Math.max(last, c);
        break;
      }
    }
  }
  if (last < 0) last = 0;

  const cut = last + 1;
  const header = (data[headerIdx] || []).slice(0, cut);
  const body = data.slice(headerIdx + 1).map(r => (r || []).slice(0, cut));

  return { headerIdx, header, body };
}

function findCol(header, keywords) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const lower = header.map(norm);

  for (const kw of keywords) {
    const k = norm(kw);
    const i = lower.findIndex(h => h.includes(k));
    if (i >= 0) return i;
  }
  return -1;
}

/* -------------------------
   API calls
-------------------------- */
async function apiGetData() {
  const url = `${WEB_APP_URL}?action=data&t=${Date.now()}`;
  const res = await fetch(url, { method: "GET" });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Server error");
  return json.data;
}

async function apiAuth(pass) {
  const res = await fetch(WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "auth", pass }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Invalid Password");
  return true;
}

async function apiUpdate(sheetName, row0, col0, value, pass) {
  const res = await fetch(WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "update", sheetName, row: row0, col: col0, value, pass }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Update failed");
  return true;
}

/* -------------------------
   Load + Select
-------------------------- */
async function loadData(force = false) {
  hideError();
  showEmpty(false);
  showLoader(true);

  try {
    cachedData = await apiGetData();
    populateDaySelect();

    const hasSummary = Array.isArray(cachedData.summary) && cachedData.summary.length > 0;
    const hasDaily = cachedData.daily && Object.keys(cachedData.daily).length > 0;

    if (!hasSummary && !hasDaily) {
      $("main-view").innerHTML = "";
      showEmpty(true);
      return;
    }

    render();
    showToast("Updated");
  } catch (e) {
    console.error(e);
    $("main-view").innerHTML = "";
    showError("Error connecting to server! (" + (e.message || "Unknown") + ")");
  } finally {
    showLoader(false);
  }
}

function populateDaySelect() {
  const daySelect = $("day-select");
  if (!daySelect || !cachedData?.daily) return;

  const prev = daySelect.value;
  daySelect.innerHTML = "";

  const days = Object.keys(cachedData.daily);
  days.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  days.forEach(d => daySelect.add(new Option(d, d)));

  if (prev && days.includes(prev)) daySelect.value = prev;
  if (!daySelect.value && days.length) daySelect.value = days[days.length - 1];
}

/* -------------------------
   Tabs
-------------------------- */
function showTab(tab) {
  currentTab = tab;

  document.querySelectorAll(".tab").forEach(el => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });

  $("subTitle").textContent = tab === "daily" ? "វត្តមានប្រចាំថ្ងៃ" : "សង្ខេបវត្តមានរួម";
  clearSearch(false);
  render();
}

function render() {
  $("day-select").parentElement.style.display = currentTab === "daily" ? "flex" : "none";
  if (currentTab === "daily") renderDaily();
  else renderSummary();
}

function clearSearch(showToastMsg = true) {
  $("searchInput").value = "";
  if (showToastMsg) showToast("Cleared");
  searchCards();
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* -------------------------
   Cards
-------------------------- */
function cardKV(label, value, sheetName, row0, col0) {
  if (col0 < 0) {
    return `<div class="kv"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(value ?? "")}</div></div>`;
  }

  if (isAdmin) {
    return `
      <div class="kv">
        <div class="k">${escapeHtml(label)}</div>
        <input class="edit-input"
          value="${escapeHtml(value ?? "")}"
          title="${escapeHtml(value ?? "")}"
          data-sheet="${escapeHtml(sheetName)}"
          data-row="${row0}"
          data-col="${col0}"
          onkeydown="onEditKeyDown(event,this)"
          onchange="saveEditFromInput(this)"
        />
      </div>
    `;
  }

  return `
    <div class="kv">
      <div class="k">${escapeHtml(label)}</div>
      <div class="v" title="${escapeHtml(value ?? "")}">${escapeHtml(value ?? "")}</div>
    </div>
  `;
}

function renderDaily() {
  if (!cachedData?.daily) {
    $("main-view").innerHTML = "";
    showEmpty(true);
    return;
  }

  const daySelect = $("day-select");
  const sheetName = daySelect?.value || Object.keys(cachedData.daily)[0];
  if (daySelect && !daySelect.value && sheetName) daySelect.value = sheetName;

  const raw = cachedData.daily[sheetName] || [];
  const { headerIdx, header, body } = normalizeTable(raw);

  if (!header.length) {
    $("main-view").innerHTML = "";
    showEmpty(true);
    return;
  }

  showEmpty(false);
  $("main-view").innerHTML = buildDailyCards(sheetName, headerIdx, header, body);
  searchCards();
}

function buildDailyCards(sheetName, headerIdx, header, body) {
  const colRef   = findCol(header, ["reference", "ref"]);
  const colEmp   = findCol(header, ["employee", "emp id", "id", "អត្តលេខ"]);
  const colFn    = findCol(header, ["first", "នាមខ្លួន"]);
  const colLn    = findCol(header, ["last", "នាមត្រកូល"]);
  const colName  = findCol(header, ["name", "ឈ្មោះ"]);
  const colDate  = findCol(header, ["date", "ថ្ងៃ"]);
  const colTime  = findCol(header, ["timetable", "time table", "session", "shift"]);
  const colIn    = findCol(header, ["check in", "checkin"]);
  const colOut   = findCol(header, ["check out", "checkout"]);
  const colClkIn = findCol(header, ["clock in", "clockin"]);
  const colClkOut= findCol(header, ["clock out", "clockout"]);
  const colRemark= findCol(header, ["remark", "remarks", "note", "កំណត់ចំណាំ"]);

  let html = "";

  for (let r = 0; r < body.length; r++) {
    const row = body[r] || [];
    const realRow0 = headerIdx + 1 + r;

    const first = colFn >= 0 ? row[colFn] : "";
    const last  = colLn >= 0 ? row[colLn] : "";
    const fallbackName = colName >= 0 ? row[colName] : "";
    const fullName = `${first || ""} ${last || ""}`.trim() || fallbackName || "(No name)";
    const badge = (colTime >= 0 ? row[colTime] : "") || "Daily";

    html += `
      <div class="card-item" data-search="${escapeHtml((fullName + " " + row.join(" ")).toLowerCase())}">
        <div class="card-top">
          <div class="card-name" title="${escapeHtml(fullName)}">${escapeHtml(fullName)}</div>
          <div class="card-badge">${escapeHtml(badge)}</div>
        </div>

        <div class="card-grid">
          ${cardKV("អត្តលេខ",  colEmp >= 0 ? row[colEmp] : "", sheetName, realRow0, colEmp)}
          ${cardKV("Reference", colRef >= 0 ? row[colRef] : "", sheetName, realRow0, colRef)}
          ${cardKV("ថ្ងៃ",       colDate >= 0 ? row[colDate] : "", sheetName, realRow0, colDate)}
          ${cardKV("Check In",   colIn >= 0 ? row[colIn] : "", sheetName, realRow0, colIn)}
          ${cardKV("Check Out",  colOut >= 0 ? row[colOut] : "", sheetName, realRow0, colOut)}
          ${cardKV("Clock In",   colClkIn >= 0 ? row[colClkIn] : "", sheetName, realRow0, colClkIn)}
          ${cardKV("Clock Out",  colClkOut >= 0 ? row[colClkOut] : "", sheetName, realRow0, colClkOut)}
          ${cardKV("កំណត់ចំណាំ", colRemark >= 0 ? row[colRemark] : "", sheetName, realRow0, colRemark)}
        </div>
      </div>
    `;
  }

  return html || "";
}

function renderSummary() {
  const raw = cachedData?.summary || [];
  const { headerIdx, header, body } = normalizeTable(raw);

  if (!header.length) {
    $("main-view").innerHTML = "";
    showEmpty(true);
    return;
  }

  showEmpty(false);
  $("main-view").innerHTML = buildSummaryCards("Summary", headerIdx, header, body);
  searchCards();
}

/* ✅ Summary FIX (Khmer headers A..I) */
function buildSummaryCards(sheetName, headerIdx, header, body) {
  const colID     = findCol(header, ["អត្តលេខ", "id"]);
  const colFn     = findCol(header, ["នាមខ្លួន", "first"]);
  const colLn     = findCol(header, ["នាមត្រកូល", "last"]);
  const colSex    = findCol(header, ["ភេទ", "sex"]);
  const colRole   = findCol(header, ["តួនាទី", "role", "position"]);
  const colTotal  = findCol(header, ["សរុបវត្តមាន", "total"]);
  const colAbsent = findCol(header, ["សរុបអវត្តមាន", "absent"]);
  const colLate   = findCol(header, ["សរុបយឺត", "late"]);

  const colExtra  = header.length >= 9 ? 8 : -1; // column I index=8

  const pick = (col, fallback) => (col >= 0 ? col : fallback);
  const gID     = pick(colID, 0);
  const gFn     = pick(colFn, 1);
  const gLn     = pick(colLn, 2);
  const gSex    = pick(colSex, 3);
  const gRole   = pick(colRole, 4);
  const gTotal  = pick(colTotal, 5);
  const gAbsent = pick(colAbsent, 6);
  const gLate   = pick(colLate, 7);

  const safeVal = (row, idx) => (idx >= 0 && idx < row.length ? row[idx] : "");

  let html = "";
  for (let r = 0; r < body.length; r++) {
    const row = body[r] || [];
    const realRow0 = headerIdx + 1 + r;

    const id = safeVal(row, gID);
    const first = safeVal(row, gFn);
    const last  = safeVal(row, gLn);
    const fullName = `${first || ""} ${last || ""}`.trim() || id || "(No name)";
    const badge = safeVal(row, gRole) || "Summary";

    html += `
      <div class="card-item" data-search="${escapeHtml((fullName + " " + row.join(" ")).toLowerCase())}">
        <div class="card-top">
          <div class="card-name" title="${escapeHtml(fullName)}">${escapeHtml(fullName)}</div>
          <div class="card-badge">${escapeHtml(badge)}</div>
        </div>

        <div class="card-grid">
          ${cardKV("អត្តលេខ", safeVal(row, gID), sheetName, realRow0, gID)}
          ${cardKV("ភេទ", safeVal(row, gSex), sheetName, realRow0, gSex)}
          ${cardKV("សរុបវត្តមាន", safeVal(row, gTotal), sheetName, realRow0, gTotal)}
          ${cardKV("សរុបអវត្តមាន", safeVal(row, gAbsent), sheetName, realRow0, gAbsent)}
          ${cardKV("សរុបយឺត", safeVal(row, gLate), sheetName, realRow0, gLate)}
          ${colExtra >= 0 ? cardKV(header[colExtra] || "សរុបបន្ថែម", safeVal(row, colExtra), sheetName, realRow0, colExtra) : ""}
        </div>
      </div>
    `;
  }
  return html || "";
}

/* -------------------------
   Search
-------------------------- */
function searchCards() {
  const q = ($("searchInput")?.value || "").toLowerCase().trim();
  const cards = document.querySelectorAll("#main-view .card-item");
  cards.forEach(card => {
    const text = (card.getAttribute("data-search") || "").toLowerCase();
    card.style.display = text.includes(q) ? "" : "none";
  });
}

/* -------------------------
   Admin modal & auth
-------------------------- */
function openAdminLogin() {
  $("admin-pass").value = "";
  setHidden($("admin-login-error"), true);
  setHidden($("admin-modal"), false);
  setTimeout(() => $("admin-pass").focus(), 50);
}
function closeAdminLogin() { setHidden($("admin-modal"), true); }

function showAdminError(msg) {
  const el = $("admin-login-error");
  if (!msg) { setHidden(el, true); el.textContent = ""; return; }
  el.textContent = msg;
  setHidden(el, false);
}

async function loginAdmin() {
  const pass = $("admin-pass").value.trim();
  if (!pass) { showAdminError("សូមបញ្ចូលលេខសម្ងាត់។"); return; }

  try {
    showAdminError("");
    showLoader(true);
    await apiAuth(pass);
    sessionStorage.setItem(STORAGE_KEY_ADMIN, pass);
    setAdminUI(true);
    closeAdminLogin();
    showToast("Admin Mode Enabled");
  } catch (e) {
    showAdminError(e.message || "Login failed");
  } finally {
    showLoader(false);
  }
}

function logoutAdmin() {
  sessionStorage.removeItem(STORAGE_KEY_ADMIN);
  setAdminUI(false);
  showToast("Admin Logged Out");
}

/* -------------------------
   Save edits
-------------------------- */
function onEditKeyDown(e, inputEl) {
  if (e.key === "Enter") {
    e.preventDefault();
    inputEl.blur();
  }
}

async function saveEditFromInput(inputEl) {
  const sheetName = inputEl.dataset.sheet;
  const row0 = parseInt(inputEl.dataset.row, 10);
  const col0 = parseInt(inputEl.dataset.col, 10);
  const value = inputEl.value;

  const pass = sessionStorage.getItem(STORAGE_KEY_ADMIN) || "";
  if (!pass) {
    showToast("Please login admin");
    setAdminUI(false);
    return;
  }

  try {
    inputEl.disabled = true;
    await apiUpdate(sheetName, row0, col0, value, pass);

    if (sheetName === "Summary") {
      if (cachedData?.summary?.[row0]) cachedData.summary[row0][col0] = value;
    } else {
      if (cachedData?.daily?.[sheetName]?.[row0]) cachedData.daily[sheetName][row0][col0] = value;
    }

    showToast("Saved");
  } catch (e) {
    showError(e.message || "Update failed");
    showToast("Save failed");
  } finally {
    inputEl.disabled = false;
  }
}

/* =========================================================
   ✅ PRINT SUMMARY A4 (Portrait) — EXACT 2 Pages
   - Header + Table page 1
   - Table continuation + totals + signature page 2
========================================================= */
function printSummaryA4() {
  if (!cachedData?.summary?.length) {
    showToast("No Summary data");
    return;
  }

  const raw = cachedData.summary || [];
  const { headerIdx, header, body } = normalizeTable(raw);
  if (!header.length || !body.length) {
    showToast("Summary empty");
    return;
  }

  // Split into exactly 2 pages (half / half)
  const totalRows = body.length;
  const mid = Math.ceil(totalRows / 2);
  const page1 = body.slice(0, mid);
  const page2 = body.slice(mid);

  // Compute totals: male/female and total attendance sum (col F)
  const colSex = 3;   // D
  const colTotalAttend = 5; // F (សរុបវត្តមាន)
  let male = 0, female = 0, sumAttend = 0;

  for (const r of body) {
    const sex = String(r[colSex] ?? "").trim().toUpperCase();
    if (sex === "M") male++;
    if (sex === "F") female++;
    const n = Number(String(r[colTotalAttend] ?? "").trim());
    if (!Number.isNaN(n)) sumAttend += n;
  }

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();

  const printHtml = buildPrintSummaryHTML({
    header,
    page1,
    page2,
    male,
    female,
    sumAttend,
    dateStr: `${dd}/${mm}/${yyyy}`,
  });

  const w = window.open("", "_blank");
  if (!w) {
    alert("Popup blocked. Please allow popups then try again.");
    return;
  }
  w.document.open();
  w.document.write(printHtml);
  w.document.close();

  // Wait images/fonts then print
  w.onload = () => {
    w.focus();
    w.print();
  };
}

function buildPrintSummaryHTML({ header, page1, page2, male, female, sumAttend, dateStr }) {
  const thead = `<tr>${header.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;

  const tbodyRows = (rows) =>
    rows.map(r => `<tr>${header.map((_, i) => `<td>${escapeHtml(r[i] ?? "")}</td>`).join("")}</tr>`).join("");

  // Change these titles if you want EXACT text like your form
  const title1 = "ព្រះរាជាណាចក្រកម្ពុជា";
  const title2 = "ជាតិ សាសនា ព្រះមហាក្សត្រ";
  const reportTitle = "របាយការណ៍សង្ខេបវត្តមានប្រចាំខែ";

  return `
<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Print Summary</title>

<link href="https://fonts.googleapis.com/css2?family=Hanuman:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">

<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Hanuman","Inter",sans-serif; color:#000; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  .header {
    display:flex; align-items:flex-start; justify-content:space-between;
    margin-bottom: 6mm;
  }
  .h-left { display:flex; gap:10mm; align-items:flex-start; }
  .logo {
    width: 22mm; height: 22mm; border-radius: 50%;
    object-fit: cover;
  }
  .h-mid { text-align:center; flex:1; }
  .h-mid .t1 { font-weight:700; font-size:13pt; }
  .h-mid .t2 { font-weight:700; font-size:12pt; margin-top:1mm; }
  .h-mid .rt { font-weight:700; font-size:12pt; margin-top:3mm; text-decoration: underline; }
  .h-right { width: 22mm; } /* balance */

  table { width:100%; border-collapse: collapse; table-layout: fixed; }
  th, td {
    border: 1px solid #000;
    padding: 2.2mm 1.5mm;
    font-size: 9.5pt;
    text-align: center;
    vertical-align: middle;
    word-wrap: break-word;
  }
  th { font-weight: 700; }

  .footer-box {
    margin-top: 6mm;
    width:100%;
  }
  .totals {
    width:100%;
    border-collapse: collapse;
    margin-top: 2mm;
  }
  .totals td {
    border: 1px solid #000;
    padding: 3mm 2mm;
    font-size: 10pt;
    font-weight: 700;
  }
  .sign {
    margin-top: 12mm;
    display:flex;
    justify-content: space-between;
    gap: 10mm;
    font-size: 10pt;
  }
  .sign .box {
    width: 45%;
    text-align: center;
  }
  .line {
    margin-top: 18mm;
    border-bottom: 1px dotted #000;
    height: 1px;
  }
  .date { margin-top: 4mm; font-size:10pt; }
</style>
</head>

<body>
  <!-- Page 1 -->
  <div class="page">
    <div class="header">
      <div class="h-left">
        <img class="logo" src="logo.png" onerror="this.style.display='none'">
      </div>

      <div class="h-mid">
        <div class="t1">${escapeHtml(title1)}</div>
        <div class="t2">${escapeHtml(title2)}</div>
        <div class="rt">${escapeHtml(reportTitle)}</div>
      </div>

      <div class="h-right"></div>
    </div>

    <table>
      <thead>${thead}</thead>
      <tbody>${tbodyRows(page1)}</tbody>
    </table>
  </div>

  <!-- Page 2 -->
  <div class="page">
    <table>
      <thead>${thead}</thead>
      <tbody>${tbodyRows(page2)}</tbody>
    </table>

    <div class="footer-box">
      <table class="totals">
        <tr>
          <td>ស្រី: ${female} នាក់</td>
          <td>ប្រុស: ${male} នាក់</td>
          <td>សរុបវត្តមាន: ${sumAttend}</td>
        </tr>
      </table>

      <div class="sign">
        <div class="box">
          <div>បានឃើញ និង អនុម័ត</div>
          <div><b>នាយកសាលា</b></div>
          <div class="line"></div>
        </div>

        <div class="box">
          <div class="date">ថ្ងៃទី ${escapeHtml(dateStr)}</div>
          <div><b>អ្នករៀបចំ</b></div>
          <div class="line"></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

/* -------------------------
   Pull-to-refresh (simple)
-------------------------- */
(function enablePullToRefresh(){
  let startY = 0;
  let pulling = false;

  window.addEventListener("touchstart", (e) => {
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    const y = e.touches[0].clientY;
    const diff = y - startY;
    const pullText = $("pullText");
    if (diff > 20 && pullText) pullText.textContent = diff > 90 ? "Release to refresh" : "Pull down to refresh";
  }, { passive: true });

  window.addEventListener("touchend", async (e) => {
    if (!pulling) return;
    pulling = false;
    const endY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : startY;
    const diff = endY - startY;
    if (diff > 90) await loadData(true);
    const pullText = $("pullText");
    if (pullText) pullText.textContent = "Pull down to refresh";
  }, { passive: true });
})();

/* -------------------------
   Boot
-------------------------- */
(function boot() {
  const pass = sessionStorage.getItem(STORAGE_KEY_ADMIN);
  setAdminUI(!!pass);
  window.onload = () => loadData(true);
})();
