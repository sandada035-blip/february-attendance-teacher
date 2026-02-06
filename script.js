/****************************************************
 * Attendance Pro - script.js (FINAL PRO)
 * Desktop: Table (✅ Freeze Header)
 * Mobile: Facebook-style Cards
 * Admin: Auth + Edit/Save (Table + Cards)
 ****************************************************/

const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxIz2rJ-HxNX2Pe0Tw7_GURp11X_8Jd0C_es_3irLjOPG3iVl-aaur2Lc6gqy-PTdbU/exec";

let cachedData = null;
let currentTab = "summary";
let isAdmin = false;

const STORAGE_KEY_ADMIN = "attendance_admin_pass";

/* -------------------------
   Helpers (DOM/UI)
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

  setHidden($("admin-btn"), on);
  setHidden($("admin-logout-btn"), !on);

  if (cachedData) render();
}

/* -------------------------
   Responsive / Mobile
-------------------------- */
function isMobile() {
  return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
}

/* -------------------------
   Table normalization
   - Finds best header row within first N rows
   - Trims extra empty columns
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
   API calls (CORS-safe)
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
    // ✅ avoid CORS preflight
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
    body: JSON.stringify({
      action: "update",
      sheetName,
      row: row0,
      col: col0,
      value,
      pass,
    }),
  });

  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Update failed");
  return true;
}

/* -------------------------
   Main Load
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

    const data = await apiGetData();
    cachedData = data;

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
}

/* -------------------------
   Render (Summary / Daily)
-------------------------- */
function render() {
  setHidden($("filter-group"), currentTab !== "daily");

  if (currentTab === "summary") renderSummary();
  else renderDaily();
}

/* ✅ Helper: build header row with freeze first column (optional) */
function buildTheadRow(header) {
  return header
    .map((h, c) => `<th class="${c === 0 ? "freeze-col" : ""}">${escapeHtml(h)}</th>`)
    .join("");
}

function renderSummary() {
  $("view-title").textContent = "សង្ខេបវត្តមានរួម";

  const raw = cachedData?.summary || [];
  const { headerIdx, header, body } = normalizeTable(raw);

  if (!header.length) {
    $("main-view").innerHTML = "";
    showEmpty(true);
    return;
  }

  showEmpty(false);

  // Summary always show table (cards optional; keep table for now)
  $("main-view").classList.remove("has-cards");

  let html = `
    <div class="table-scroller">
      <table>
        <thead>
          <tr>${buildTheadRow(header)}</tr>
        </thead>
        <tbody>
  `;

  for (let r = 0; r < body.length; r++) {
    const row = body[r] || [];
    const realRow0 = headerIdx + 1 + r;

    html += "<tr>";

    for (let c = 0; c < header.length; c++) {
      const cell = row[c] ?? "";
      const isZero = String(cell).trim() === "0";
      const style = isZero ? ` style="color:#b91c1c;font-weight:800;"` : "";
      const freezeClass = c === 0 ? ` class="freeze-col"` : "";

      if (isAdmin) {
        html += `<td${freezeClass}>
          <input class="edit-input"
            value="${escapeHtml(cell)}"
            data-sheet="Summary"
            data-row="${realRow0}"
            data-col="${c}"
            onkeydown="onEditKeyDown(event,this)"
            onchange="saveEditFromInput(this)"
          />
        </td>`;
      } else {
        html += `<td${freezeClass}${style}>${escapeHtml(cell)}</td>`;
      }
    }

    html += "</tr>";
  }

  html += `
        </tbody>
      </table>
    </div>
  `;

  $("main-view").innerHTML = html;
}

function renderDaily() {
  $("view-title").textContent = "វត្តមានប្រចាំថ្ងៃ";

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

  // ✅ Mobile: Cards
  if (isMobile()) {
    $("main-view").classList.add("has-cards");
    $("main-view").innerHTML = renderDailyCards(sheetName, headerIdx, header, body);
    searchTable();
    return;
  }

  // ✅ Desktop: Table (✅ Freeze Header)
  $("main-view").classList.remove("has-cards");

  let html = `
    <div class="table-scroller">
      <table>
        <thead>
          <tr>${buildTheadRow(header)}</tr>
        </thead>
        <tbody>
  `;

  for (let r = 0; r < body.length; r++) {
    const row = body[r] || [];
    const realRow0 = headerIdx + 1 + r;

    html += "<tr>";

    for (let c = 0; c < header.length; c++) {
      const cell = row[c] ?? "";
      const isZero = String(cell).trim() === "0";
      const style = isZero ? ` style="color:#b91c1c;font-weight:800;"` : "";
      const freezeClass = c === 0 ? ` class="freeze-col"` : "";

      if (isAdmin) {
        html += `<td${freezeClass}>
          <input class="edit-input"
            value="${escapeHtml(cell)}"
            data-sheet="${escapeHtml(sheetName)}"
            data-row="${realRow0}"
            data-col="${c}"
            onkeydown="onEditKeyDown(event,this)"
            onchange="saveEditFromInput(this)"
          />
        </td>`;
      } else {
        html += `<td${freezeClass}${style}>${escapeHtml(cell)}</td>`;
      }
    }

    html += "</tr>";
  }

  html += `
        </tbody>
      </table>
    </div>
  `;

  $("main-view").innerHTML = html;
}

/* -------------------------
   Cards rendering (Mobile)
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

function renderDailyCards(sheetName, headerIdx, header, body) {
  const colRef   = findCol(header, ["reference", "ref"]);
  const colEmp   = findCol(header, ["employee"]);
  const colFn    = findCol(header, ["first"]);
  const colLn    = findCol(header, ["last"]);
  const colDate  = findCol(header, ["date"]);
  const colTime  = findCol(header, ["timetable", "time table", "session"]);
  const colIn    = findCol(header, ["check in", "checkin"]);
  const colOut   = findCol(header, ["check out", "checkout"]);
  const colClkIn = findCol(header, ["clock in", "clockin"]);
  const colClkOut= findCol(header, ["clock out", "clockout"]);

  let html = `<div class="cards mobile-only">`;

  for (let r = 0; r < body.length; r++) {
    const row = body[r] || [];
    const realRow0 = headerIdx + 1 + r;

    const first = colFn >= 0 ? row[colFn] : "";
    const last  = colLn >= 0 ? row[colLn] : "";
    const fullName = `${first || ""} ${last || ""}`.trim()
      || (colEmp >= 0 ? row[colEmp] : "")
      || "(No name)";

    const badge = (colTime >= 0 ? row[colTime] : "") || "Daily";

    html += `
      <div class="card-item" data-search="${escapeHtml((fullName + " " + (row.join(" "))).toLowerCase())}">
        <div class="card-top">
          <div class="card-name" title="${escapeHtml(fullName)}">${escapeHtml(fullName)}</div>
          <div class="card-badge">${escapeHtml(badge)}</div>
        </div>

        <div class="card-grid">
          ${cardKV("Reference ID", colRef >= 0 ? row[colRef] : "", sheetName, realRow0, colRef)}
          ${cardKV("Employee ID",  colEmp >= 0 ? row[colEmp] : "", sheetName, realRow0, colEmp)}
          ${cardKV("Date",         colDate >= 0 ? row[colDate] : "", sheetName, realRow0, colDate)}
          ${cardKV("Check In",     colIn >= 0 ? row[colIn] : "", sheetName, realRow0, colIn)}
          ${cardKV("Check Out",    colOut >= 0 ? row[colOut] : "", sheetName, realRow0, colOut)}
          ${cardKV("Clock In",     colClkIn >= 0 ? row[colClkIn] : "", sheetName, realRow0, colClkIn)}
          ${cardKV("Clock Out",    colClkOut >= 0 ? row[colClkOut] : "", sheetName, realRow0, colClkOut)}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

/* -------------------------
   Search (Table + Cards)
-------------------------- */
function searchTable() {
  const q = ($("searchInput")?.value || "").toLowerCase().trim();

  // Table filter
  const table = document.querySelector("#main-view table");
  if (table) {
    const rows = table.querySelectorAll("tbody tr");
    rows.forEach(tr => {
      const text = tr.innerText.toLowerCase();
      tr.style.display = text.includes(q) ? "" : "none";
    });
  }

  // Cards filter
  const cards = document.querySelectorAll("#main-view .card-item");
  if (cards && cards.length) {
    cards.forEach(card => {
      const text = (card.getAttribute("data-search") || "").toLowerCase();
      card.style.display = text.includes(q) ? "" : "none";
    });
  }
}

/* -------------------------
   Tabs (Active states)
-------------------------- */
function showTab(tab) {
  currentTab = tab;

  document.querySelectorAll(".menu-item").forEach(el => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });
  document.querySelectorAll(".m-nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });

  render();
}

/* -------------------------
   Admin Modal & Auth
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
    inputEl.blur(); // triggers onchange
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

    // update cachedData locally (best-effort)
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
   Boot
-------------------------- */
(function boot() {
  const pass = sessionStorage.getItem(STORAGE_KEY_ADMIN);
  setAdminUI(!!pass);

  // re-render on rotate/resize (mobile <-> desktop)
  window.addEventListener("resize", () => {
    if (cachedData && currentTab === "daily") renderDaily();
  });

  window.onload = () => loadData(true);
})();
