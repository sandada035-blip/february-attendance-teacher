const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIz2rJ-HxNX2Pe0Tw7_GURp11X_8Jd0C_es_3irLjOPG3iVl-aaur2Lc6gqy-PTdbU/exec";
let cachedData = null;
let isAdmin = false;
let adminPass = "";
let currentTab = 'summary';

async function loadData() {
    showLoader(true);
    try {
        const response = await fetch(WEB_APP_URL);
        cachedData = await response.json();
        populateDaySelect();
        currentTab === 'summary' ? renderSummary() : renderDaily();
    } catch (error) {
        alert("ការទាញទិន្នន័យមានបញ្ហា!");
    } finally {
        showLoader(false);
    }
}

function renderSummary() {
    const data = cachedData.summary;
    let html = `<table><thead><tr>`;
    data[0].forEach(h => html += `<th>${h}</th>`);
    html += `</tr></thead><tbody>`;
    for (let i = 1; i < data.length; i++) {
        html += `<tr>${data[i].map(cell => `<td>${cell}</td>`).join('')}</tr>`;
    }
    document.getElementById('main-view').innerHTML = html + `</tbody></table>`;
    document.getElementById('filter-area').style.display = 'none';
}

function renderDaily() {
    const day = document.getElementById('day-select').value;
    const data = cachedData.daily[day];
    let html = `<table><thead><tr>`;
    data[1].forEach(h => html += `<th>${h}</th>`); // Header ជួរទី២
    html += `</tr></thead><tbody>`;
    
    for (let i = 2; i < data.length; i++) {
        html += `<tr>`;
        data[i].forEach((cell, idx) => {
            if (isAdmin) {
                html += `<td><input class="edit-input" value="${cell}" onchange="saveEdit('${day}', ${i}, ${idx}, this.value)"></td>`;
            } else {
                let style = cell === "0" ? "color: red; font-weight: bold;" : "";
                html += `<td style="${style}">${cell}</td>`;
            }
        });
        html += `</tr>`;
    }
    document.getElementById('main-view').innerHTML = html + `</tbody></table>`;
    document.getElementById('filter-area').style.display = 'block';
}

async function saveEdit(sheetName, row, col, value) {
    const payload = { sheetName, row, col, value, pass: adminPass };
    
    // បង្ហាញ Loading តិចៗពេលកំពុង Save
    const statusBox = document.getElementById('admin-status');
    statusBox.innerText = "កំពុងរក្សាទុក...";

    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors', // សំខាន់សម្រាប់ផ្ញើទៅ Google Script
            body: JSON.stringify(payload)
        });
        statusBox.innerText = "រក្សាទុកជោគជ័យ!";
        setTimeout(() => statusBox.innerText = "Mode: Admin (Full Access)", 2000);
    } catch (error) {
        alert("ការរក្សាទុកមានបញ្ហា!");
    }
}

function loginAdmin() {
    const p = prompt("សូមបញ្ចូលលេខសម្ងាត់ Admin:");
    if (p === "1234") {
        isAdmin = true;
        adminPass = p;
        document.getElementById('admin-status').innerHTML = `<i class="fas fa-unlock"></i> Mode: Admin (Full Access)`;
        document.getElementById('admin-status').style.background = "#dcfce7";
        currentTab === 'summary' ? renderSummary() : renderDaily();
    }
}

function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    loadData(); // ទាញទិន្នន័យថ្មីពេលប្តូរ Tab
}

function populateDaySelect() {
    const select = document.getElementById('day-select');
    const days = Object.keys(cachedData.daily);
    select.innerHTML = days.map(d => `<option value="${d}">${d}</option>`).join('');
}

function showLoader(show) {
    document.getElementById('loader').style.display = show ? 'block' : 'none';
}

window.onload = loadData;
