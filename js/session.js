// ─── DB 저장 (디바운스 + 에러 핸들링) ───
let _saveTimer=null;
function saveAppData(){
  markUnsaved();
  if(_saveTimer)clearTimeout(_saveTimer);
  _saveTimer=setTimeout(async()=>{
    try{
      await dbSet('appData',{lessons:G.lessons,students:G.students,rates:G.rates,
        scores:G.scores,corrects:G.corrects,wrong:G.wrong,hwRec:G.hwRec,memos:G.memos,attend:G.attend,tabData:G.tabData,fileName:G.excelFileName,mascotChoices:G.mascotChoices});
    }catch(e){
      console.error('saveAppData 실패:',e);
      setBar('err','❌ 데이터 저장 실패');
    }
  },300);
}
// 즉시 저장 (엑셀 저장 등 타이밍이 중요한 경우)
async function saveAppDataNow(){
  if(_saveTimer){clearTimeout(_saveTimer);_saveTimer=null;}
  try{
    await dbSet('appData',{lessons:G.lessons,students:G.students,rates:G.rates,
      scores:G.scores,corrects:G.corrects,wrong:G.wrong,hwRec:G.hwRec,memos:G.memos,tabData:G.tabData,fileName:G.excelFileName,mascotChoices:G.mascotChoices});
  }catch(e){
    console.error('saveAppData 실패:',e);
    setBar('err','❌ 데이터 저장 실패');
  }
}
async function saveSession(){
  try{
    await dbSet('session',{selDate:G.selDate,selStudent:G.selStudent,
      showMini:G.showMini,showComment:G.showComment,colorMode:G.colorMode,currentView:G.currentView});
  }catch(e){console.error('saveSession 실패:',e);}
}

// ─── 세션 복원 ───
function restoreSession(s){
  if(s.selDate)G.selDate=s.selDate;
  if(s.selStudent&&G.students.includes(s.selStudent))G.selStudent=s.selStudent;
  if(s.showMini&&!G.showMini)toggleSec('mini');
  if(s.showComment&&!G.showComment)toggleSec('comment');
  if(s.colorMode&&!G.colorMode)toggleColorMode();
  renderStudentList();renderTabs();
  if(s.currentView==='date'&&G.selDate)switchView('date');
  else switchView('config');
}

// ─── 데이터 로드 후 UI 표시 ───
function showGroups(){
  $$('btnSave').style.display='';
  $$('btnSave').disabled=false;
  const pdfBtn=$$('btnPdf');if(pdfBtn)pdfBtn.style.display='';
  renderStudentList();
  autoSelectDate();
}

// 오늘 이후 가장 가까운 날짜 자동 선택
function autoSelectDate(){
  if(!G.lessons.length){switchView('config');return;}
  const today=todayKST();
  let best=G.lessons.find(l=>l.날짜>=today);
  if(!best)best=G.lessons[G.lessons.length-1];
  G.selDate=best.날짜;
  if(!G.selStudent&&G.students.length)G.selStudent=G.students[0];
  switchView('date');
}

// ─── 학생 관리 ───
function renderStudentList(){
  const list=$$('studentListItems');if(!list)return;
  list.innerHTML=G.students.map((n,i)=>
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6;">
      <span style="font-size:13px;color:#333;">${esc(n)}</span>
      <button onclick="removeStudent(${i})" style="font-size:11px;padding:2px 8px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;cursor:pointer;font-family:inherit;">삭제</button>
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
function toggleStudentSec(){
  const e=$$('studentListEdit'),open=e.style.display!=='none';
  e.style.display=open?'none':'flex';
  const a=$$('studentArrow');if(a)a.style.transform=open?'':'rotate(180deg)';
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
