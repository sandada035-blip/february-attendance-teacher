const API =
  "https://script.google.com/macros/s/AKfycbxQgrd4SLeZvFffCcFwMP_dzWkDn3VjxrZa-8coP6D_VvJQgwjvp87DPUzFdI3tf_7Q/exec";

const sheets = ["Summary", ...Array.from({ length: 30 }, (_, i) => `Day${i+2}`)];

const sheetSelect = document.getElementById("sheetSelect");

sheets.forEach(s => {
  const opt = document.createElement("option");
  opt.value = s;
  opt.textContent = s;
  sheetSelect.appendChild(opt);
});

async function loadData() {
  const sheet = sheetSelect.value;
  const res = await fetch(`${API}?sheet=${sheet}`);
  const json = await res.json();
  renderTable(json.rows);
}

function renderTable(rows) {
  const table = document.getElementById("dataTable");
  table.innerHTML = "";

  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  table.innerHTML += `
    <tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>
  `;

  rows.forEach((r, i) => {
    table.innerHTML += `
      <tr>
        ${headers.map(h =>
          `<td contenteditable onblur="updateCell(${i+2}, '${h}', this.innerText)">
            ${r[h] ?? ""}
          </td>`
        ).join("")}
      </tr>`;
  });
}

async function updateCell(row, colName, value) {
  await fetch(API, {
    method: "POST",
    body: JSON.stringify({
      sheet: sheetSelect.value,
      row,
      col: getColIndex(colName),
      value
    })
  });
}

function getColIndex(name) {
  return [...document.querySelectorAll("th")]
    .findIndex(th => th.innerText === name) + 1;
}

loadData();



