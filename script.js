/**************************************************
 * CONFIG
 **************************************************/
const API =
  "https://script.google.com/macros/s/AKfycbxQgrd4SLeZvFffCcFwMP_dzWkDn3VjxrZa-8coP6D_VvJQgwjvp87DPUzFdI3tf_7Q/exec";

/**************************************************
 * Bilingual Mapping (Khmer → English)
 **************************************************/

let CURRENT_LANG = "kh";

const I18N = {
  kh: {
    present: "វត្តមាន",
    absent: "អវត្តមាន",
    permission: "ច្បាប់",
    mission: "បេសកកម្ម"
  },
  en: {
    present: "Present",
    absent: "Absent",
    permission: "Permission",
    mission: "Mission"
  }
};

function setLang(lang) {
  CURRENT_LANG = lang;
  document.getElementById("lbl-present").innerText = I18N[lang].present;
  document.getElementById("lbl-absent").innerText = I18N[lang].absent;
  document.getElementById("lbl-permission").innerText = I18N[lang].permission;
  document.getElementById("lbl-mission").innerText = I18N[lang].mission;
}



const FIELDS = [
  { kh: "កូដគ្រូ", en: "Employee ID" },
  { kh: "នាមខ្លួន", en: "First Name" },
  { kh: "នាមត្រកូល", en: "Last Name" },
  { kh: "ភេទ", en: "Gender" },
  { kh: "តួនាទី", en: "Position" },
  { kh: "សរុបថ្ងៃ", en: "Total Days" },
  { kh: "អវត្តមាន", en: "Absent" },
  { kh: "ច្បាប់", en: "Permission" },
  { kh: "បេសកកម្ម", en: "Mission" }
];

/**************************************************
 * Sheet selector
 **************************************************/
const sheets = ["Summary", ...Array.from({ length: 30 }, (_, i) => `Day${i + 2}`)];
const sheetSelect = document.getElementById("sheetSelect");

sheets.forEach(s => {
  const o = document.createElement("option");
  o.value = s;
  o.textContent = s;
  sheetSelect.appendChild(o);
});

/**************************************************
 * Load Data
 **************************************************/
async function loadData() {
  const sheet = sheetSelect.value;
  const date = document.getElementById("dateInput").value;

  const res = await fetch(`${API}?sheet=${sheet}`);
  const json = await res.json();

  if (!json.success) {
    alert("API Error");
    return;
  }

  let rows = json.rows;

  if (date && json.headers.includes("Date")) {
    const [y, m, d] = date.split("-");
    const formatted = `${d}/${m}/${y}`;
    rows = rows.filter(r => r["Date"] === formatted);
  }

  renderTable(rows);
}

/**************************************************
 * Render Table
 **************************************************/
function renderTable(rows) {
  const table = document.getElementById("dataTable");
  table.innerHTML = `
    <tr>
      ${FIELDS.map(f => `<th>${f.kh}<br><small>${f.en}</small></th>`).join("")}
    </tr>
  `;

  rows.forEach((r, i) => {
    table.innerHTML += `
      <tr>
        ${FIELDS.map((f, j) => `
          <td contenteditable
              onblur="updateCell(${i + 2}, ${j + 1}, this.innerText)">
            ${r[f.kh] ?? ""}
          </td>
        `).join("")}
      </tr>
    `;
  });
}

function updateSummary(rows) {
  let present = 0, absent = 0, permission = 0, mission = 0;

  rows.forEach(r => {
    present += Number(r["សរុបថ្ងៃ"] || 0);
    absent += Number(r["អវត្តមាន"] || 0);
    permission += Number(r["ច្បាប់"] || 0);
    mission += Number(r["បេសកកម្ម"] || 0);
  });

  document.getElementById("sum-present").innerText = present;
  document.getElementById("sum-absent").innerText = absent;
  document.getElementById("sum-permission").innerText = permission;
  document.getElementById("sum-mission").innerText = mission;
}



/**************************************************
 * Update Cell
 **************************************************/
async function updateCell(row, col, value) {
  await fetch(API, {
    method: "POST",
    body: JSON.stringify({
      sheet: sheetSelect.value,
      row,
      col,
      value
    })
  });
}

// Init
loadData();

