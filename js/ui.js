// ─── 스케일 ───
function updateScale(){
  const card=$$('reportCard'),area=$$('previewArea');
  const nav=$$('pageNav'),navH=nav&&nav.style.display!=='none'?nav.offsetHeight:0;
  const availH=area.clientHeight-navH-80;
  const availW=area.clientWidth-80;
  const a4w=794,a4h=1123;
  const spreadRow=$$('spreadRow');
  if(spreadRow.classList.contains('dual')){
    const dualW=a4w*2+8+48,dualH=a4h+48;
    const sv=Math.max(Math.min(availW/dualW,availH/dualH,1.0),.1);
    spreadRow.style.transform=`scale(${sv})`;
    spreadRow.style.marginBottom=`${-(dualH*(1-sv))}px`;
    card.style.transform='none';card.style.marginBottom='';
    [$$('leftPdfCanvas'),$$('rightPdfCanvas')].forEach(c=>{if(!c)return;c.style.transform='none';c.style.marginBottom='';});
  }else{
    spreadRow.style.transform='';spreadRow.style.marginBottom='';
    const sv=Math.max(Math.min(availW/a4w,availH/a4h,0.9),.15);
    card.style.transform=`scale(${sv})`;
    card.style.marginBottom=`${-(a4h*(1-sv))}px`;
    [$$('leftPdfCanvas'),$$('rightPdfCanvas')].forEach(c=>{
      if(!c||c.style.display==='none')return;
      c.style.transformOrigin='top center';
      c.style.transform=`scale(${sv})`;
      c.style.marginBottom=`${-(a4h*(1-sv))}px`;
    });
  }
}

// ─── contenteditable 동기화 ───
function initCE(){
  document.querySelectorAll('[contenteditable][data-panel]').forEach(el=>{
    el.addEventListener('input',function(){
      const p=$$(this.dataset.panel);
      if(p&&(p.tagName==='INPUT'||p.tagName==='TEXTAREA')){p.value=this.innerText.trim();p.classList.remove('auto');}
    });
    el.addEventListener('paste',function(e){e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));});
  });
  $$('rRate').addEventListener('input',function(){
    const v=parseInt(this.innerText);if(!isNaN(v)){G.hwRateManual=v;updateHwBadge();rebuildGraph();}
  });
}

// 리포트카드 → 패널 단방향 동기화
function fp(cid,pid){const c=$$(cid),p=$$(pid);if(c&&p&&c.innerText.trim()!==p.value)c.innerText=p.value;}

// ═══════════════════════════════════════
// 뷰 전환 시스템
// ═══════════════════════════════════════

function switchView(view){
  G.currentView=view;
  // 수업설정 탭 활성 상태
  const cfgTab=document.querySelector('.vt-item[data-view="config"]');
  if(cfgTab)cfgTab.classList.toggle('active',view==='config');
  // 날짜 탭 활성 상태
  document.querySelectorAll('.vt-date').forEach(el=>{
    el.classList.toggle('active',el.dataset.date===G.selDate&&view==='date');
  });
  // 뷰 토글
  $$('viewConfig').style.display=view==='config'?'':'none';
  $$('viewDate').style.display=view==='date'?'':'none';
  $$('tabBar').style.display=view==='date'&&G.students.length?'flex':'none';
  if(view==='config'){
    renderLessonCards();
    renderStudentList();
  }else if(view==='date'){
    renderDateSummary();
    renderTabs();
    if(G.selDate&&G.selStudent)autoFillAll();
    else if(G.selDate)autoFillCommon();
  }
  saveSession();
}

// ─── 뷰 탭 (상단) ───
function renderViewTabs(){
  const tabs=$$('viewTabs');tabs.style.display='';
  const dates=$$('vtDates');
  const maxVis=4;
  const off=G.dateTabOffset||0;
  const vis=G.lessons.slice(off,off+maxVis);
  dates.innerHTML=vis.map(l=>
    `<div class="vt-date${l.날짜===G.selDate&&G.currentView==='date'?' active':''}"
      data-date="${l.날짜}" onclick="selectDate('${l.날짜}')">${shortD(l.날짜)}</div>`
  ).join('');
}

function shiftDate(dir){
  const max=Math.max(0,G.lessons.length-4);
  G.dateTabOffset=Math.max(0,Math.min(max,(G.dateTabOffset||0)+dir));
  renderViewTabs();
}

function selectDate(date){
  G.selDate=date;
  G.tabData={};
  G.hwRateManual=null;
  if(!G.selStudent&&G.students.length)G.selStudent=G.students[0];
  // dateTabOffset 조정: 선택된 날짜가 보이도록
  const idx=G.lessons.findIndex(l=>l.날짜===date);
  if(idx>=0){
    const maxVis=4;
    if(idx<G.dateTabOffset)G.dateTabOffset=idx;
    else if(idx>=G.dateTabOffset+maxVis)G.dateTabOffset=idx-maxVis+1;
  }
  renderViewTabs();
  switchView('date');
}

// ─── 수업설정: 레슨 카드 ───
function renderLessonCards(){
  const c=$$('lessonCards');
  if(!G.lessons.length){
    c.innerHTML='<div style="font-size:13px;color:#9ca3af;padding:8px;">수업 날짜가 없습니다. 아래 버튼으로 추가하세요.</div>';
    return;
  }
  c.innerHTML=G.lessons.map((l,i)=>`
    <div class="lesson-card">
      <div class="lc-head">
        <span class="lc-date">${fmtKo(l.날짜)}</span>
        <button class="lc-del" onclick="removeLesson(${i})" title="삭제">🗑</button>
      </div>
      <div class="lc-body">
        <div class="lc-row">
          <input placeholder="교재명" value="${esc(l.교재)}" oninput="updateLessonField(${i},'교재',this.value)">
          <input placeholder="단원명" value="${esc(l.단원)}" oninput="updateLessonField(${i},'단원',this.value)">
        </div>
        <textarea placeholder="상세 진도" rows="1" oninput="updateLessonField(${i},'상세진도',this.value)">${esc(l.상세진도)}</textarea>
        <div class="lc-hw-label">과제</div>
        <div class="lc-hw">
          <input placeholder="과제 1" value="${esc(l.과제1)}" oninput="updateLessonField(${i},'과제1',this.value)">
          <input placeholder="과제 2" value="${esc(l.과제2)}" oninput="updateLessonField(${i},'과제2',this.value)">
          <input placeholder="과제 3" value="${esc(l.과제3)}" oninput="updateLessonField(${i},'과제3',this.value)">
          <input placeholder="과제 4" value="${esc(l.과제4)}" oninput="updateLessonField(${i},'과제4',this.value)">
        </div>
      </div>
    </div>`).join('');
}

function updateLessonField(idx,field,value){
  G.lessons[idx][field]=value;
  if(G.lessons[idx].날짜===G.selDate)syncLessonToReport();
  saveAppData();
}

function syncLessonToReport(){
  const cur=getCurL(),prev=getPrevL(),next=getNextL();
  if(!cur)return;
  $$('inCurBook').value=cur.교재;fp('rCurBook','inCurBook');
  $$('inCurChap').value=cur.단원;fp('rCurChap','inCurChap');
  $$('inCurDetail').value=cur.상세진도;fp('rCurDetail','inCurDetail');
  $$('inPrevBook').value=prev?.교재||'';fp('rPrevBook','inPrevBook');
  $$('inPrevChap').value=prev?.단원||'';fp('rPrevChap','inPrevChap');
  $$('inPrevDetail').value=prev?.상세진도||'';fp('rPrevDetail','inPrevDetail');
  const hwT=[1,2,3,4].map(i=>cur[`과제${i}`]||'').filter(x=>x);
  $$('inputNotice').value=hwT.join('\n');
  updateNoticeList(hwT.join('\n'));
  updateHeaderDate(cur.날짜,next?.날짜||'');
}

function addLesson(){
  let newDate;
  if(G.lessons.length){
    const last=G.lessons[G.lessons.length-1].날짜;
    const d=new Date(last);d.setDate(d.getDate()+7);
    newDate=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }else{
    const d=new Date();
    newDate=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  while(G.lessons.some(l=>l.날짜===newDate)){
    const d=new Date(newDate);d.setDate(d.getDate()+1);
    newDate=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  G.lessons.push({날짜:newDate,전체문제수:5,교재:'',단원:'',상세진도:'',과제1:'',과제2:'',과제3:'',과제4:''});
  G.lessons.sort((a,b)=>a.날짜.localeCompare(b.날짜));
  renderLessonCards();renderViewTabs();saveAppData();
}

function removeLesson(idx){
  const date=G.lessons[idx].날짜;
  if(!confirm(`${fmtKo(date)} 수업을 삭제할까요?`))return;
  G.lessons.splice(idx,1);
  if(G.selDate===date)G.selDate='';
  renderLessonCards();renderViewTabs();saveAppData();
}

// ─── 날짜 뷰: 수업 요약 ───
function renderDateSummary(){
  const cur=getCurL(),el=$$('dateSummary');
  if(!cur){el.innerHTML='';return;}
  const hwT=[1,2,3,4].map(i=>cur[`과제${i}`]||'').filter(x=>x);
  el.innerHTML=`
    <div class="ds-title">${fmtKo(cur.날짜)}</div>
    <div class="ds-info">
      ${cur.교재?`<span class="ds-chip">📚 ${esc(cur.교재)}</span>`:''}
      ${cur.단원?`<span class="ds-chip">📖 ${esc(cur.단원)}</span>`:''}
    </div>
    ${cur.상세진도?`<div class="ds-detail">${esc(cur.상세진도)}</div>`:''}
    ${hwT.length?`<div class="ds-hw">📝 과제: ${hwT.map(t=>esc(t)).join(', ')}</div>`:''}
  `;
}

// ─── 학생 탭 ───
function renderTabs(){
  const bar=$$('tabBar');
  if(!G.students.length||G.currentView!=='date'){bar.style.display='none';return;}
  bar.style.display='flex';
  bar.innerHTML=G.students.map(n=>`<div class="tab-item${n===G.selStudent?' active':''}" onclick="switchTab('${esc(n)}')">${esc(n)}</div>`).join('');
}

function switchTab(name){
  if(name===G.selStudent)return;
  saveTabData();G.selStudent=name;renderTabs();
  if(G.selDate)autoFillAll();
  saveSession();
}

function saveTabData(){
  if(!G.selStudent)return;
  G.tabData[G.selStudent]={
    hwStatus:[...G.hwStatus],scoreCalc:G.scoreCalc,
    correctInput:$$('inputCorrect').value,totalInput:$$('inputTotal').value,
    wrongInput:$$('inputWrong').value,rateManual:G.hwRateManual,
    comment:$$('inputComment').value,
  };
}

function restoreTabData(name){
  const d=G.tabData[name];if(!d)return false;
  G.hwStatus=d.hwStatus||[];G.scoreCalc=d.scoreCalc??null;G.hwRateManual=d.rateManual??null;
  $$('inputCorrect').value=d.correctInput||'';$$('inputTotal').value=d.totalInput||'';
  $$('inputWrong').value=d.wrongInput||'';$$('inputComment').value=d.comment||'';
  fp('commentBody','inputComment');return true;
}

// ─── 토글 (미니테스트/코멘트) ───
function toggleSec(type){
  if(type==='mini'){
    G.showMini=!G.showMini;
    $$('toggleMini').classList.toggle('on',G.showMini);
    $$('gMini').style.display=G.showMini?'flex':'none';
    $$('secMini').style.display=G.showMini?'':'none';
  }else{
    G.showComment=!G.showComment;
    $$('toggleComment').classList.toggle('on',G.showComment);
    $$('gComment').style.display=G.showComment?'':'none';
    $$('secComment').style.display=G.showComment?'':'none';
  }
  setTimeout(updateScale,50);saveSession();
}
