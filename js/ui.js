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

// 리포트카드 → 패널 단방향 동기화 (좌패널에서 갱신 시 override 제거)
function fp(cid,pid){const c=$$(cid),p=$$(pid);if(c&&p){const v=p.value.replace(/\n{2,}/g,'\n');if(c.innerText.trim()!==v){c.innerText=v;delete G.reportEdits[cid];}}}

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
  $$('viewDate').style.display=view==='date'?'':'none';
  $$('tabBar').style.display=view==='date'&&G.students.length?'flex':'none';
  if(view==='config'){
    openLessonModal();
  }else if(view==='date'){
    closeLessonModal();
    renderDateSummary();
    renderTabs();
    updateMemoBtn();
    if(G.selDate&&G.selStudent)autoFillAll();
    else if(G.selDate)autoFillCommon();
  }
  saveSession();
}

// ─── 수업설정 전체화면 모달 ───
function openLessonModal(){
  renderLessonCards();
  renderStudentList();
  _openModal('lessonModalOverlay');
}
function closeLessonModal(){
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
  renderViewTabs();
}

function selectDate(date){
  // 모든 학생의 tabData를 hwRec에 동기화 (현재 학생은 먼저 saveTabData)
  if(G.selDate){
    if(G.selStudent)saveTabData();
    for(const name of Object.keys(G.tabData)){
      const td=G.tabData[name];if(!td)continue;
      const key=`${name}||${G.selDate}`;
      const rec=G.hwRec[key]||{이행률:null};
      const items=(td.hwItems||[]);
      const hs=td.hwStatus||[];
      const types=td.hwItemTypes||items.map(()=>({type:'base'}));
      if(items.length){
        rec.items=items.map((text,i)=>({text,status:hs[i]??-1,type:types[i]?.type||'base',fromDate:types[i]?.fromDate||''}));
        items.forEach((_,i)=>{if(!types[i]||types[i].type==='base')rec[`과제${i+1}_상태`]=hs[i]??-1;});
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
  const today=new Date().toISOString().slice(0,10);
  // 오늘 이후 가장 가까운 날짜 찾기
  const futureDates=G.lessons.filter(l=>l.날짜>=today).map(l=>l.날짜);
  const nextDate=futureDates.length?futureDates[0]:null;
  c.innerHTML=G.lessons.map((l,i)=>{
    let cls='lesson-card';
    if(l.날짜<today)cls+=' lc-past';
    else if(l.날짜===nextDate)cls+=' lc-next';
    const hwKeys=getLessonHwKeys(l);
    const hwHtml=hwKeys.map((k,hi)=>`
      <div class="lc-hw-row">
        <input placeholder="과제 ${hi+1}" value="${esc(l[k]||'')}" oninput="updateLessonField(${i},'${k}',this.value)">
        ${hwKeys.length>1?`<button class="lc-hw-del" onclick="removeLessonHw(${i},${hi})" title="과제 삭제">✕</button>`:''}
      </div>`).join('');
    return`<div class="${cls}" data-idx="${i}">
      <div class="lc-head">
        <input type="date" class="lc-date-input" value="${l.날짜}" onchange="updateLessonDate(${i},this.value)">
        <button class="lc-del" onclick="removeLesson(${i})" title="삭제">🗑</button>
      </div>
      <div class="lc-body">
        <div class="lc-row">
          <input placeholder="교재명" value="${esc(l.교재)}" oninput="updateLessonField(${i},'교재',this.value)">
          <input placeholder="단원명" value="${esc(l.단원)}" oninput="updateLessonField(${i},'단원',this.value)">
        </div>
        <textarea placeholder="상세 진도" rows="1" oninput="updateLessonField(${i},'상세진도',this.value)">${esc(l.상세진도)}</textarea>
        <div class="lc-hw-label">과제</div>
        <div class="lc-hw">${hwHtml}
          <button class="lc-hw-add" onclick="addLessonHw(${i})">+ 과제 추가</button>
        </div>
      </div>
    </div>`;
  }).join('');
  // 가장 가까운 미래 날짜로 스크롤
  if(nextDate){
    const idx=G.lessons.findIndex(l=>l.날짜===nextDate);
    const card=c.children[idx];
    if(card)setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'center'}),100);
  }
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
  renderLessonCards();renderViewTabs();saveAppData();
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
  const hwKeys=getLessonHwKeys(cur);
  const hwT=hwKeys.map(k=>cur[k]||'').filter(x=>x);
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
  const m=$$('rateMascot');if(m)delete m.dataset.idx;
  updateMemoBtn();
  if(G.selDate)autoFillAll();
  saveSession();
}

function saveTabData(){
  if(!G.selStudent)return;
  G.tabData[G.selStudent]={
    hwStatus:[...G.hwStatus],
    hwItems:[...G.hwItems],
    hwItemTypes:G.hwItemTypes.map(t=>({...t})),
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
  rec.items=G.hwItems.map((text,i)=>({
    text,
    status:G.hwStatus[i]??-1,
    type:G.hwItemTypes[i]?.type||'base',
    fromDate:G.hwItemTypes[i]?.fromDate||''
  }));
  // 레거시 필드도 업데이트 (base items)
  G.hwItems.forEach((_, i)=>{
    if(!G.hwItemTypes[i]||G.hwItemTypes[i].type==='base'){
      rec[`과제${i+1}_상태`]=G.hwStatus[i]??-1;
    }
  });
  // 이번 주차 추가 과제 저장
  rec.extraHw=(G.extraHw||[]).map(it=>({...it}));
  G.hwRec[key]=rec;
}

function restoreTabData(name){
  const d=G.tabData[name];if(!d)return false;
  G.hwStatus=d.hwStatus||[];
  G.hwItems=d.hwItems||[];
  G.hwItemTypes=d.hwItemTypes||G.hwItems.map(()=>({type:'base'}));
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
  const carryItems=rec.items.filter(it=>it.type==='carry');
  if(!carryItems.length)return'';
  const stLabel={2:'완료',1:'부분완료',0:'미완료'};
  return carryItems.map(it=>{
    const fd=it.fromDate?shortD(it.fromDate):'';
    const sl=stLabel[it.status]||'미확인';
    return`(${fd}) ${it.text} → ${sl}`;
  }).join('\n');
}

function openMemo(){
  if(!G.selStudent||!G.selDate)return;
  _memoKey=`${G.selStudent}||${G.selDate}`;
  const text=G.memos[_memoKey]||'';
  _memoOriginal=text;
  $$('memoTitle').textContent=`📋 비고 — ${G.selStudent} (${shortD(G.selDate)})`;
  // 자동 이월과제 요약 표시
  const autoText=_getCarryAutoText(G.selStudent,G.selDate);
  const autoArea=$$('memoAutoArea');
  if(autoText){
    $$('memoAutoText').textContent=autoText;
    autoArea.style.display='';
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
