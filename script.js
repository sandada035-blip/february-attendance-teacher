/**************************************************
 * CONFIG
 **************************************************/
const API =
  "https://script.google.com/macros/s/AKfycbxQgrd4SLeZvFffCcFwMP_dzWkDn3VjxrZa-8coP6D_VvJQgwjvp87DPUzFdI3tf_7Q/exec";

/**************************************************
 * Khmer → English Mapping
 **************************************************/
const FIELD_MAP = [
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

const KH_HEADERS = FIELD_MAP.map(f => f.kh);
const EN_HEADERS = FIELD_MAP.map(f => f.en);

/**************************************************
 * Load data
 **************************************************/
async function loadData() {
  const sheet = document.getElementById("sheetSelect").value;

  const res = await fetch(`${API}?sheet=${sheet}`);
  const json = await res.json();

  if (!json.success) {
    alert(json.error || "API error");
    return;
  }

  renderTable(json.rows);
}

/**************************************************
 * Render bilingual table
 **************************************************/
function renderTable(rows) {
  const table = document.getElementById("dataTable");
  table.innerHTML = "";

  // Header (Khmer + English)
  table.innerHTML += `
    <tr>
      ${FIELD_MAP.map(
        f => `<th>${f.kh}<br><small>${f.en}</small></th>`
      ).join("")}
    </tr>
  `;

  rows.forEach((r, rowIndex) => {
    table.innerHTML += `
      <tr>
        ${FIELD_MAP.map((f, colIndex) => `
          <td contenteditable
              onblur="updateCell(${rowIndex + 2}, ${colIndex + 1}, this.innerText)">
            ${r[f.kh] ?? ""}
          </td>
        `).join("")}
      </tr>
    `;
  });
}

/**************************************************
 * Update cell
 **************************************************/
async function updateCell(row, col, value) {
  const sheet = document.getElementById("sheetSelect").value;

  await fetch(API, {
    method: "POST",
    body: JSON.stringify({
      sheet,
      row,
      col,
      value
    })
  });
}

/**************************************************
 * Init
 **************************************************/
loadData();
