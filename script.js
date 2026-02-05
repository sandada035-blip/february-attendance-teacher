const API = "https://script.google.com/macros/s/AKfycbxQgrd4SLeZvFffCcFwMP_dzWkDn3VjxrZa-8coP6D_VvJQgwjvp87DPUzFdI3tf_7Q/exec";

let CURRENT_LANG = "kh";

const I18N = {
  kh:{present:"វត្តមាន",absent:"អវត្តមាន",permission:"ច្បាប់",mission:"បេសកកម្ម"},
  en:{present:"Present",absent:"Absent",permission:"Permission",mission:"Mission"}
};

function setLang(lang){
  CURRENT_LANG = lang;
  lbl("present").innerText = I18N[lang].present;
  lbl("absent").innerText = I18N[lang].absent;
  lbl("permission").innerText = I18N[lang].permission;
  lbl("mission").innerText = I18N[lang].mission;
}

function lbl(k){return document.getElementById("lbl-"+k);}

const FIELDS = [
  {kh:"កូដគ្រូ",en:"Employee ID"},
  {kh:"នាមខ្លួន",en:"First Name"},
  {kh:"នាមត្រកូល",en:"Last Name"},
  {kh:"ភេទ",en:"Gender"},
  {kh:"តួនាទី",en:"Position"},
  {kh:"សរុប",en:"Total Days"},
  {kh:"អវត្តមាន",en:"Absent"},
  {kh:"ច្បាប់",en:"Permission"},
  {kh:"បេសកកម្ម",en:"Mission"}
];

const sheets = ["Summary",...Array.from({length:30},(_,i)=>`Day${i+2}`)];
const sheetSelect = document.getElementById("sheetSelect");

sheets.forEach(s=>{
  const o=document.createElement("option");
  o.value=o.textContent=s;
  sheetSelect.appendChild(o);
});

async function loadData(){
  const sheet=sheetSelect.value;
  const date=dateInput.value;

  const res=await fetch(`${API}?sheet=${sheet}`);
  const json=await res.json();

  let rows=json.rows;

  if(date && sheet!=="Summary" && json.headers.includes("Date")){
    const [y,m,d]=date.split("-");
    const f=`${d}/${m}/${y}`;
    rows=rows.filter(r=>r["Date"]===f);
  }

  updateSummary(rows);
  renderTable(rows);
}

function renderTable(rows){
  dataTable.innerHTML=`
    <tr>${FIELDS.map(f=>`<th>${f.kh}<br><small>${f.en}</small></th>`).join("")}</tr>
  `;

  rows.forEach((r,i)=>{
    dataTable.innerHTML+=`
      <tr>
        ${FIELDS.map((f,j)=>`
          <td contenteditable
              onblur="updateCell(${i+2},${j+1},this.innerText)">
            ${r[f.kh]??""}
          </td>`).join("")}
      </tr>`;
  });
}

function updateSummary(rows){
  let p=0,a=0,per=0,m=0;
  rows.forEach(r=>{
    p+=+r["សរុប"]||0;
    a+=+r["អវត្តមាន"]||0;
    per+=+r["ច្បាប់"]||0;
    m+=+r["បេសកកម្ម"]||0;
  });
  sum("present",p); sum("absent",a); sum("permission",per); sum("mission",m);
}

function sum(id,val){document.getElementById("sum-"+id).innerText=val;}

async function updateCell(row,col,value){
  await fetch(API,{
    method:"POST",
    body:JSON.stringify({sheet:sheetSelect.value,row,col,value})
  });
}

setLang("kh");
loadData();
