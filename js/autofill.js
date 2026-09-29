// ─── ref → 텍스트·출제일 해석 (이월 전파용) ───
// 신 형식 추가과제는 ref 자체에 텍스트가 박혀있어 student 인자 없이도 해석됨
// 구 형식 추가과제(extra-legacy)만 student의 hwRec.extraHw 조회 필요
function _resolveCarryRef(ref,student){
  const p=parseHwRef(ref);
  if(!p)return{text:'',fromDate:''};
  const src=G.lessons.find(l=>l.id===p.lessonId);
  if(!src)return{text:'',fromDate:''};
  if(p.type==='extra')return{text:p.text,fromDate:src.날짜};
  if(p.type==='extra-legacy'){
    const rec=G.hwRec[`${student}||${src.날짜}`];
    return{text:rec?.extraHw?.[p.ei]?.text||'',fromDate:src.날짜};
  }
  return{text:src[p.hwKey]||'',fromDate:src.날짜};
}

// ─── 이월 전파: status 변경 시 미래 날짜 hwRec 갱신 ───
// status 0/1 → 다음 날짜에 이월 레코드 생성 (없으면)
// status 2/-1 → 이후 모든 날짜에서 해당 ref 레코드 삭제
function propagateCarryover(student,date,refStr,newStatus){
  if(!refStr)return;
  const curIdx=G.lessons.findIndex(l=>l.날짜===date);
  if(curIdx<0)return;
  if(newStatus===0||newStatus===1){
    if(curIdx>=G.lessons.length-1)return;
    const nextDate=G.lessons[curIdx+1].날짜;
    const nk=`${student}||${nextDate}`;
    let nr=G.hwRec[nk];
    if(!nr){nr={이행률:null};G.hwRec[nk]=nr;}
    if(!nr.items)nr.items=[];
    if(nr.items.some(it=>it.ref===refStr))return;
    const r=_resolveCarryRef(refStr,student);
    if(isOptionalHw(r.text))return; // (선택) 과제는 이월하지 않음
    nr.items.push({text:r.text,status:-1,ref:refStr,fromDate:r.fromDate});
  }else if(newStatus===2||newStatus===-1){
    for(let i=curIdx+1;i<G.lessons.length;i++){
      const fk=`${student}||${G.lessons[i].날짜}`;
      const fr=G.hwRec[fk];
      if(!fr?.items)continue;
      fr.items=fr.items.filter(it=>it.ref!==refStr);
    }
  }
}

// ─── 보류된 이월 전파 일괄 적용 ───
function flushPropagations(){
  if(!G.pendingPropagations.length)return;
  G.pendingPropagations.forEach(p=>propagateCarryover(p.student,p.date,p.ref,p.status));
  G.pendingPropagations=[];
}

// ─── 엑셀 로드 후 전체 이월 전파 ───
// 모든 날짜·학생의 items를 순회하며 미완료/부분완료 항목의 이월 레코드를 자동 생성
function buildAllCarryover(){
  G.lessons.forEach((les,idx)=>{
    if(idx>=G.lessons.length-1)return;
    const date=les.날짜;
    G.students.forEach(name=>{
      const rec=G.hwRec[`${name}||${date}`];
      if(!rec?.items)return;
      rec.items.forEach(it=>{
        if((it.status===0||it.status===1)&&it.ref){
          propagateCarryover(name,date,it.ref,it.status);
        }
      });
    });
  });
}

// ─── 캐리오버 계산 ───
// 직전 날짜의 hwRec.items에서 미완료(0)/부분완료(1) 항목을 수집
function computeCarryover(student,date){
  const curIdx=G.lessons.findIndex(l=>l.날짜===date);
  if(curIdx<=0)return[];
  const prevDate=G.lessons[curIdx-1].날짜;
  const key=`${student}||${prevDate}`;
  const rec=G.hwRec[key];
  if(!rec?.items?.length)return[];
  return rec.items
    .filter(it=>(it.status===0||it.status===1)&&it.ref&&!isOptionalHw(it.text))
    .map(it=>({text:it.text,ref:it.ref,fromDate:it.fromDate||prevDate}));
}

// ─── 이번 주차 과제 ON/OFF 헬퍼 ───
// 학생·날짜별로 OFF된 과제 ref 집합을 반환 (없으면 생성).
// 전역 단일 Set이 아니라 학생·날짜별로 분리되어 다른 회차로 이동해도 유지됨.
function _hwDisabledSet(){
  if(!G.hwDisabled||typeof G.hwDisabled!=='object'||G.hwDisabled instanceof Set)G.hwDisabled={};
  const key=`${G.selStudent||''}||${G.selDate||''}`;
  if(!(G.hwDisabled[key] instanceof Set))G.hwDisabled[key]=new Set();
  return G.hwDisabled[key];
}

// 이번 주차 과제 목록 구성 — renderCurHwList·updateNoticeWithCarry·autoSyncHwDisabled 공용.
// 각 항목은 안정적인 ref를 가져 인덱스 흔들림 없이 ON/OFF를 추적할 수 있음.
// 반환: [{text, ref, kind:'base'|'extra'|'carry', st}]
function _curHwOnOffItems(){
  const cur=getCurL();
  if(!cur)return[];
  const out=[];
  // 1. 이번 수업 본과제
  getLessonHwKeys(cur).forEach(k=>{
    const text=(cur[k]||'').trim();
    if(text)out.push({text,ref:`${cur.id}-${k}`,kind:'base',st:-1});
  });
  // 2. 이번 주차 추가 과제
  (G.extraHw||[]).forEach(it=>{
    const text=(it.text||'').trim();
    if(text)out.push({text,ref:buildExtraRef(cur.id,text),kind:'extra',st:-1});
  });
  // 2-1. 문제 노트 숙제 + 오답 다시 풀기 (학원 저장소 로그인 시, cloud.js — 학생마다 다름, 자동)
  if(typeof noteNextItems==='function'){
    noteNextItems(G.selStudent,G.selDate).forEach(it=>out.push({text:it.text,ref:it.ref,kind:'note',st:-1}));
  }
  // 3. 직전 수업 미완료 + 이월 과제 (모두 (전) 표시)
  G.hwItems.forEach((text,i)=>{
    const carry=isCarryItem(G.hwItemRefs[i]?.fromDate);
    const st=G.hwStatus[i];
    const ref=G.hwItemRefs[i]?.ref;
    if(isOptionalHw(text))return; // (선택) 과제는 다음 수업 과제로 넘기지 않음
    if(carry){
      out.push({text,ref:ref||`carry#${i}`,kind:'carry',st});
    }else if(!isNone(st)&&(st===0||st===1)){
      out.push({text,ref:ref||`prev#${i}`,kind:'carry',st});
    }
  });
  return out;
}

// ─── 저번주차/이월 과제 상태에 따라 이번주차 이월 항목 자동 ON/OFF ───
function autoSyncHwDisabled(){
  const dis=_hwDisabledSet();
  _curHwOnOffItems().forEach(it=>{
    if(it.kind!=='carry')return; // 본과제·추가과제는 수동 토글만
    // 완료/없음 → OFF, 미완료/부분완료 → ON
    if(it.st===2||isNone(it.st))dis.add(it.ref);
    else dis.delete(it.ref);
  });
}

// ─── 이번 주차 과제 + 추가과제 + 미완료 캐리 반영 (리포트카드) ───
function updateNoticeWithCarry(){
  const cur=getCurL();if(!cur)return;
  const dis=_hwDisabledSet();
  const list=$$('rNoticeList');
  let baseHtml='',extraHtml='',carryHtml='';
  let baseCount=0,carryCount=0;
  _curHwOnOffItems().forEach(it=>{
    if(dis.has(it.ref))return; // OFF → 리포트에서 제외
    if(it.kind==='base'){
      baseHtml+=`<div class="next-hw-li">${esc(it.text)}</div>`;baseCount++;
    }else if(it.kind==='extra'){
      extraHtml+=`<div class="next-hw-li"><span class="carry-tag">(개별)</span>${esc(it.text)}</div>`;baseCount++;
    }else if(it.kind==='note'){
      extraHtml+=`<div class="next-hw-li note-li">${esc(it.text)}</div>`;baseCount++;
    }else if(it.st===0||it.st===1){
      // 이월/직전미완료: 미완료·부분완료만 이번 주차 과제로 노출
      carryHtml+=`<div class="next-hw-li"><span class="carry-tag">(이월)</span>${esc(it.text)}</div>`;carryCount++;
    }
  });
  const total=baseCount+carryCount;
  if(!total){
    // 과제가 없는 날(시험 대비 복습 등) — 빈 칸 대신 안내 문구
    list.className='next-hw-list';
    list.innerHTML='<div class="next-hw-empty">별도 과제 없음</div>';
  }else if(total>3&&carryCount>0){
    list.className='next-hw-list compact';
    list.innerHTML=`<div class="hw-col"><div class="hw-col-label">본과제</div>${baseHtml}${extraHtml}</div>`
      +`<div class="hw-col"><div class="hw-col-label">이월과제</div>${carryHtml}</div>`;
  }else{
    list.className='next-hw-list';
    list.innerHTML=baseHtml+extraHtml+carryHtml;
  }
  // 패널 이번 주차 과제 목록 갱신
  renderCurHwList();
}

// ─── 패널: 이번 주차 과제 목록 (레슨 과제 + 이월과제 + Enable/Disable) ───
function renderCurHwList(){
  const c=$$('curHwList');if(!c)return;
  const cur=getCurL();if(!cur){c.innerHTML='';return;}
  const dis=_hwDisabledSet();
  c.innerHTML=_curHwOnOffItems().map((it,i)=>{
    const off=dis.has(it.ref);
    const cls=it.kind==='extra'?'cur-hw-item extra':it.kind==='carry'?'cur-hw-item carry':it.kind==='note'?'cur-hw-item note':'cur-hw-item';
    const badge=it.kind==='extra'?'<span class="cur-hw-badge">(추가)</span>'
               :it.kind==='carry'?'<span class="cur-hw-badge">(이월)</span>'
               :it.kind==='note'?'<span class="cur-hw-badge" title="문제 노트 숙제·오답 — 자동으로 붙어요. 누르면 이번 리포트에서 끄고 켭니다">(문제 노트)</span>':'';
    return`<div class="${cls}${off?' disabled':''}" onclick="toggleHwDisabled(${i})">
      ${badge}<span class="cur-hw-text">${esc(it.text)}</span>
      <span class="cur-hw-toggle">${off?'OFF':'ON'}</span>
    </div>`;
  }).join('');
}

// 이번 주차 과제 Enable/Disable 토글 (인덱스는 즉시 안정적인 ref로 해석)
function toggleHwDisabled(idx){
  const it=_curHwOnOffItems()[idx];
  if(!it)return;
  const dis=_hwDisabledSet();
  if(dis.has(it.ref))dis.delete(it.ref);
  else dis.add(it.ref);
  renderCurHwList();
  updateNoticeWithCarry();fitReportCard();
  saveAppData();
}

// ─── 패널: 추가 과제 에디터 (학생별) ───
function renderExtraHwEditor(){
  const c=$$('extraHwEditor');if(!c)return;
  c.innerHTML=(G.extraHw||[]).map((it,i)=>
    `<div class="extra-hw-item">
      <span class="hw-extra-badge">(추가)</span>
      <input type="text" value="${esc(it.text)}" oninput="updateExtraHwText(${i},this.value)">
      <button class="hw-extra-del" onclick="removeExtraHw(${i})" title="삭제">✕</button>
    </div>`
  ).join('');
}

// ─── 수업 정보 → 리포트카드 (헤더 날짜·진도·다음 수업 과제 기본 목록) ───
function renderLessonInfo(){
  const cur=getCurL();if(!cur)return;
  const prev=getPrevL(),next=getNextL();
  updateHeaderDate(cur.날짜,next?.날짜||'');
  const put=(id,v)=>{const el=$$(id);if(el)el.innerText=String(v||'').replace(/\n{2,}/g,'\n').trim();};
  put('rCurBook',cur.교재);put('rCurChap',cur.단원);put('rCurDetail',cur.상세진도);
  put('rPrevBook',prev?.교재);put('rPrevChap',prev?.단원);put('rPrevDetail',prev?.상세진도);
  updateNoticeList(getLessonHwKeys(cur).map(k=>cur[k]||'').filter(x=>x).join('\n'));
}

// ─── 자동 채우기 (날짜 기준 공통) ───
function autoFillCommon(){
  if(!getCurL())return;
  renderLessonInfo();
  renderDateSummary();
}

// ─── 이전 날짜의 extraHw를 base 항목으로 가져오기 ───
function getPrevExtraHw(student,date){
  const curIdx=G.lessons.findIndex(l=>l.날짜===date);
  if(curIdx<=0)return[];
  const prevDate=G.lessons[curIdx-1].날짜;
  const key=`${student}||${prevDate}`;
  const rec=G.hwRec[key];
  return(rec?.extraHw||[]).map(it=>it.text).filter(x=>x);
}

// ─── 자동 채우기 (학생+날짜 기준 전체) ───
function autoFillAll(){
  autoFillCommon();$$('rName').innerText=G.selStudent;
  const hadData=restoreTabData(G.selStudent);
  if(!hadData){
    // hwRec.items는 캐시이지만, 직전 수업의 base 과제가 추가/변경되었을 수 있으므로
    // 항상 prev hw + computeCarryover로 재구성하고 기존 status는 ref로 매칭하여 보존
    const key=G.selDate?`${G.selStudent}||${G.selDate}`:null;
    const hwR=key?G.hwRec[key]:null;
    const existingStatus=new Map();
    if(hwR?.items){
      hwR.items.forEach(it=>{if(it.ref)existingStatus.set(it.ref,it.status??-1);});
    }
    const prev=getPrevL();
    let allItems=[];
    if(prev){
      getLessonHwKeys(prev).forEach(k=>{
        const text=prev[k]||'';if(!text)return;
        allItems.push({text,ref:`${prev.id}-${k}`,fromDate:prev.날짜});
      });
    }
    getPrevExtraHw(G.selStudent,G.selDate).forEach(text=>{
      // 신 형식: 텍스트 기반 ref (인덱스 흔들림 없음)
      allItems.push({text,ref:prev?buildExtraRef(prev.id,text):'',fromDate:prev?.날짜||''});
    });
    // 캐리오버 항목 (직전 날짜에서 미완료인 것) — 중복 ref 제외
    computeCarryover(G.selStudent,G.selDate).forEach(c=>{
      if(c.ref&&allItems.some(it=>it.ref===c.ref))return;
      allItems.push({text:c.text,ref:c.ref,fromDate:c.fromDate});
    });
    G.hwItems=allItems.map(it=>it.text);
    G.hwItemRefs=allItems.map(it=>({ref:it.ref,fromDate:it.fromDate}));
    // 순번 필드는 rec.items가 아예 없을 때만 사용 (있으면 ref로만 매칭 — 새 과제가 남의 상태를 물려받지 않도록)
    const useLegacy=!hwR?.items?.length;
    let li=0;
    G.hwStatus=allItems.map(it=>{
      li++;
      // 1순위: rec.items의 ref 매칭으로 status 복원
      if(it.ref&&existingStatus.has(it.ref))return existingStatus.get(it.ref);
      // 2순위: 레거시 과제N_상태 (rec.items가 없는 경우)
      const st=useLegacy?hwR?.[`과제${li}_상태`]:null;
      return st!=null?stFromExcel(st):-1;
    });
    // 이번 날짜의 학생별 추가 과제 로드
    G.extraHw=(hwR?.extraHw||[]).map(it=>({...it}));
    G.hwRateManual=null;
  }
  // 입력칸: 오답·이행률 (오답은 입력 즉시 G.wrong에 저장되므로 항상 G.wrong 기준)
  $$('inputWrong').value=G.wrong[G.selStudent]?.[G.selDate]||'';
  if(G.hwRateManual!==null){$$('inputRate').value=G.hwRateManual;$$('inputRate').classList.remove('auto');}
  else setAuto('inputRate',G.rates[G.selStudent]?.[G.selDate]??'');
  renderHwEditor();
  renderExtraHwEditor();updateNoticeWithCarry();
  if(!hadData)syncHwRecItems(G.selStudent,G.selDate);
  refreshRateSection();rebuildGraph();
  renderMiniPanel();updateMiniSection();
  renderCommentPanel();updateCommentSection();
  if(typeof renderNotePanel==='function')renderNotePanel(); // 문제 노트 숙제 채점 카드 (cloud.js)
  fitReportCard();
}
