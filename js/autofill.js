// ─── ref → 텍스트·출제일 해석 (이월 전파용) ───
function _resolveCarryRef(ref,student){
  if(!ref)return{text:'',fromDate:''};
  const di=ref.lastIndexOf('-');
  if(di<0)return{text:'',fromDate:''};
  const lessonId=ref.slice(0,di),hwKey=ref.slice(di+1);
  const src=G.lessons.find(l=>l.id===lessonId);
  if(!src)return{text:'',fromDate:''};
  if(hwKey.startsWith('추가과제')){
    const ei=parseInt(hwKey.replace('추가과제',''))-1;
    const rec=G.hwRec[`${student}||${src.날짜}`];
    return{text:rec?.extraHw?.[ei]?.text||'',fromDate:src.날짜};
  }
  return{text:src[hwKey]||'',fromDate:src.날짜};
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
    .filter(it=>(it.status===0||it.status===1)&&it.ref)
    .map(it=>({text:it.text,ref:it.ref,fromDate:it.fromDate||prevDate}));
}

// ─── 직전 수업 날짜 반환 (date 기준) ───
function _prevDateFor(date){
  const idx=G.lessons.findIndex(l=>l.날짜===date);
  return idx>0?G.lessons[idx-1].날짜:null;
}

// ─── 저번주차/이월 과제 상태에 따라 이번주차 과제 이월 항목 자동 ON/OFF ───
function autoSyncHwDisabled(){
  const cur=getCurL();if(!cur)return;
  const hwKeys=getLessonHwKeys(cur);
  const hw=hwKeys.map(k=>cur[k]||'').filter(x=>x);
  const extra=(G.extraHw||[]).map(it=>it.text).filter(x=>x);
  if(!G.hwDisabled)G.hwDisabled=new Set();
  let idx=hw.length+extra.length;
  // prevIncomplete (직전 수업 미완료)
  G.hwItems.forEach((_,i)=>{
    if(isCarryItem(G.hwItemRefs[i]?.fromDate))return;
    const st=G.hwStatus[i];
    if(!isNone(st)&&(st===0||st===1)){G.hwDisabled.delete(idx);idx++;}
  });
  // carry (이월 과제): 완료/없음→OFF, 미완료/부분완료→ON
  G.hwItems.forEach((_,i)=>{
    if(!isCarryItem(G.hwItemRefs[i]?.fromDate))return;
    const st=G.hwStatus[i];
    if(st===2||isNone(st))G.hwDisabled.add(idx);
    else G.hwDisabled.delete(idx);
    idx++;
  });
}

// ─── 이번 주차 과제 + 추가과제 + 미완료 캐리 반영 (리포트카드) ───
function updateNoticeWithCarry(){
  const cur=getCurL();if(!cur)return;
  const hwKeys=getLessonHwKeys(cur);
  const baseHw=hwKeys.map(k=>cur[k]||'').filter(x=>x);
  // 학생별 추가 과제
  const extraHw=(G.extraHw||[]).map(it=>it.text).filter(x=>x);
  // renderCurHwList와 동일 순서로 구성 (인덱스 일치)
  const prevIncomplete=[];
  const carryItems=[];
  G.hwItems.forEach((text,i)=>{
    const st=G.hwStatus[i];
    if(isCarryItem(G.hwItemRefs[i]?.fromDate)){
      carryItems.push({text,st});
    } else if(!isNone(st)&&(st===0||st===1)){
      prevIncomplete.push({text});
    }
  });
  // disabled 과제 필터링 (모든 항목에 적용)
  const dis=G.hwDisabled||new Set();
  let di=0;
  const list=$$('rNoticeList');
  let baseCount=0;
  const baseHtml=baseHw.map(t=>{const d=dis.has(di);di++;if(d)return '';baseCount++;return `<div class="next-hw-li">${esc(t)}</div>`;}).join('');
  const extraHtml=extraHw.map(t=>{const d=dis.has(di);di++;if(d)return '';baseCount++;return `<div class="next-hw-li"><span class="carry-tag">(추가)</span>${esc(t)}</div>`;}).join('');
  let carryCount=0;let carryHtml='';
  prevIncomplete.forEach(u=>{const d=dis.has(di);di++;if(!d){carryCount++;carryHtml+=`<div class="next-hw-li"><span class="carry-tag">(전)</span>${esc(u.text)}</div>`;}});
  carryItems.forEach(u=>{const d=dis.has(di);di++;if(!d&&!isNone(u.st)&&(u.st===0||u.st===1)){carryCount++;carryHtml+=`<div class="next-hw-li"><span class="carry-tag">(전)</span>${esc(u.text)}</div>`;}});
  const total=baseCount+carryCount;
  if(total>3&&carryCount>0){
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
  const hwKeys=getLessonHwKeys(cur);
  const hw=hwKeys.map(k=>cur[k]||'').filter(x=>x);
  // 미완료 과제 수집 (직전 수업 미완료 + 이월과제 모두 포함)
  const prevIncomplete=[];
  const carry=[];
  G.hwItems.forEach((text,i)=>{
    const st=G.hwStatus[i];
    if(isCarryItem(G.hwItemRefs[i]?.fromDate)){
      carry.push(text);
    } else if(!isNone(st)&&(st===0||st===1)){
      prevIncomplete.push(text);
    }
  });
  const extra=(G.extraHw||[]).map(it=>it.text).filter(x=>x);
  // Enable/Disable 상태 (G.hwDisabled: Set of disabled indices)
  if(!G.hwDisabled)G.hwDisabled=new Set();
  let html='';
  let idx=0;
  hw.forEach(t=>{
    const dis=G.hwDisabled.has(idx);
    html+=`<div class="cur-hw-item${dis?' disabled':''}" onclick="toggleHwDisabled(${idx})">
      <span class="cur-hw-text">${esc(t)}</span>
      <span class="cur-hw-toggle">${dis?'OFF':'ON'}</span>
    </div>`;idx++;
  });
  extra.forEach(t=>{
    const dis=G.hwDisabled.has(idx);
    html+=`<div class="cur-hw-item extra${dis?' disabled':''}" onclick="toggleHwDisabled(${idx})">
      <span class="cur-hw-badge">(추가)</span><span class="cur-hw-text">${esc(t)}</span>
      <span class="cur-hw-toggle">${dis?'OFF':'ON'}</span>
    </div>`;idx++;
  });
  prevIncomplete.forEach(t=>{
    const dis=G.hwDisabled.has(idx);
    html+=`<div class="cur-hw-item carry${dis?' disabled':''}" onclick="toggleHwDisabled(${idx})">
      <span class="cur-hw-badge">(전)</span><span class="cur-hw-text">${esc(t)}</span>
      <span class="cur-hw-toggle">${dis?'OFF':'ON'}</span>
    </div>`;idx++;
  });
  carry.forEach(t=>{
    const dis=G.hwDisabled.has(idx);
    html+=`<div class="cur-hw-item carry${dis?' disabled':''}" onclick="toggleHwDisabled(${idx})">
      <span class="cur-hw-badge">(전)</span><span class="cur-hw-text">${esc(t)}</span>
      <span class="cur-hw-toggle">${dis?'OFF':'ON'}</span>
    </div>`;idx++;
  });
  c.innerHTML=html;
}

// 이번 주차 과제 Enable/Disable 토글
function toggleHwDisabled(idx){
  if(!G.hwDisabled)G.hwDisabled=new Set();
  if(G.hwDisabled.has(idx))G.hwDisabled.delete(idx);
  else G.hwDisabled.add(idx);
  renderCurHwList();
  updateNoticeWithCarry();
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

// ─── 자동 채우기 (날짜 기준 공통) ───
function autoFillCommon(){
  const cur=getCurL();if(!cur)return;
  const prev=getPrevL(),next=getNextL();
  G.totalQ=cur.전체문제수||5;setAuto('inputTotal',G.totalQ);
  updateHeaderDate(cur.날짜,next?.날짜||'');
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
  fp('commentBody','inputComment');
  updateCommentSign();
  renderDateSummary();
}

// 엑셀 기호/숫자 → 내부 숫자 상태 변환 (excel.js의 stFromExcel과 동일)
function stFromExcel(v){
  if(v===2||v==='○'||v==='2'||v==='완료')return 2;
  if(v===1||v==='△'||v==='1'||v==='부분완료')return 1;
  if(v===0||v==='X'||v==='x'||v==='✗'||v==='×'||v==='✕'||v==='0'||v==='미완료')return 0;
  return -1;
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
  if(hadData){
    renderHwEditor();updateHwDisplay();
    renderExtraHwEditor();updateNoticeWithCarry();
    if(G.hwRateManual!==null){$$('inputRate').value=G.hwRateManual;$$('inputRate').classList.remove('auto');}
    else{
      setAuto('inputRate',G.rates[G.selStudent]?.[G.selDate]??'');
    }
    updateWrongTags($$('inputWrong').value);
  }else{
    $$('inputComment').value='';fp('commentBody','inputComment');
    $$('inputWrong').value=G.wrong[G.selStudent]?.[G.selDate]||'';
    updateWrongTags($$('inputWrong').value);
    // hwRec에 이미 items가 구성되어 있으면 그대로 사용 (parseWB에서 구축)
    const key=G.selDate?`${G.selStudent}||${G.selDate}`:null;
    const hwR=key?G.hwRec[key]:null;
    if(hwR&&hwR.items&&hwR.items.length){
      G.hwItems=hwR.items.map(it=>it.text);
      G.hwItemRefs=hwR.items.map(it=>({ref:it.ref||'',fromDate:it.fromDate||''}));
      G.hwStatus=hwR.items.map(it=>it.status??-1);
    }else{
      // hwRec에 items가 없으면 직접 구성
      const prev=getPrevL();
      let allItems=[];
      if(prev){
        const prevHwKeys=getLessonHwKeys(prev);
        prevHwKeys.forEach(k=>{
          const text=prev[k]||'';if(!text)return;
          allItems.push({text,ref:`${prev.id}-${k}`,fromDate:prev.날짜});
        });
      }
      const prevExtra=getPrevExtraHw(G.selStudent,G.selDate);
      const prev2=getPrevL();
      prevExtra.forEach((text,ei)=>{
        if(!text)return;
        allItems.push({text,ref:prev2?`${prev2.id}-추가과제${ei+1}`:'',fromDate:prev2?.날짜||''});
      });
      // 캐리오버 항목 (직전 날짜에서 미완료인 것)
      const carryItems=computeCarryover(G.selStudent,G.selDate);
      carryItems.forEach(c=>allItems.push({text:c.text,ref:c.ref,fromDate:c.fromDate}));
      G.hwItems=allItems.map(it=>it.text);
      G.hwItemRefs=allItems.map(it=>({ref:it.ref,fromDate:it.fromDate}));
      // 레거시 상태 로드
      G.hwStatus=allItems.map((_,i)=>{
        const st=hwR?.[`과제${i+1}_상태`];
        return st!=null?stFromExcel(st):-1;
      });
    }
    // 이번 날짜의 학생별 추가 과제 로드
    G.extraHw=(hwR?.extraHw||[]).map(it=>({...it}));
    setAuto('inputRate',G.rates[G.selStudent]?.[G.selDate]??'');G.hwRateManual=null;
    renderHwEditor();updateHwDisplay();
    renderExtraHwEditor();updateNoticeWithCarry();
  }
  const rv=$$('inputRate').value;
  const isFirst=G.lessons.length>0&&G.selDate===G.lessons[0].날짜;
  if(rv===''||isFirst){$$('secRate').style.display='none';}
  else if(Number(rv)===-1){$$('secRate').style.display='';$$('rRate').innerText='-';}
  else{$$('secRate').style.display='';$$('rRate').innerText=rv;}
  updateHwBadge();rebuildGraph();updateRateFace();
  updateCommentSign();
  applyReportEdits();
}
