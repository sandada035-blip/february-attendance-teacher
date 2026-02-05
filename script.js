const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxQgrd4SLeZvFffCcFwMP_dzWkDn3VjxrZa-8coP6D_VvJQgwjvp87DPUzFdI3tf_7Q/exec"; // ដាក់ URL ដែលបានមកពី Deployment

async function fetchData() {
    const response = await fetch(WEB_APP_URL + "?action=getData");
    const data = await response.json();
    renderSummary(data.summary);
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
