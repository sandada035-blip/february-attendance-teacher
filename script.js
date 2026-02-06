/****************************************************
 * Attendance Pro - Mobile Only (Facebook style cards)
 * - Daily + Summary as feed cards
 * - Search cards
 * - Admin auth + edit/save on cards
 ****************************************************/

const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxIz2rJ-HxNX2Pe0Tw7_GURp11X_8Jd0C_es_3irLjOPG3iVl-aaur2Lc6gqy-PTdbU/exec";

let cachedData = null;
let currentTab = "daily"; // default daily
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

  // show logout button inside modal
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
    if (cachedData && !force) {
      render();
      return;
    }

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
  if (!daySelect.value && days.length) daySelect.value = days[days.length - 1]; // last/day
}

/* -------------------------
   Tabs
-------------------------- */
function showTab(tab) {
  currentTab = tab;

  document.querySelectorAll(".tab").forEach(el => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });

  // title
  $("subTitle").textContent = tab === "daily" ? "វត្តមានប្រចាំថ្ងៃ" : "សង្ខេបវត្តមានរួម";

  // search reset
  clearSearch(false);
  render();
}

function render() {
  // day select visible only in daily
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
   Cards (Facebook style)
-------------------------- */
function findCol(header, keywords) {
  const lower = header.map(h => String(h || "").toLowerCase());
  for (const kw of keywords) {
    const i = lower.findIndex(h => h.includes(kw));
    if (i >= 0) return i;
  }
  return -1;
}

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
  const colEmp   = findCol(header, ["employee", "emp id", "id"]);
  const colFn    = findCol(header, ["first"]);
  const colLn    = findCol(header, ["last"]);
  const colName  = findCol(header, ["name"]);
  const colDate  = findCol(header, ["date"]);
  const colTime  = findCol(header, ["timetable", "time table", "session", "shift"]);
  const colIn    = findCol(header, ["check in", "checkin"]);
  const colOut   = findCol(header, ["check out", "checkout"]);
  const colClkIn = findCol(header, ["clock in", "clockin"]);
  const colClkOut= findCol(header, ["clock out", "clockout"]);
  const colRemark= findCol(header, ["remark", "remarks", "note"]);

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
          ${cardKV("Employee ID",  colEmp >= 0 ? row[colEmp] : "", sheetName, realRow0, colEmp)}
          ${cardKV("Reference",    colRef >= 0 ? row[colRef] : "", sheetName, realRow0, colRef)}
          ${cardKV("Date",         colDate >= 0 ? row[colDate] : "", sheetName, realRow0, colDate)}
          ${cardKV("Check In",     colIn >= 0 ? row[colIn] : "", sheetName, realRow0, colIn)}
          ${cardKV("Check Out",    colOut >= 0 ? row[colOut] : "", sheetName, realRow0, colOut)}
          ${cardKV("Clock In",     colClkIn >= 0 ? row[colClkIn] : "", sheetName, realRow0, colClkIn)}
          ${cardKV("Clock Out",    colClkOut >= 0 ? row[colClkOut] : "", sheetName, realRow0, colClkOut)}
          ${cardKV("Remark",       colRemark >= 0 ? row[colRemark] : "", sheetName, realRow0, colRemark)}
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

  // Summary as cards too
  $("main-view").innerHTML = buildSummaryCards("Summary", headerIdx, header, body);
  searchCards();
}

function buildSummaryCards(sheetName, headerIdx, header, body) {
  const colName = findCol(header, ["name"]);
  const colEmp  = findCol(header, ["employee", "emp", "id"]);
  const colStatus = findCol(header, ["status"]);
  const colTotal = findCol(header, ["total"]);
  const colAbsent = findCol(header, ["absent"]);
  const colLate = findCol(header, ["late"]);

  let html = "";

  for (let r = 0; r < body.length; r++) {
    const row = body[r] || [];
    const realRow0 = headerIdx + 1 + r;

    const name = colName >= 0 ? row[colName] : (row[0] ?? "(No name)");
    const badge = colStatus >= 0 ? row[colStatus] : "Summary";

    // Show a few important fields; the rest can be edited in admin (optional)
    html += `
      <div class="card-item" data-search="${escapeHtml((String(name) + " " + row.join(" ")).toLowerCase())}">
        <div class="card-top">
          <div class="card-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
          <div class="card-badge">${escapeHtml(badge)}</div>
        </div>

        <div class="card-grid">
          ${cardKV("Employee", colEmp >= 0 ? row[colEmp] : "", sheetName, realRow0, colEmp)}
          ${cardKV("Total",    colTotal >= 0 ? row[colTotal] : "", sheetName, realRow0, colTotal)}
          ${cardKV("Absent",   colAbsent >= 0 ? row[colAbsent] : "", sheetName, realRow0, colAbsent)}
          ${cardKV("Late",     colLate >= 0 ? row[colLate] : "", sheetName, realRow0, colLate)}
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

function closeAdminLogin() {
  setHidden($("admin-modal"), true);
}

function showAdminError(msg) {
  const el = $("admin-login-error");
  if (!msg) {
    setHidden(el, true);
    el.textContent = "";
    return;
  }
  el.textContent = msg;
  setHidden(el, false);
}

async function loginAdmin() {
  const pass = $("admin-pass").value.trim();
  if (!pass) {
    showAdminError("សូមបញ្ចូលលេខសម្ងាត់។");
    return;
  }

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

    // update cachedData locally
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
    if (diff > 90) {
      await loadData(true);
    }
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
