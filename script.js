const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIz2rJ-HxNX2Pe0Tw7_GURp11X_8Jd0C_es_3irLjOPG3iVl-aaur2Lc6gqy-PTdbU/exec"; // ដាក់ URL ដែលបានមកពី Deployment

let masterData = [];

async function fetchData() {
    const response = await fetch(WEB_APP_URL + "?action=getData");
    const result = await response.json();
    masterData = result.attendance;
    renderAttendance(masterData);
    updateStats(masterData);
}

function renderAttendance(data) {
    const body = document.getElementById('attendanceBody');
    body.innerHTML = data.map((row, index) => `
        <tr class="hover:bg-gray-50">
            <td class="p-4 border-b font-medium">${row.id}</td>
            <td class="p-4 border-b">${row.name}</td>
            <td class="p-4 border-b text-sm">${row.position}</td>
            <td class="p-4 border-b font-mono text-green-600">${row.checkIn || '-'}</td>
            <td class="p-4 border-b font-mono text-red-600">${row.checkOut || '-'}</td>
            <td class="p-4 border-b">
                <span class="px-3 py-1 rounded-full text-xs ${getStatusClass(row.status)}">${row.status || 'វត្តមាន'}</span>
            </td>
            <td class="p-4 border-b">
                <button onclick="openEditModal(${index})" class="text-blue-600 hover:underline">កែប្រែ</button>
            </td>
        </tr>
    `).join('');
}

function filterByName() {
    const val = document.getElementById('searchName').value.toLowerCase();
    const filtered = masterData.filter(item => item.name.toLowerCase().includes(val));
    renderAttendance(filtered);
}

// មុខងារ Update ទៅកាន់ Google Sheet
async function updateEntry(sheetName, id, remark) {
    const loading = true;
    const resp = await fetch(WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'updateStatus',
            sheet: sheetName,
            employeeId: id,
            status: remark
        })
    });
    alert("ទិន្នន័យត្រូវបានរក្សាទុក!");
    fetchData(); // ទាញទិន្នន័យថ្មី
}

function renderSummary(summary) {
    let html = `<div class="grid grid-cols-1 md:grid-cols-3 gap-6">`;
    // បង្កើត Card ផ្អែកលើទិន្នន័យ Summary
    summary.slice(1, 4).forEach(row => {
        html += `
            <div class="card">
                <p class="text-sm text-gray-500">${row[4]}</p> <h3 class="text-2xl font-bold">${row[1]} ${row[2]}</h3>
                <p class="text-indigo-600">វត្តមាន៖ ${row[5]} ថ្ងៃ</p>
            </div>
        `;
    });
    html += `</div>`;
    document.getElementById('content').innerHTML = html;
}

// បន្ថែម Logic សម្រាប់ Filter និង Update ទិន្នន័យ...
window.onload = fetchData;

