// ─── 자동 백업 (IndexedDB) ───
// 편집할 때마다 전체 데이터를 IndexedDB에 스냅샷으로 저장해 두고,
// 다음 실행 시 '지난 작업 이어하기' 배너로 복구할 수 있게 한다. (엑셀이 주 저장소, IndexedDB는 백업)
let _saveTimer=null;
let _hadData=false; // 이번 세션에 데이터가 있었는지 (빈 상태로 백업을 지우는 것은 '직접 다 지운 경우'만)
function _appSnapshot(){
  const o={};DATA_KEYS.forEach(k=>{o[k]=G[k];});
  o.fileName=G.excelFileName;o.savedAt=nowKSTStr();o.unsaved=G.unsaved;
  o.pendingPropagations=G.pendingPropagations;
  o.selDate=G.selDate;o.selStudent=G.selStudent;
  return o;
}
async function _writeSnapshot(){
  // '지난 작업' 배너가 복구 대기 중이면 백업을 건드리지 않음 (보기 설정만 바꿔도 백업이 사라지던 문제 방지)
  if($$('recoverBanner')?._snap)return;
  try{
    const empty=!G.lessons.length&&!G.students.length;
    // 이번 세션에 있던 데이터를 사용자가 모두 지운 경우에만 백업도 비움
    if(empty){if(_hadData){await dbSet('appData',null);_hadData=false;}return;}
    _hadData=true;
    await dbSet('appData',_appSnapshot());
  }catch(e){console.error('자동 백업 실패:',e);setBar('err','❌ 자동 백업 실패 (엑셀 저장은 가능)');}
}
// 데이터 변경 → 미저장 표시 + 백업 예약(디바운스)
function saveAppData(){if(G.lessons.length||G.students.length)markUnsaved();saveSession();}
// 화면 선택(날짜·학생 등)만 바뀐 경우 → 미저장 표시 없이 백업만 예약
function saveSession(){
  if(_saveTimer)clearTimeout(_saveTimer);
  _saveTimer=setTimeout(()=>{_saveTimer=null;_writeSnapshot();},300);
}
// 즉시 백업 (엑셀 저장 직후 등)
async function saveAppDataNow(){
  if(_saveTimer){clearTimeout(_saveTimer);_saveTimer=null;}
  await _writeSnapshot();
}

// ─── 지난 작업 복구 ───
async function checkRecovery(){
  const snap=await dbGet('appData');
  if(!snap||!Array.isArray(snap.lessons)||!(snap.lessons.length||snap.students?.length))return;
  const el=$$('recoverBanner');if(!el)return;
  el._snap=snap;
  $$('recoverInfo').textContent=`${snap.fileName||'이전 작업'} · ${snap.savedAt||''}${snap.unsaved?' · 엑셀에 저장 안 됨':''}`;
  el.classList.toggle('warn',!!snap.unsaved);
  el.style.display='';
}
function restoreFromBackup(){
  const el=$$('recoverBanner');const snap=el?._snap;if(!snap)return;
  DATA_KEYS.forEach(k=>{if(snap[k]!==undefined)G[k]=snap[k];});
  ['rates','wrong','hwRec','memos','attend','mascotChoices','hwDisabled','journalNote','journalPlan','journalInfo','miniTest','miniScore']
    .forEach(k=>{if(!G[k]||typeof G[k]!=='object')G[k]={};});
  // 날짜 형식이 아닌 수업은 버림 (화면 HTML에 그대로 들어가지 않도록)
  G.lessons=Array.isArray(G.lessons)?G.lessons.filter(l=>l&&isValidDate(l.날짜)):[];
  if(!Array.isArray(G.students))G.students=[];
  G.excelFileName=snap.fileName||G.excelFileName;
  G.pendingPropagations=Array.isArray(snap.pendingPropagations)?snap.pendingPropagations:[];
  G.tabData={};G.studentPdfs={};G.pdfCanvases=[];
  G.selDate=G.lessons.some(l=>l.날짜===snap.selDate)?snap.selDate:'';
  G.selStudent=G.students.includes(snap.selStudent)?snap.selStudent:'';
  dismissRecovery();
  applyViewSettings();
  updateLastSavedDisplay();
  showGroups(true);
  if(snap.unsaved)markUnsaved();else markSaved();
  setBar('ok',`♻ 복구됨: ${G.excelFileName}`);
  $$('sbar').onclick=triggerLoad;
}
// byUser=true: 배너의 '닫기' — 저장 안 된 백업이면 다음 편집 때 덮어써지므로 한 번 확인
function dismissRecovery(byUser){
  const el=$$('recoverBanner');if(!el)return;
  if(byUser&&el._snap?.unsaved&&!confirm('엑셀에 저장하지 않은 지난 작업입니다.\n닫고 새로 작업하면 이 백업은 사라집니다. 닫을까요?'))return;
  el.style.display='none';el._snap=null;
}

// ─── 데이터 로드 후 UI 표시 ───
// keepSelection=true: 복구 시 저장돼 있던 날짜·학생 선택을 유지
function showGroups(keepSelection){
  $$('btnSave').style.display='';
  $$('btnSave').disabled=false;
  ['btnPdf','btnImg','btnExcelRemove'].forEach(id=>{const b=$$(id);if(b)b.style.display='';});
  const zeroBtn=$$('btnZeroStart');if(zeroBtn)zeroBtn.style.display='none';
  dismissRecovery();
  if(keepSelection&&G.selDate){
    if(!G.selStudent&&G.students.length)G.selStudent=G.students[0];
    switchView('date');
  }else autoSelectDate();
}

// ─── 직접 시작하기 (엑셀 없이) ───
function zeroStart(){
  // 저장 안 한 '지난 작업' 백업이 있으면 새로 시작하기 전에 확인 (새 작업이 백업을 덮어씀)
  const rb=$$('recoverBanner');
  if(rb?._snap?.unsaved&&!confirm('엑셀에 저장하지 않은 지난 작업이 있습니다.\n새로 시작하면 그 백업은 사라집니다. 계속할까요?'))return;
  showGroups();
  $$('sbar').className='sbar ok';
  $$('sbar').textContent='✏️ 직접 입력 모드';
  $$('sbar').onclick=triggerLoad; // 여전히 엑셀 불러오기 가능
  G.excelFileName='학습리포트_데이터.xlsx';
  saveAppData();
}

// 오늘 이후 가장 가까운 날짜 자동 선택
function autoSelectDate(){
  if(!G.lessons.length){switchView('config');return;}
  const today=todayKST();
  let best=G.lessons.find(l=>l.날짜>=today);
  if(!best)best=G.lessons[G.lessons.length-1];
  G.selDate=best.날짜;
  if(!G.students.includes(G.selStudent))G.selStudent=G.students[0]||'';
  switchView('date');
}

// ─── 미저장 상태 배너 ───
function markUnsaved(){
  G.unsaved=true;
  const el=$$('unsavedInline');if(el)el.style.display='';
}
function markSaved(){
  G.unsaved=false;
  const el=$$('unsavedInline');if(el)el.style.display='none';
}
