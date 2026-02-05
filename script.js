const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIz2rJ-HxNX2Pe0Tw7_GURp11X_8Jd0C_es_3irLjOPG3iVl-aaur2Lc6gqy-PTdbU/exec"; // ដាក់ URL របស់អ្នក
let cachedData = null;
let isAdmin = false;
let currentTab = 'summary';

async function loadData() {
    showLoader(true);
    try {
        const res = await fetch(WEB_APP_URL);
        cachedData = await res.json();
        render();
    } catch (e) { alert("Error connecting to server!"); }
    finally { showLoader(false); }
}

function render() {
    currentTab === 'summary' ? renderSummary() : renderDaily();
}

function renderDaily() {
    const daySelect = document.getElementById('day-select');
    if(daySelect.options.length === 0) {
        Object.keys(cachedData.daily).forEach(d => daySelect.add(new Option(d, d)));
    }
    
    const data = cachedData.daily[daySelect.value];
    let html = `<table><thead><tr>${data[1].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
    
    for (let i = 2; i < data.length; i++) {
        html += `<tr>${data[i].map((cell, idx) => {
            let style = (cell === "0" || cell === 0) ? "color:red; font-weight:bold" : "";
            if(isAdmin) return `<td><input class="edit-input" value="${cell}" onchange="saveEdit('${daySelect.value}',${i},${idx},this.value)"></td>`;
            return `<td style="${style}">${cell}</td>`;
        }).join('')}</tr>`;
    }
    document.getElementById('main-view').innerHTML = html + "</tbody></table>";
    document.getElementById('filter-group').style.display = 'flex';
}

function searchTable() {
    let input = document.getElementById("searchInput").value.toUpperCase();
    let rows = document.querySelector("table tbody").rows;
    for (let row of rows) {
        let text = row.innerText.toUpperCase();
        row.style.display = text.includes(input) ? "" : "none";
    }
}

function showTab(tab) {
    currentTab = tab;
    document.getElementById('view-title').innerText = tab === 'summary' ? "សង្ខេបវត្តមានរួម" : "វត្តមានប្រចាំថ្ងៃ";
    document.querySelectorAll('.menu-item, .m-nav-item').forEach(el => el.classList.remove('active'));
    render();
}

function showLoader(s) { document.getElementById('loader').style.display = s ? 'block' : 'none'; }

window.onload = loadData;
