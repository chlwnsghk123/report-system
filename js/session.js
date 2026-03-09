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
  renderTabs();
  if(G.selDate&&G.selStudent)autoFillAll();else if(G.selDate)autoFillCommon();
}

// ─── 드롭다운·그룹 표시 ───
function populateSels(){
  const ds=$$('selDate');ds.innerHTML='<option value="">— 날짜 선택 —</option>';
  G.lessons.forEach(r=>{const o=document.createElement('option');o.value=r.날짜;o.textContent=fmtKo(r.날짜);ds.appendChild(o);});
}
function showGroups(){
  ['gDate','gCurProgHead','gNextHwHead','sdMain','gPrevHw',
   'sdOpt','toggleMini','toggleComment','btnSave','btnPdf','lastSaved'].forEach(id=>{
    const el=$$(id);if(!el)return;
    el.style.display=id.startsWith('sd')?'flex':'';
  });
  $$('btnSave').disabled=false;renderTabs();
}
function onDate(){
  G.selDate=$$('selDate').value;G.hwRateManual=null;
  if(G.selDate&&G.selStudent)autoFillAll();else if(G.selDate)autoFillCommon();
  saveSession();
}
