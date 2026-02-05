/**************************************************
 * CONFIG
 **************************************************/
const API =
  "https://script.google.com/macros/s/AKfycbxQgrd4SLeZvFffCcFwMP_dzWkDn3VjxrZa-8coP6D_VvJQgwjvp87DPUzFdI3tf_7Q/exec";

const HEADERS = [
  "Reference ID",
  "Employee ID",
  "First Name",
  "Last Name",
  "Gender",
  "Position",
  "Date",
  "Timetable",
  "Check In",
  "Check Out",
  "Clock In",
  "Clock Out",
  "Total Scan",
  "Total Forget Scan",
  "Total Permission",
  "Total Mission",
  "Remark"
];

/**************************************************
 * Sheet selector
 **************************************************/
const sheets = ["Summary", ...Array.from({ length: 30 }, (_, i) => `Day${i + 2}`)];
const sheetSelect = document.getElementById("sheetSelect");
const dateInput = document.getElementById("dateInput"); // ⚠️ id ត្រូវមាន

sheets.forEach(s => {
  const opt = document.createElement("option");
  opt.value = s;
  opt.textContent = s;
  sheetSelect.appendChild(opt);
});

/**************************************************
 * Load data
 **************************************************/
async function loadData() {
  try {
    const sheet = sheetSelect.value;
    const res = await fetch(`${API}?sheet=${sheet}`);
    const json = await res.json();

    if (!json.success) {
      alert(json.error || "API error");
      return;
    }

    let rows = json.rows;

    // ✅ Apply date filter
    rows = filterByDate(rows, dateInput?.value);

    renderTable(rows);
  } catch (err) {
    console.error(err);
    alert("Failed to load data");
  }
}

/**************************************************
 * Render table
 **************************************************/
function renderTable(rows) {
  const table = document.getElementById("dataTable");
  table.innerHTML = "";

  // Header
  table.innerHTML += `
    <tr>
      ${HEADERS.map(h => `<th>${h}</th>`).join("")}
    </tr>
  `;

  // Rows
  rows.forEach((r, rowIndex) => {
    table.innerHTML += `
      <tr>
        ${HEADERS.map((h, colIndex) => `
          <td contenteditable
              onblur="updateCell(${rowIndex + 2}, ${colIndex + 1}, this.innerText)">
            ${r[h] ?? ""}
          </td>
        `).join("")}
      </tr>
    `;
  });
}

/**************************************************
 * Date filter (fix format)
 **************************************************/
function filterByDate(rows, selectedDate) {
  if (!selectedDate) return rows;

  // input: yyyy-mm-dd → dd/mm/yyyy
  const [y, m, d] = selectedDate.split("-");
  const sheetDate = `${d}/${m}/${y}`;

  return rows.filter(r => r["Date"] === sheetDate);
}

/**************************************************
 * Update cell
 **************************************************/
async function updateCell(row, col, value) {
  try {
    await fetch(API, {
      method: "POST",
      body: JSON.stringify({
        sheet: sheetSelect.value,
        row,
        col,
        value
      })
    });
  } catch (err) {
    console.error(err);
    alert("Failed to update cell");
  }
}

// Init
loadData();
