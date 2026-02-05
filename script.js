const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIz2rJ-HxNX2Pe0Tw7_GURp11X_8Jd0C_es_3irLjOPG3iVl-aaur2Lc6gqy-PTdbU/exec";
let cachedData = null;
let currentTab = 'summary';

async function loadData() {
    showLoader(true);
    const icon = document.getElementById('refresh-icon');
    icon.classList.add('fa-spin');

    try {
        const response = await fetch(WEB_APP_URL);
        cachedData = await response.json();
        
        // បំពេញចន្លោះក្នុង Select Day
        populateDaySelect();
        
        if (currentTab === 'summary') {
            renderSummaryTable();
        } else {
            renderDailyTable();
        }
    } catch (error) {
        alert("ការទាញទិន្នន័យមានបញ្ហា! សូមពិនិត្យ Web App URL របស់អ្នក។");
        console.error(error);
    } finally {
        showLoader(false);
        icon.classList.remove('fa-spin');
    }
}

function populateDaySelect() {
    const select = document.getElementById('day-select');
    const days = Object.keys(cachedData.daily);
    select.innerHTML = days.map(day => `<option value="${day}">${day}</option>`).join('');
}

function renderSummaryTable() {
    const data = cachedData.summary;
    let html = `<table><thead><tr>`;
    // Headers
    data[0].forEach(h => html += `<th>${h}</th>`);
    html += `</tr></thead><tbody>`;
    // Rows
    for (let i = 1; i < data.length; i++) {
        html += `<tr>${data[i].map(cell => `<td>${cell}</td>`).join('')}</tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById('table-wrapper').innerHTML = html;
}

function renderDailyTable() {
    const selectedDay = document.getElementById('day-select').value;
    const data = cachedData.daily[selectedDay];
    if (!data) return;

    let html = `<table><thead><tr>`;
    // Header Day (យកជួរទី ២ តាមរូបភាពរបស់អ្នក)
    data[1].forEach(h => html += `<th>${h}</th>`);
    html += `</tr></thead><tbody>`;
    
    for (let i = 2; i < data.length; i++) {
        html += `<tr>`;
        data[i].forEach((cell, idx) => {
            // បើជាក្រឡាទិន្នន័យស្កេន អាចដាក់ពណ៌បាន
            let style = cell === "0" ? "color: red; font-weight: bold;" : "";
            html += `<td style="${style}">${cell}</td>`;
        });
        html += `</tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById('table-wrapper').innerHTML = html;
}

function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    document.getElementById('view-title').innerText = tab === 'summary' ? 'Summary Dashboard' : 'Daily Attendance';
    document.getElementById('day-filter-container').className = tab === 'summary' ? 'hidden' : '';
    
    if (cachedData) {
        tab === 'summary' ? renderSummaryTable() : renderDailyTable();
    }
}

function showLoader(show) {
    document.getElementById('loader').className = show ? 'loader-container' : 'hidden';
    document.getElementById('table-wrapper').className = show ? 'hidden' : 'table-card';
}

// ចាប់ផ្តើមទាញទិន្នន័យពេលបើក Page
window.onload = loadData;
