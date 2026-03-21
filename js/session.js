// ─── DB 저장 ───
async function saveAppData(){
  await dbSet('appData',{lessons:G.lessons,students:G.students,rates:G.rates,
    scores:G.scores,corrects:G.corrects,wrong:G.wrong,hwRec:G.hwRec,tabData:G.tabData,fileName:G.excelFileName});
}
async function saveSession(){
  await dbSet('session',{selDate:G.selDate,selStudent:G.selStudent,showMini:G.showMini,showComment:G.showComment});
}

// ─── 세션 복원 ───
function restoreSession(s){
  if(s.selDate){$$('selDate').value=s.selDate;G.selDate=s.selDate;}
  if(s.selStudent&&G.students.includes(s.selStudent))G.selStudent=s.selStudent;
  if(s.showMini&&!G.showMini)toggleSec('mini');
  if(s.showComment&&!G.showComment)toggleSec('comment');
  renderStudentList();renderTabs();
  if(G.selDate&&G.selStudent)autoFillAll();else if(G.selDate)autoFillCommon();
}

// ─── 드롭다운·그룹 표시 ───
function populateSels(){
  const ds=$$('selDate');ds.innerHTML='<option value="">— 날짜 선택 —</option>';
  G.lessons.forEach(r=>{const o=document.createElement('option');o.value=r.날짜;o.textContent=fmtKo(r.날짜);ds.appendChild(o);});
}
function showGroups(){
  ['gDate','gCurProgHead','gNextHwHead','sdMain','gPrevHw',
   'sdOpt','toggleMini','toggleComment','btnSave','gLocalSave','btnPdf','lastSaved'].forEach(id=>{
    const el=$$(id);if(!el)return;
    el.style.display=(id.startsWith('sd')||id==='gLocalSave')?'flex':'';
  });
  $$('btnSave').disabled=false;renderStudentList();renderTabs();
}
function onDate(){
  G.selDate=$$('selDate').value;G.hwRateManual=null;
  G.tabData={}; // 날짜 변경 시 학생별 탭 캐시 전체 무효화
  if(G.selDate&&G.selStudent)autoFillAll();else if(G.selDate)autoFillCommon();
  saveSession();
}

// ─── 학생 관리 ───
function renderStudentList(){
  const list=$$('studentListItems');if(!list)return;
  list.innerHTML=G.students.map((n,i)=>
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6;">
      <span style="font-size:13px;color:#333;">${esc(n)}</span>
      <button onclick="removeStudent(${i})" style="font-size:11px;padding:2px 8px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;cursor:pointer;">삭제</button>
    </div>`
  ).join('');
  const s=$$('studentSummary');
  if(s)s.textContent=G.students.length?G.students.join(', '):'학생 없음';
}
function addStudent(){
  const input=$$('newStudentInput');
  const name=input.value.trim();
  if(!name)return;
  if(G.students.includes(name)){alert('이미 등록된 학생입니다.');return;}
  G.students.push(name);input.value='';
  renderStudentList();renderTabs();saveAppData();
}
function removeStudent(idx){
  const name=G.students[idx];
  if(!confirm(`'${name}' 학생을 삭제할까요?`))return;
  G.students.splice(idx,1);
  if(G.selStudent===name)G.selStudent=G.students[0]||'';
  renderStudentList();renderTabs();saveAppData();
}
// ─── 로컬 JSON 저장/불러오기 ───
function saveLocalData(){
  const data={
    lessons:G.lessons,students:G.students,rates:G.rates,
    scores:G.scores,corrects:G.corrects,wrong:G.wrong,
    hwRec:G.hwRec,tabData:G.tabData,fileName:G.excelFileName,
    session:{selDate:G.selDate,selStudent:G.selStudent,showMini:G.showMini,showComment:G.showComment}
  };
  const a=document.createElement('a');
  const ts=new Date().toISOString().slice(0,10).replace(/-/g,'');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
  a.download=`학습리포트_저장_${ts}.json`;
  a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function loadLocalData(input){
  const file=input.files[0];if(!file)return;
  setBar('wait','⏳ 불러오는 중...');
  try{
    const data=JSON.parse(await file.text());
    G.lessons=data.lessons||[];G.students=data.students||[];
    G.rates=data.rates||{};G.scores=data.scores||{};
    G.corrects=data.corrects||{};G.wrong=data.wrong||{};
    G.hwRec=data.hwRec||{};G.tabData=data.tabData||{};
    G.excelFileName=data.fileName||'학습리포트_데이터.xlsx';
    await saveAppData();
    populateSels();showGroups();
    if(data.session)restoreSession(data.session);
    setBar('ok',`✅ ${file.name}`);
  }catch(e){setBar('err','❌ 불러오기 실패: '+e.message);console.error(e);}
  input.value='';
}

function toggleStudentSec(){
  const e=$$('studentListEdit'),open=e.style.display!=='none';
  e.style.display=open?'none':'flex';
  const a=$$('studentArrow');if(a)a.style.transform=open?'':'rotate(180deg)';
}
