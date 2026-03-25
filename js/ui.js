// ─── 스케일 ───
function updateScale(){
  const card=$$('reportCard'),area=$$('previewContent')||$$('previewArea');
  const nav=$$('pageNav'),navH=nav&&nav.style.display!=='none'?nav.offsetHeight:0;
  const availH=area.clientHeight-navH-40;
  const availW=area.clientWidth-60;
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
    // 수동 줌이 설정되어 있으면 그대로 사용
    const sv=G._zoomManual!=null?G._zoomManual:Math.max(Math.min(availW/a4w,availH/a4h,0.65),.15);
    card.style.transform=`scale(${sv})`;
    card.style.marginBottom=`${-(a4h*(1-sv))}px`;
    [$$('leftPdfCanvas'),$$('rightPdfCanvas')].forEach(c=>{
      if(!c||c.style.display==='none')return;
      c.style.transformOrigin='top center';
      c.style.transform=`scale(${sv})`;
      c.style.marginBottom=`${-(a4h*(1-sv))}px`;
    });
  }
  _updateZoomLabel();
}

// ─── contenteditable 동기화 ───
function initCE(){
  const rRate=$$('rRate');
  // 숫자만 입력 허용 (0~999), Enter 차단
  rRate.addEventListener('keydown',function(e){
    if(e.key==='Enter'){e.preventDefault();this.blur();return;}
    // 방향키, 백스페이스, 삭제, 탭 허용
    if(['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'].includes(e.key))return;
    // Ctrl+A/C/V/X 허용
    if(e.ctrlKey||e.metaKey)return;
    // 숫자 키만 허용
    if(!/^\d$/.test(e.key))e.preventDefault();
  });
  rRate.addEventListener('input',function(){
    // 숫자가 아닌 문자 제거
    let text=this.innerText.replace(/[^\d]/g,'');
    let v=parseInt(text);
    if(isNaN(v))v=0;
    if(v>100)v=100;
    if(this.innerText!==String(v)){this.innerText=v;
      // 커서를 끝으로
      const sel=window.getSelection();const range=document.createRange();
      range.selectNodeContents(this);range.collapse(false);sel.removeAllRanges();sel.addRange(range);
    }
    G.hwRateManual=v;
    $$('inputRate').value=v;$$('inputRate').classList.remove('auto');
    if(G.selStudent&&G.selDate){G.rates[G.selStudent]=G.rates[G.selStudent]||{};G.rates[G.selStudent][G.selDate]=v;}
    updateHwBadge();rebuildGraph();updateRateFace();
    if(v>=0)autoAttendOnRate();
  });
  rRate.addEventListener('paste',function(e){
    e.preventDefault();
    const text=e.clipboardData.getData('text/plain').replace(/[^\d]/g,'');
    document.execCommand('insertText',false,text);
  });
}

// 리포트카드 → 패널 단방향 동기화 (좌패널에서 갱신 시 override 제거)
function fp(cid,pid){const c=$$(cid),p=$$(pid);if(c&&p){const v=p.value.replace(/\n{2,}/g,'\n');if(c.innerText.trim()!==v){c.innerText=v;delete G.reportEdits[cid];}}}

// ═══════════════════════════════════════
// 뷰 전환 시스템
// ═══════════════════════════════════════

function switchView(view){
  G.currentView=view;
  // 뷰 토글
  $$('viewDate').style.display=view==='date'?'':'none';
  if(view==='config'){
    openLessonModal();
  }else if(view==='date'){
    closeLessonModal();
    renderDateSummary();
    renderTabs();
    renderDateNav();
    _updateStudentNav();
    updateMemoBtn();
    if(G.selDate&&G.selStudent)autoFillAll();
    else if(G.selDate)autoFillCommon();
    updateAttendUI();
  }
  saveSession();
}

// ─── 수업설정 전체화면 모달 ───
function openLessonModal(){
  G._lessonFocus=-1; // 포커싱 초기화 → 자동 nextDate 포커스
  renderLessonCards();
  _openModal('lessonModalOverlay');
}
function closeLessonModal(){
  G._lessonFocus=-1; // 포커싱 초기화
  _closeModal('lessonModalOverlay');
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
  renderDateNav();renderDateSidebar();
}

function selectDate(date){
  // 보류된 이월 전파 적용
  flushPropagations();
  // 모든 학생의 tabData를 hwRec에 동기화 (현재 학생은 먼저 saveTabData)
  if(G.selDate){
    if(G.selStudent)saveTabData();
    for(const name of Object.keys(G.tabData)){
      const td=G.tabData[name];if(!td)continue;
      const key=`${name}||${G.selDate}`;
      const rec=G.hwRec[key]||{이행률:null};
      const items=(td.hwItems||[]);
      const hs=td.hwStatus||[];
      const refs=td.hwItemRefs||items.map(()=>({ref:'',fromDate:''}));
      if(items.length){
        rec.items=items.map((text,i)=>({text,status:hs[i]??-1,ref:refs[i]?.ref||'',fromDate:refs[i]?.fromDate||''}));
        items.forEach((_,i)=>{rec[`과제${i+1}_상태`]=hs[i]??-1;});
      }
      if(td.rateManual!=null){rec.이행률=td.rateManual;G.rates[name]=G.rates[name]||{};G.rates[name][G.selDate]=td.rateManual;}
      else if(G.rates[name]?.[G.selDate]!=null){rec.이행률=G.rates[name][G.selDate];}
      else{rec.이행률=null;}
      // 오답·맞힌수 동기화 (날짜 전환 시 유실 방지)
      if(td.wrongInput){G.wrong[name]=G.wrong[name]||{};G.wrong[name][G.selDate]=td.wrongInput;}
      else if(G.wrong[name]?.[G.selDate]){delete G.wrong[name][G.selDate];}
      // 이번 주차 추가 과제 동기화
      rec.extraHw=(td.extraHw||[]).map(it=>({...it}));
      G.hwRec[key]=rec;
    }
    saveAppData();
  }
  G.selDate=date;
  G.tabData={};
  G.hwRateManual=null;
  G.reportEdits={};
  if(!G.selStudent&&G.students.length)G.selStudent=G.students[0];
  switchView('date');
  updateAttendUI();
  // 날짜 전환 페이드 애니메이션 — spread-row에 적용
  const sr2=$$('spreadRow');
  if(sr2){sr2.classList.remove('sr-fade');void sr2.offsetWidth;sr2.classList.add('sr-fade');}
}

// ─── 수업설정: 레슨 카드 ───
function getLessonHwKeys(l){
  // 레슨 객체에서 과제 키 목록 반환 (과제1, 과제2, ... 동적)
  const keys=[];
  for(let i=1;;i++){const k=`과제${i}`;if(k in l)keys.push(k);else break;}
  if(!keys.length){l.과제1='';keys.push('과제1');}
  return keys;
}
function renderLessonCards(){
  const c=$$('lessonCards');
  if(!G.lessons.length){
    c.innerHTML='<div style="font-size:13px;color:#9ca3af;padding:8px;">수업 날짜가 없습니다. 아래 버튼으로 추가하세요.</div>';
    return;
  }
  const today=todayKST();
  // 오늘 이후 가장 가까운 날짜 찾기
  const futureDates=G.lessons.filter(l=>l.날짜>=today).map(l=>l.날짜);
  const nextDate=futureDates.length?futureDates[0]:null;
  // 포커싱 중인 카드 유지 (없으면 nextDate)
  const focusIdx=G._lessonFocus??-1;
  c.innerHTML=G.lessons.map((l,i)=>{
    let cls='lesson-card';
    const isFocused=focusIdx===i;
    const isPast=l.날짜<today;
    if(isPast&&!isFocused)cls+=' lc-past';
    if(isFocused)cls+=' lc-focus';
    else if(l.날짜===nextDate)cls+=' lc-next';
    // 값이 있는 과제만 표시
    const hwKeys=getLessonHwKeys(l);
    const visibleHw=hwKeys.filter(k=>(l[k]||'').trim());
    const showKeys=visibleHw.length?visibleHw:[hwKeys[0]]; // 최소 1개
    const hwHtml=showKeys.map((k,hi)=>{
      const realIdx=hwKeys.indexOf(k);
      return`<div class="lc-hw-row">
        <input placeholder="과제 ${realIdx+1}" value="${esc(l[k]||'')}" oninput="updateLessonField(${i},'${k}',this.value)" onfocus="focusLessonCard(${i})">
        ${showKeys.length>1||visibleHw.length>1?`<button class="lc-hw-del" onclick="removeLessonHw(${i},${realIdx})" title="과제 삭제">✕</button>`:''}
      </div>`;
    }).join('');
    return`<div class="${cls}" data-idx="${i}" onclick="focusLessonCard(${i})">
      <div class="lc-head">
        <input type="date" class="lc-date-input" value="${l.날짜}" onchange="updateLessonDate(${i},this.value)" onfocus="focusLessonCard(${i})">
        <button class="lc-del" onclick="removeLesson(${i})" title="삭제">🗑</button>
      </div>
      <div class="lc-body">
        <div class="lc-row">
          <input placeholder="교재명" value="${esc(l.교재)}" oninput="updateLessonField(${i},'교재',this.value)" onfocus="focusLessonCard(${i})">
          <input placeholder="단원명" value="${esc(l.단원)}" oninput="updateLessonField(${i},'단원',this.value)" onfocus="focusLessonCard(${i})">
        </div>
        <textarea placeholder="상세 진도" rows="2" oninput="updateLessonField(${i},'상세진도',this.value);_autoGrowTextarea(this)" onfocus="focusLessonCard(${i})">${esc(l.상세진도)}</textarea>
        <div class="lc-hw-label">과제</div>
        <div class="lc-hw">${hwHtml}
          <button class="lc-hw-add" onclick="addLessonHw(${i})">+ 과제 추가</button>
        </div>
      </div>
    </div>`;
  }).join('');
  // 텍스트에어리어 높이 자동 조정
  c.querySelectorAll('textarea').forEach(_autoGrowTextarea);
  // 포커싱 카드로 스크롤 (최초 or 포커스 없을 때만)
  if(focusIdx<0&&nextDate){
    const idx=G.lessons.findIndex(l=>l.날짜===nextDate);
    const card=c.children[idx];
    if(card)setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'center'}),100);
  }
}

// 상세진도 textarea 자동 높이 조절
function _autoGrowTextarea(el){
  if(el instanceof Event)el=el.target;
  if(!el||el.tagName!=='TEXTAREA')return;
  el.style.height='auto';
  el.style.height=Math.max(48,el.scrollHeight)+'px';
}

// 수업설정 카드 포커싱
function focusLessonCard(idx){
  if(G._lessonFocus===idx)return;
  G._lessonFocus=idx;
  renderLessonCards();
  // 포커싱된 카드로 부드럽게 스크롤
  const c=$$('lessonCards');
  const card=c?.children[idx];
  if(card)setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'nearest'}),50);
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
  const hwKeys=getLessonHwKeys(cur);
  const hwT=hwKeys.map(k=>cur[k]||'').filter(x=>x);
  $$('inputNotice').value=hwT.join('\n');
  updateNoticeList(hwT.join('\n'));
  updateHeaderDate(cur.날짜,next?.날짜||'');
}

// ─── 과제 동적 추가/삭제 ───
function addLessonHw(idx){
  const l=G.lessons[idx];
  const keys=getLessonHwKeys(l);
  const newKey=`과제${keys.length+1}`;
  l[newKey]='';
  renderLessonCards();saveAppData();
}
function removeLessonHw(idx,hwIdx){
  const l=G.lessons[idx];
  const keys=getLessonHwKeys(l);
  if(keys.length<=1)return;
  // 삭제 후 키 재정렬
  const vals=keys.map(k=>l[k]);
  vals.splice(hwIdx,1);
  // 기존 과제 키 모두 삭제
  keys.forEach(k=>delete l[k]);
  // 재정렬된 값으로 다시 설정
  vals.forEach((v,i)=>{l[`과제${i+1}`]=v;});
  if(l.날짜===G.selDate)syncLessonToReport();
  renderLessonCards();saveAppData();
}

function updateLessonDate(idx,newDate){
  if(!newDate)return;
  const oldDate=G.lessons[idx].날짜;
  if(oldDate===newDate)return;
  if(G.lessons.some((l,i)=>i!==idx&&l.날짜===newDate)){alert('이미 같은 날짜가 있습니다.');renderLessonCards();return;}
  // hwRec 키 이동 (학생별)
  G.students.forEach(n=>{
    const oldKey=`${n}||${oldDate}`,newKey=`${n}||${newDate}`;
    if(G.hwRec[oldKey]){G.hwRec[newKey]=G.hwRec[oldKey];delete G.hwRec[oldKey];}
    if(G.rates[n]?.[oldDate]!=null){G.rates[n][newDate]=G.rates[n][oldDate];delete G.rates[n][oldDate];}
    if(G.wrong[n]?.[oldDate]){G.wrong[n][newDate]=G.wrong[n][oldDate];delete G.wrong[n][oldDate];}
    if(G.memos[`${n}||${oldDate}`]){G.memos[`${n}||${newDate}`]=G.memos[`${n}||${oldDate}`];delete G.memos[`${n}||${oldDate}`];}
  });
  G.lessons[idx].날짜=newDate;
  G.lessons.sort((a,b)=>a.날짜.localeCompare(b.날짜));
  if(G.selDate===oldDate)G.selDate=newDate;
  renderLessonCards();renderDateNav();renderDateSidebar();saveAppData();
}

function addLesson(){
  let newDate;
  if(G.lessons.length){
    const last=G.lessons[G.lessons.length-1].날짜;
    const d=new Date(last);d.setDate(d.getDate()+7);
    newDate=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }else{
    newDate=todayKST();
  }
  while(G.lessons.some(l=>l.날짜===newDate)){
    const d=new Date(newDate);d.setDate(d.getDate()+1);
    newDate=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  G.lessons.push({id:genLessonId(),날짜:newDate,전체문제수:5,교재:'',단원:'',상세진도:'',과제1:''});
  G.lessons.sort((a,b)=>a.날짜.localeCompare(b.날짜));
  renderLessonCards();renderDateNav();renderDateSidebar();saveAppData();
}

function removeLesson(idx){
  const date=G.lessons[idx].날짜;
  if(!confirm(`${fmtKo(date)} 수업을 삭제할까요?`))return;
  G.lessons.splice(idx,1);
  if(G.selDate===date)G.selDate='';
  renderLessonCards();renderDateNav();renderDateSidebar();saveAppData();
}

// ─── 날짜 뷰: 수업 요약 ───
function renderDateSummary(){
  const cur=getCurL(),el=$$('dateSummary');
  if(!cur){el.innerHTML='';return;}
  const hwKeys=getLessonHwKeys(cur);
  const hwT=hwKeys.map(k=>cur[k]||'').filter(x=>x);
  // 상세진도를 줄 단위로 분할하여 칩으로 나열
  const detailChips=(cur.상세진도||'').split(/\n/).map(s=>s.trim()).filter(Boolean)
    .map(s=>`<span class="ds-chip">${esc(s)}</span>`).join('');
  el.innerHTML=`
    <div class="ds-title">${fmtKo(cur.날짜)}</div>
    <div class="ds-info">
      ${cur.교재?`<span class="ds-chip">📚 ${esc(cur.교재)}</span>`:''}
      ${cur.단원?`<span class="ds-chip">📖 ${esc(cur.단원)}</span>`:''}
      ${detailChips}
    </div>
  `;
}

// ─── 학생 사이드바 ───
function renderTabs(){
  const sidebar=$$('studentSidebar');
  const inlineBtn=$$('pdfAddInline');
  if(!G.students.length||G.currentView!=='date'){
    if(sidebar)sidebar.style.display='none';
    if(inlineBtn)inlineBtn.style.display='none';
    return;
  }
  if(sidebar)sidebar.style.display='';
  // PDF가 이미 있으면 + 버튼 숨김
  const hasPdf=G.selStudent&&(G.studentPdfs[G.selStudent]||[]).length>0;
  if(inlineBtn)inlineBtn.style.display=hasPdf?'none':'flex';
  const list=$$('ssList');if(!list)return;
  list.innerHTML=G.students.map(n=>{
    const pdfs=G.studentPdfs[n]||[];
    const hasPdf=pdfs.length>0;
    const cls=`ss-item${n===G.selStudent?' active':''}${hasPdf?' has-pdf':''}`;
    const en=esc(n);
    return`<div class="${cls}" onclick="switchTab('${en}')" data-student="${en}">
      <div class="ss-name">${en}</div>
      ${hasPdf?`<span class="ss-pdf-badge">📎</span>`:''}
    </div>`;
  }).join('');
  // 우클릭 컨텍스트 메뉴 바인딩
  list.querySelectorAll('.ss-item').forEach(item=>{
    item.addEventListener('contextmenu',e=>{
      e.preventDefault();
      const name=item.dataset.student;
      const hasPdf=(G.studentPdfs[name]||[]).length>0;
      const pdfLabel=hasPdf?'📎 PDF 교체':'📎 PDF 첨부';
      _showContextMenu(e.clientX,e.clientY,[
        {label:'📊 이행률 요약표',action:()=>{if(G.selStudent!==name)switchTab(name);openStudentReportFor(name);}},
        {label:pdfLabel,action:()=>{if(G.selStudent!==name)switchTab(name);attachPdfForStudent(name);}},
        {sep:true},
        {label:'🎨 캐릭터 설정',action:()=>{if(G.selStudent!==name)switchTab(name);openMascotSettingsModal(name);}}
      ]);
    });
  });
}

// 학생별 이행률 요약표 바로 열기
function openStudentReportFor(name){
  dlStudentReport(name);
}

function switchTab(name){
  if(name===G.selStudent)return;
  flushPropagations();
  saveTabData();G.selStudent=name;renderTabs();
  const m=$$('rateMascot');if(m)delete m.dataset.idx;
  updateMemoBtn();
  // 학생별 PDF 동기화
  _syncGlobalPdf();
  G.currentSpread=0;renderSpread();
  if(G.selDate)autoFillAll();
  updateAttendUI();
  saveSession();
  // 리포트카드 전환 애니메이션 (상하 슬라이드) — spread-row에 적용해 scale과 충돌 방지
  const sr=$$('spreadRow');
  if(sr){
    sr.classList.remove('sr-slide-up','sr-slide-down');
    void sr.offsetWidth;
    const dir=G._stuDir||'down';
    sr.classList.add(dir==='up'?'sr-slide-up':'sr-slide-down');
    G._stuDir=null;
  }
  _updateStudentNav();
}

function saveTabData(){
  if(!G.selStudent)return;
  G.tabData[G.selStudent]={
    hwStatus:[...G.hwStatus],
    hwItems:[...G.hwItems],
    hwItemRefs:G.hwItemRefs.map(r=>({...r})),
    extraHw:(G.extraHw||[]).map(it=>({...it})),
    totalInput:$$('inputTotal').value,
    wrongInput:$$('inputWrong').value,rateManual:G.hwRateManual,
    comment:$$('inputComment').value,
    teacher:$$('inputTeacher').value,
    reportEdits:{...G.reportEdits},
  };
  syncHwRecItems(G.selStudent,G.selDate);
}

// hwRec에 items 배열 동기화
function syncHwRecItems(student,date){
  if(!student||!date)return;
  const key=`${student}||${date}`;
  const rec=G.hwRec[key]||{이행률:null};
  // 이행률 동기화: 수동입력 우선, 없으면 G.rates, 둘 다 없으면 null(결석)
  if(G.hwRateManual!=null) rec.이행률=G.hwRateManual;
  else if(G.rates[student]?.[date]!=null) rec.이행률=G.rates[student][date];
  else rec.이행률=null;
  rec.items=G.hwItems.map((text,i)=>{
    const ref=G.hwItemRefs[i]?.ref||'';
    const fromDate=G.hwItemRefs[i]?.fromDate||'';
    return{text,status:G.hwStatus[i]??-1,ref,fromDate};
  });
  // 레거시 필드도 업데이트
  G.hwItems.forEach((_,i)=>{
    rec[`과제${i+1}_상태`]=G.hwStatus[i]??-1;
  });
  // 이번 주차 추가 과제 저장
  rec.extraHw=(G.extraHw||[]).map(it=>({...it}));
  G.hwRec[key]=rec;
}

function restoreTabData(name){
  const d=G.tabData[name];if(!d)return false;
  G.hwStatus=d.hwStatus||[];
  G.hwItems=d.hwItems||[];
  G.hwItemRefs=d.hwItemRefs||G.hwItems.map(()=>({ref:'',fromDate:''}));
  G.extraHw=(d.extraHw||[]).map(it=>({...it}));
  G.hwRateManual=d.rateManual??null;
  $$('inputTotal').value=d.totalInput||'';
  $$('inputWrong').value=d.wrongInput||'';$$('inputComment').value=d.comment||'';
  $$('inputTeacher').value=d.teacher||'';
  G.reportEdits=d.reportEdits?{...d.reportEdits}:{};
  fp('commentBody','inputComment');return true;
}

// ─── 비고 모달 ───
let _memoKey=''; // 모달 열 때 캡처한 키 (student||date 변경 방지)
let _memoOriginal=''; // 원본 텍스트 (변경 감지용)

function _getCarryAutoText(student,date){
  const key=`${student}||${date}`;
  const rec=G.hwRec[key];
  if(!rec?.items)return'';
  const carries=rec.items.filter(it=>isCarryForDate(it.fromDate,date)&&!isNone(it.status));
  if(!carries.length)return'';
  const stDesc={2:'완료',1:'일부 완료',0:'미완료'};
  // 상태가 변한 이월과제만 표시, 중복 제거 (같은 텍스트+출제일이면 최신만)
  const changed=carries.filter(it=>{
    const prevSt=_getOriginalRefStatus(student,it.ref);
    return prevSt==null||it.status!==prevSt;
  });
  // 중복 제거: 같은 ref(과제 원본)면 마지막 것만
  const seen=new Map();
  changed.forEach(it=>{seen.set(it.ref,it);});
  return[...seen.values()].map(it=>{
    const cd=refToCheckDate(it.ref);
    const fd=cd?`${shortD(cd)} 출제`:'이전 수업';
    const desc=stDesc[it.status]||'확인 전';
    return`[이월] ${it.text} (${fd}) → ${desc}`;
  }).join('\n');
}

// ref로 원본 과제의 최초 상태 조회
// ref = "lessonId-과제1" → 해당 수업 다음 날짜의 base 항목에서 상태를 찾음
function _getOriginalRefStatus(student,ref){
  if(!ref)return null;
  const dashIdx=ref.lastIndexOf('-');
  if(dashIdx<0)return null;
  const lessonId=ref.slice(0,dashIdx);
  const srcLesson=G.lessons.find(l=>l.id===lessonId);
  if(!srcLesson)return null;
  const srcIdx=G.lessons.indexOf(srcLesson);
  if(srcIdx<0||srcIdx>=G.lessons.length-1)return null;
  // 원본 수업 바로 다음 날짜에서 base 항목의 상태가 최초 기록
  const nextDate=G.lessons[srcIdx+1].날짜;
  const rec=G.hwRec[`${student}||${nextDate}`];
  if(!rec?.items)return null;
  const item=rec.items.find(it=>it.ref===ref);
  if(item&&!isNone(item.status))return item.status;
  return null;
}

function openMemo(){
  if(!G.selStudent||!G.selDate)return;
  _memoKey=`${G.selStudent}||${G.selDate}`;
  let text=G.memos[_memoKey]||'';
  // 기존 저장된 [이월] 자동 텍스트 제거 후 최신으로 교체
  const autoText=_getCarryAutoText(G.selStudent,G.selDate);
  text=text.split('\n').filter(l=>!l.startsWith('[이월]')).join('\n').trim();
  if(autoText){text=text?autoText+'\n'+text:autoText;}
  _memoOriginal=text;
  $$('memoTitle').textContent=`📋 비고 — ${G.selStudent} (${shortD(G.selDate)})`;
  // 자동 텍스트 영역 숨김 (통합됨)
  const autoArea=$$('memoAutoArea');
  if(false){
  }else{
    autoArea.style.display='none';
  }
  $$('memoText').value=text;
  _openModal('memoModalOverlay');
  setTimeout(()=>$$('memoText').focus(),100);
}
function closeMemo(force){
  // 변경 감지: 저장 안 한 채 닫으려 할 때 확인
  const cur=$$('memoText').value.trim();
  if(!force&&cur!==_memoOriginal){
    if(!confirm('저장하지 않은 내용이 있습니다. 닫으시겠습니까?'))return;
  }
  _closeModal('memoModalOverlay');
}
function saveMemo(){
  const text=$$('memoText').value.trim();
  if(text)G.memos[_memoKey]=text;
  else delete G.memos[_memoKey];
  _memoOriginal=text; // 저장했으므로 원본 갱신
  saveAppData();
  _showModalToast('memoModalOverlay','저장되었습니다');
  _closeModal('memoModalOverlay');
  updateMemoBtn();
}
function updateMemoBtn(){
  const btn=$$('btnMemo');if(!btn)return;
  const key=`${G.selStudent||''}||${G.selDate||''}`;
  const has=!!G.memos[key];
  btn.classList.toggle('has',has);
  btn.textContent=has?'📋 비고 수정하기':'📋 비고 작성하기';
  // 학생/날짜 미선택 시 비활성
  btn.disabled=!G.selStudent||!G.selDate;
}

// ─── 모달 공통 (배경스크롤 방지, ESC 처리) ───
function _openModal(id){
  $$(id).style.display='flex';
  document.body.classList.add('modal-open');
}
function _closeModal(id){
  $$(id).style.display='none';
  // 다른 모달이 열려있지 않으면 스크롤 복원
  const anyOpen=['lessonModalOverlay','memoModalOverlay'].some(m=>$$(m)&&$$(m).style.display==='flex');
  if(!anyOpen)document.body.classList.remove('modal-open');
}
function _showModalToast(modalId,msg){
  const modal=$$(modalId);if(!modal)return;
  let toast=modal.querySelector('.modal-toast');
  if(!toast){
    toast=document.createElement('div');toast.className='modal-toast';
    modal.querySelector('.lm-modal').appendChild(toast);
  }
  toast.textContent=msg;toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),1800);
}

// ─── 컬러/흑백 모드 토글 ───
function toggleColorMode(){
  G.colorMode=!G.colorMode;
  const rc=document.querySelector('.rc');
  if(rc)rc.classList.toggle('color-mode',G.colorMode);
  const btn=$$('btnColorMode');
  if(btn)btn.textContent=G.colorMode?'☀️ 컬러 모드':'🌙 흑백 모드';
  saveSession();
}

// ─── 날짜 사이드바 (학생 사이드바 왼쪽, 세로) ───
function renderDateSidebar(){
  const sidebar=$$('dateSidebar'),list=$$('dsList');
  if(!sidebar||!list)return;
  if(!G.lessons.length||G.currentView!=='date'){sidebar.style.display='none';return;}
  sidebar.style.display='flex';
  list.innerHTML=G.lessons.map(l=>{
    const cls=`ds-item${l.날짜===G.selDate?' active':''}`;
    return`<div class="${cls}" onclick="selectDate('${l.날짜}')" title="${fmtKo(l.날짜)}">
      <span class="ds-item-label">${shortD(l.날짜)}</span>
    </div>`;
  }).join('');
  // 선택된 날짜로 스크롤
  const active=list.querySelector('.ds-item.active');
  if(active)setTimeout(()=>active.scrollIntoView({block:'nearest',behavior:'smooth'}),50);
}

// ─── 상단 날짜 네비게이션 (리포트 위) ───
function renderDateNav(){
  const bar=$$('dateNavBar');if(!bar)return;
  if(!G.lessons.length||!G.selDate){bar.style.display='none';return;}
  bar.style.display='flex';
  const label=$$('dnLabel');
  label.textContent=fmtKo(G.selDate);
}
function navDatePrev(){
  const idx=G.lessons.findIndex(l=>l.날짜===G.selDate);
  if(idx>0)selectDate(G.lessons[idx-1].날짜);
}
function navDateNext(){
  const idx=G.lessons.findIndex(l=>l.날짜===G.selDate);
  if(idx>=0&&idx<G.lessons.length-1)selectDate(G.lessons[idx+1].날짜);
}
function toggleDateDropdown(){
  const dd=$$('dnDropdown');
  const isOpen=dd.classList.contains('open');
  dd.classList.toggle('open');
  if(!isOpen){
    dd.innerHTML=G.lessons.map(l=>
      `<button class="${l.날짜===G.selDate?'active':''}" onclick="selectDate('${l.날짜}');$$('dnDropdown').classList.remove('open');">${fmtKo(l.날짜)}</button>`
    ).join('');
  }
}
// 드롭다운 외부 클릭 시 닫기
document.addEventListener('click',function(e){
  const dd=$$('dnDropdown');
  if(dd&&dd.classList.contains('open')&&!e.target.closest('.date-nav-bar'))dd.classList.remove('open');
});

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

// ─── 확대/축소 컨트롤 ───
G._zoomManual=null; // null=auto
function zoomReport(delta){
  if(delta===0){G._zoomManual=null;updateScale();_updateZoomLabel();return;}
  // 현재 스케일 가져오기
  const card=$$('reportCard');if(!card)return;
  const m=card.style.transform.match(/scale\(([\d.]+)\)/);
  const cur=m?parseFloat(m[1]):0.7;
  const nv=Math.max(0.2,Math.min(1.2,cur+delta));
  G._zoomManual=nv;
  const a4h=1123;
  card.style.transform=`scale(${nv})`;
  card.style.marginBottom=`${-(a4h*(1-nv))}px`;
  _updateZoomLabel();
}
function _updateZoomLabel(){
  const el=$$('zoomLevel');if(!el)return;
  if(G._zoomManual==null){el.textContent='auto';}
  else{el.textContent=Math.round(G._zoomManual*100)+'%';}
}

// ─── 학생 전환 화살표 (리포트 양쪽) ───
function navStudentPrev(){
  const idx=G.students.indexOf(G.selStudent);
  if(idx>0){G._stuDir='up';switchTab(G.students[idx-1]);}
}
function navStudentNext(){
  const idx=G.students.indexOf(G.selStudent);
  if(idx>=0&&idx<G.students.length-1){G._stuDir='down';switchTab(G.students[idx+1]);}
}
function _updateStudentNav(){
  const group=$$('stuNavGroup'),prevBtn=$$('stuNavPrev'),nextBtn=$$('stuNavNext');
  if(!group||!prevBtn||!nextBtn)return;
  if(!G.students.length||!G.selStudent||G.currentView!=='date'){
    group.style.display='none';return;
  }
  group.style.display='flex';
  const idx=G.students.indexOf(G.selStudent);
  prevBtn.disabled=idx<=0;
  nextBtn.disabled=idx>=G.students.length-1;
}

// ─── 커스텀 컨텍스트 메뉴 ───
function _showContextMenu(x,y,items){
  _closeContextMenu();
  const menu=document.createElement('div');
  menu.className='ctx-menu';
  menu.innerHTML=items.map((it,i)=>
    it.sep?'<div class="ctx-sep"></div>'
    :`<button class="ctx-btn" data-i="${i}">${it.label}</button>`
  ).join('');
  document.body.appendChild(menu);
  // 위치 (화면 밖 방지)
  const mw=menu.offsetWidth,mh=menu.offsetHeight;
  menu.style.left=Math.min(x,window.innerWidth-mw-8)+'px';
  menu.style.top=Math.min(y,window.innerHeight-mh-8)+'px';
  menu.addEventListener('click',e=>{
    const btn=e.target.closest('.ctx-btn');if(!btn)return;
    const idx=+btn.dataset.i;
    if(items[idx]&&items[idx].action)items[idx].action();
    _closeContextMenu();
  });
  // 메뉴 외부 클릭 시 닫기 (mousedown으로 다음 우클릭 전에 닫힘)
  function onOutside(e){
    if(!menu.contains(e.target)){
      _closeContextMenu();
      document.removeEventListener('mousedown',onOutside,true);
    }
  }
  setTimeout(()=>document.addEventListener('mousedown',onOutside,true),0);
}
function _closeContextMenu(){
  document.querySelectorAll('.ctx-menu').forEach(m=>m.remove());
}

// ─── 캐릭터 설정 모달 (학생별 점수대 마스코트 설정) ───
function openMascotSettingsModal(studentName){
  const exist=document.querySelector('.mascot-settings-overlay');
  if(exist)exist.remove();
  const tiers=[
    {key:'high',label:'75% 이상 (잘했어요!)',color:'#16a34a'},
    {key:'mid',label:'30~74% (보통)',color:'#eab308'},
    {key:'low',label:'30% 미만 (분발!)',color:'#dc2626'}
  ];
  const saved=G.mascotChoices[studentName]||{};
  const overlay=document.createElement('div');
  overlay.className='mascot-settings-overlay';
  const modal=document.createElement('div');
  modal.className='mascot-settings-modal';
  modal.innerHTML=`
    <div class="ms-header">
      <span class="ms-title">🎨 ${esc(studentName)} 캐릭터 설정</span>
      <button class="ms-close" onclick="this.closest('.mascot-settings-overlay').remove()">✕</button>
    </div>
    <div class="ms-body">
      ${tiers.map(t=>{
        const imgs=MASCOT_IMGS[t.key]||[];
        const selIdx=saved[t.key]!=null?saved[t.key]:-1;
        return`<div class="ms-tier">
          <div class="ms-tier-label" style="border-left:3px solid ${t.color};padding-left:8px;">${t.label}</div>
          <div class="ms-tier-grid" data-tier="${t.key}">
            ${imgs.map((src,i)=>`<div class="ms-item${i===selIdx?' selected':''}" data-idx="${i}"><img src="${src}" draggable="false"></div>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  // 선택 이벤트
  modal.querySelectorAll('.ms-tier-grid').forEach(grid=>{
    grid.addEventListener('click',e=>{
      const item=e.target.closest('.ms-item');if(!item)return;
      const tier=grid.dataset.tier;
      const idx=+item.dataset.idx;
      grid.querySelectorAll('.ms-item').forEach(it=>it.classList.remove('selected'));
      item.classList.add('selected');
      G.mascotChoices[studentName]=G.mascotChoices[studentName]||{};
      G.mascotChoices[studentName][tier]=idx;
      saveAppData();
      // 현재 보이는 마스코트도 즉시 갱신
      if(G.selStudent===studentName)updateRateFace();
    });
  });
  // 닫기
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
}

// ─── 키보드 방향키: 좌우=날짜, 상하=학생 ───
document.addEventListener('keydown',function(e){
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable)return;
  if(G.currentView!=='date'||!G.selDate)return;
  if(e.key==='ArrowLeft'){e.preventDefault();navDatePrev();}
  else if(e.key==='ArrowRight'){e.preventDefault();navDateNext();}
  else if(e.key==='ArrowUp'){e.preventDefault();navStudentPrev();}
  else if(e.key==='ArrowDown'){e.preventDefault();navStudentNext();}
});

// ─── 스크롤 끝 도달 시 학생 전환 (비활성화) ───
// 스크롤로 학생 전환하는 기능 제거

// ─── 리포트 영역 우클릭 컨텍스트 메뉴 ───
document.addEventListener('DOMContentLoaded',function(){
  const area=document.querySelector('.preview-content')||document.querySelector('.preview');
  if(!area)return;
  area.addEventListener('contextmenu',function(e){
    // 입력 필드에선 기본 메뉴 유지
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable)return;
    e.preventDefault();
    const onCard=!!e.target.closest('#reportCard');
    const onRightPdf=!!e.target.closest('#rightSlot');
    const items=[
      {label:'📄 PDF로 내보내기',action:()=>dlPdf()},
      {label:'📎 PDF 첨부',action:()=>inlinePdfAttach()}
    ];
    if(onCard){
      items.push({sep:true});
      items.push({label:'📷 리포트 이미지 저장',action:()=>_saveReportAsImage('card')});
    }
    if(onRightPdf){
      items.push({sep:true});
      items.push({label:'📷 시험자료 이미지 저장',action:()=>_saveReportAsImage('right-pdf')});
    }
    _showContextMenu(e.clientX,e.clientY,items);
  });
});

// ─── 리포트/PDF를 이미지로 저장 (html2canvas 캡처) ───
async function _saveReportAsImage(target){
  try{
    if(target==='right-pdf'){
      // 오른쪽 PDF 캔버스를 캡처
      const cv=$$('rightPdfCanvas');
      if(!cv)return;
      const canvas=await html2canvas(cv,{scale:2,useCORS:true,backgroundColor:'#fff',
        width:cv.offsetWidth,height:cv.offsetHeight,scrollX:0,scrollY:0,
        windowWidth:cv.offsetWidth,windowHeight:cv.offsetHeight});
      const link=document.createElement('a');
      link.download=`${G.selStudent||'report'}_시험자료_${G.selDate||'page'}.png`;
      link.href=canvas.toDataURL('image/png');
      link.click();
      return;
    }
    // 리포트 카드를 html2canvas로 캡처
    const el=$$('reportCard');if(!el)return;
    const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#fff',
      onclone:doc=>{const c=doc.getElementById('reportCard');c.style.transform='none';c.style.margin='0';
        doc.querySelectorAll('[contenteditable]').forEach(e=>e.style.outline='none');},
      width:el.offsetWidth,height:el.offsetHeight,scrollX:0,scrollY:0,
      windowWidth:el.offsetWidth,windowHeight:el.offsetHeight});
    const link=document.createElement('a');
    link.download=`${G.selStudent||'report'}_${G.selDate||'card'}.png`;
    link.href=canvas.toDataURL('image/png');
    link.click();
  }catch(err){console.error('이미지 저장 실패:',err);alert('이미지 저장 실패: '+err.message);}
}

// ─── 학생 추가 모달 ───
function openAddStudentModal(){
  _closeHoverMenus();
  const exist=document.querySelector('.stu-modal-overlay[data-type="add"]');
  if(exist)exist.remove();
  const overlay=document.createElement('div');
  overlay.className='stu-modal-overlay';overlay.dataset.type='add';
  overlay.innerHTML=`<div class="stu-modal">
    <div class="stu-modal-header">
      <span class="stu-modal-title">➕ 학생 추가</span>
      <button class="ms-close" onclick="this.closest('.stu-modal-overlay').remove()">✕</button>
    </div>
    <div class="stu-modal-body">
      <div style="font-size:13px;color:#6b7280;">이름을 입력하세요. 쉼표(,)로 구분하면 여러 명을 한번에 추가할 수 있습니다.</div>
      <input type="text" id="addStudentInput" placeholder="예: 김민수, 이서윤, 박지호" style="padding:12px 16px;border:1px solid #e2e5ea;border-radius:10px;font-size:14px;font-family:inherit;outline:none;width:100%;box-sizing:border-box;" autofocus>
      <div id="addStudentMsg" style="font-size:12px;color:#9ca3af;min-height:18px;"></div>
      <button class="btn-p" onclick="_doAddStudents()" style="width:100%;padding:12px;">추가하기</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  const input=overlay.querySelector('#addStudentInput');
  input.addEventListener('keydown',e=>{if(e.key==='Enter')_doAddStudents();});
  setTimeout(()=>input.focus(),100);
}
function _doAddStudents(){
  const input=$$('addStudentInput');if(!input)return;
  const val=input.value.trim();if(!val)return;
  const names=val.split(',').map(n=>n.trim()).filter(n=>n);
  let added=0,dupes=[];
  names.forEach(n=>{
    if(G.students.includes(n)){dupes.push(n);return;}
    G.students.push(n);added++;
  });
  const msg=$$('addStudentMsg');
  if(dupes.length&&msg)msg.textContent=`이미 등록됨: ${dupes.join(', ')}`;
  if(added){
    input.value='';
    if(msg)msg.style.color='#16a34a';
    if(msg)msg.textContent=`${added}명 추가 완료!`;
    renderTabs();saveAppData();
    // 첫 학생이면 자동 선택
    if(!G.selStudent&&G.students.length)G.selStudent=G.students[0];
    if(G.currentView==='date'){renderTabs();_updateStudentNav();}
    setTimeout(()=>{if(msg){msg.textContent='';msg.style.color='#9ca3af';}},2000);
  }
}

// ─── 학생 제거 모달 ───
function openRemoveStudentModal(){
  _closeHoverMenus();
  const exist=document.querySelector('.stu-modal-overlay[data-type="remove"]');
  if(exist)exist.remove();
  const overlay=document.createElement('div');
  overlay.className='stu-modal-overlay';overlay.dataset.type='remove';
  const listHtml=G.students.length?G.students.map((n,i)=>
    `<div class="stu-remove-item" data-idx="${i}">
      <span class="stu-remove-name">${esc(n)}</span>
      <button class="stu-remove-btn" onclick="_doRemoveStudent(${i})">삭제</button>
    </div>`
  ).join(''):'<div style="font-size:13px;color:#9ca3af;text-align:center;padding:20px;">등록된 학생이 없습니다.</div>';
  overlay.innerHTML=`<div class="stu-modal">
    <div class="stu-modal-header">
      <span class="stu-modal-title">➖ 학생 제거</span>
      <button class="ms-close" onclick="this.closest('.stu-modal-overlay').remove()">✕</button>
    </div>
    <div class="stu-modal-body" id="removeStudentList">${listHtml}</div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
}
function _doRemoveStudent(idx){
  const name=G.students[idx];
  if(!confirm(`⚠️ '${name}' 학생을 삭제하시겠습니까?\n\n이 학생의 모든 과제 기록, 이행률, 메모 등이 영구적으로 삭제됩니다.`))return;
  G.students.splice(idx,1);
  if(G.selStudent===name)G.selStudent=G.students[0]||'';
  // 관련 데이터 정리
  delete G.rates[name];delete G.wrong[name];delete G.attend[name];
  delete G.mascotChoices[name];delete G.studentPdfs[name];
  Object.keys(G.hwRec).forEach(k=>{if(k.startsWith(name+'||'))delete G.hwRec[k];});
  Object.keys(G.memos).forEach(k=>{if(k.startsWith(name+'||'))delete G.memos[k];});
  renderTabs();saveAppData();
  // 모달 갱신
  openRemoveStudentModal();
}

// ─── 학생 설정 모달 (껍데기) ───
function openStudentSettingsModal(){
  _closeHoverMenus();
  const exist=document.querySelector('.stu-modal-overlay[data-type="settings"]');
  if(exist)exist.remove();
  const overlay=document.createElement('div');
  overlay.className='stu-modal-overlay';overlay.dataset.type='settings';
  overlay.innerHTML=`<div class="stu-modal">
    <div class="stu-modal-header">
      <span class="stu-modal-title">⚙ 학생 설정</span>
      <button class="ms-close" onclick="this.closest('.stu-modal-overlay').remove()">✕</button>
    </div>
    <div class="stu-modal-body" style="text-align:center;padding:40px 24px;">
      <div style="font-size:40px;margin-bottom:12px;">🚧</div>
      <div style="font-size:15px;font-weight:700;color:#374151;margin-bottom:6px;">준비 중</div>
      <div style="font-size:13px;color:#9ca3af;">학생별 상세 설정 기능이 곧 추가될 예정입니다.</div>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
}

// 메뉴 닫기 헬퍼
function _closeHoverMenus(){
  closeToolbarMenus();
}

// ─── 도움말 모달 ───
function openHelpModal(){
  const exist=document.querySelector('.help-overlay');
  if(exist)exist.remove();
  const overlay=document.createElement('div');
  overlay.className='help-overlay';
  const sections=[
    {icon:'🚀',title:'시작하기',body:'엑셀 파일을 불러오거나, <b>직접 시작하기</b>를 클릭하면 처음부터 설정할 수 있습니다.<br>이전에 저장한 엑셀 파일을 불러오면 기존 데이터를 이어서 작업합니다.'},
    {icon:'👥',title:'학생 관리',body:'상단 <b>학생 관리</b> 메뉴에서 학생을 추가하거나 제거합니다.<br>쉼표(,)로 구분하면 여러 명을 한번에 추가할 수 있습니다.<br>학생을 제거하면 해당 학생의 모든 기록이 삭제됩니다.'},
    {icon:'📅',title:'수업 설정',body:'<b>설정 → 수업 진도 설정</b>에서 수업 날짜, 교재, 단원, 과제를 관리합니다.<br>날짜 네비게이션의 <b>+</b> 버튼으로도 날짜를 빠르게 추가할 수 있습니다.<br>왼쪽 패널에서 우클릭하면 바로 수업 설정을 열 수 있습니다.'},
    {icon:'✅',title:'과제 관리',body:'왼쪽 패널에서 과제 상태(완료/부분완료/미완료)를 체크합니다.<br>이행률은 직접 입력하거나 <b>자동계산</b> 버튼으로 계산됩니다.<br>학생별 추가 과제도 등록할 수 있고, 미완료 과제는 자동으로 다음 수업에 이월됩니다.'},
    {icon:'📄',title:'리포트 확인',body:'오른쪽 미리보기에서 학생별 리포트카드를 실시간으로 확인합니다.<br>학생 사이드바에서 학생을 클릭하거나 키보드 ↑↓로 전환합니다.<br>날짜는 상단 화살표 또는 키보드 ←→로 이동합니다.'},
    {icon:'📊',title:'리포트 모아보기',body:'<b>리포트 모아보기</b> 메뉴에서 다양한 요약 자료를 확인합니다:<br>• 📝 수업 일지 — 날짜별 수업 내용 정리<br>• 📊 이행률 요약표 — 학생별/전체 과제 이행률<br>• 📋 전체 과제 요약 — 모든 학생의 과제 상태 한눈에'},
    {icon:'💾',title:'저장하기',body:'<b>💾 저장</b> 버튼을 누르면 엑셀 파일로 저장됩니다.<br>다음에 이 파일을 다시 불러오면 이어서 작업할 수 있습니다.<br><b>일괄 PDF</b>로 선택한 날짜의 전체 학생 리포트를 한번에 내보낼 수 있습니다.'},
    {icon:'📥',title:'샘플 파일',body:'처음 사용하시나요? 아래 버튼으로 샘플 엑셀 파일을 다운받아 참고하세요.<br>4명의 학생과 3개의 수업 날짜가 포함된 예시 데이터입니다.'}
  ];
  overlay.innerHTML=`<div class="help-modal">
    <div class="help-header">
      <span class="help-title">❓ 도움말</span>
      <button class="ms-close" onclick="this.closest('.help-overlay').remove()">✕</button>
    </div>
    <div class="help-body">
      ${sections.map((s,i)=>`<div class="help-acc${i===0?' open':''}">
        <div class="help-acc-head" onclick="this.parentElement.classList.toggle('open')">
          <span class="help-acc-icon">${s.icon}</span>
          <span>${s.title}</span>
          <span class="help-acc-arrow">▶</span>
        </div>
        <div class="help-acc-body">${s.body}${s.title==='샘플 파일'?'<br><button class="help-sample-btn" onclick="createSampleExcel()">📥 샘플 엑셀 다운로드</button>':''}</div>
      </div>`).join('')}
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
}

// ─── 일괄 PDF 모달 (날짜 선택) ───
function openBatchPdfModal(){
  if(!G.lessons.length||!G.students.length){alert('수업 및 학생 데이터가 필요합니다.');return;}
  let overlay=$$('batchPdfOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='batchPdfOverlay';overlay.className='lm-overlay';
    overlay.innerHTML=`<div class="lm-modal" style="max-width:420px;">
      <div class="lm-header"><h3>📄 일괄 PDF 내보내기</h3><button class="lm-close" id="batchPdfClose">✕</button></div>
      <div style="padding:20px 24px;">
        <div style="font-size:13px;color:#6b7280;margin-bottom:14px;">선택한 날짜의 모든 학생 리포트를 하나의 PDF로 내보냅니다.</div>
        <div style="font-size:13px;font-weight:700;color:#4e5968;margin-bottom:8px;">날짜 선택</div>
        <select id="batchPdfDate" style="width:100%;padding:10px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;margin-bottom:8px;"></select>
        <div id="batchPdfInfo" style="font-size:12px;color:#6b7280;margin-bottom:18px;"></div>
        <div style="display:flex;gap:10px;">
          <button class="btn-s" id="batchPdfCancel" style="flex:1;">취소</button>
          <button class="btn-p" id="batchPdfOk" style="flex:1;">📥 내보내기</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(overlay);
  }
  const opts=G.lessons.map(l=>`<option value="${l.날짜}"${l.날짜===G.selDate?' selected':''}>${fmtKo(l.날짜)}</option>`).join('');
  $$('batchPdfDate').innerHTML=opts;
  const updateInfo=()=>{
    const d=$$('batchPdfDate').value;
    const el=G.students.filter(n=>G.rates[n]?.[d]!=null);
    $$('batchPdfInfo').textContent=`출석 ${el.length}명 · 결석 ${G.students.length-el.length}명`;
  };
  $$('batchPdfDate').onchange=updateInfo;
  updateInfo();
  overlay.style.display='flex';document.body.classList.add('modal-open');
  const close=()=>{overlay.style.display='none';document.body.classList.remove('modal-open');};
  $$('batchPdfClose').onclick=close;
  $$('batchPdfCancel').onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close();};
  $$('batchPdfOk').onclick=()=>{
    const date=$$('batchPdfDate').value;
    close();
    selectDate(date);
    setTimeout(()=>_doBatchPdf(),200);
  };
}

// ─── 날짜 추가 (네비 바에서) ───
function addDateFromNav(){
  addLesson();
  // 마지막 추가된 날짜로 이동
  if(G.lessons.length){
    const last=G.lessons[G.lessons.length-1];
    selectDate(last.날짜);
  }
  renderDateNav();
}

// ─── 수업 진도 설정 (포커싱된 날짜로 열기) ───
function openLessonModalFocused(date){
  const idx=G.lessons.findIndex(l=>l.날짜===date);
  G._lessonFocus=idx>=0?idx:-1;
  renderLessonCards();
  _openModal('lessonModalOverlay');
}

// ─── 왼쪽 패널: 읽기전용 필드 툴팁 + 우클릭 ───
document.addEventListener('DOMContentLoaded',function(){
  // 읽기전용 자동채우기 필드에 툴팁 클래스 추가
  const autoFields=['dateSummary','gPrevHw','gCurHw'];
  autoFields.forEach(id=>{
    const el=$$(id);if(!el)return;
    el.addEventListener('click',function(e){
      // 이미 편집 가능한 요소면 무시
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='BUTTON'||e.target.isContentEditable)return;
      if(e.target.closest('.hw-item')||e.target.closest('.hw-add-extra'))return;
      // 툴팁 표시
      _showAutoFieldTip(e.clientX,e.clientY);
    });
  });
  // 왼쪽 패널 우클릭 → 수업 진도 설정
  const panelBody=document.querySelector('.panel-body');
  if(panelBody){
    panelBody.addEventListener('contextmenu',function(e){
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable)return;
      e.preventDefault();
      _showContextMenu(e.clientX,e.clientY,[
        {label:'📋 수업 진도 설정',action:()=>{
          const date=G.selDate||todayKST();
          openLessonModalFocused(date);
        }}
      ]);
    });
  }
});
function _showAutoFieldTip(x,y){
  const existing=document.querySelector('.auto-field-popup');
  if(existing)existing.remove();
  const tip=document.createElement('div');
  tip.className='auto-field-popup';
  tip.style.cssText=`position:fixed;left:${x}px;top:${y-36}px;background:#1e293b;color:#fff;
    padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;z-index:10000;
    pointer-events:none;animation:srFadeIn .15s;white-space:nowrap;`;
  tip.textContent='수업 진도 설정에서 수정하세요';
  document.body.appendChild(tip);
  setTimeout(()=>tip.remove(),2000);
}
