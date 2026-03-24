// ─── 캐리오버 계산 ───
// 직전 날짜의 hwRec에서 미완료/부분완료 항목을 수집
function computeCarryover(student,date){
  const curIdx=G.lessons.findIndex(l=>l.날짜===date);
  if(curIdx<=0)return[];
  const prevDate=G.lessons[curIdx-1].날짜;
  const key=`${student}||${prevDate}`;
  const rec=G.hwRec[key];
  if(!rec)return[];
  // 신규 형식: items 배열이 있으면 사용
  if(rec.items&&rec.items.length){
    return rec.items
      .filter(it=>it.status==='미완료'||it.status==='부분완료')
      .map(it=>({
        text:it.text,
        fromDate:it.fromDate||prevDate
      }));
  }
  // 레거시 형식: 과제N_상태로 재구성
  if(curIdx<2)return[];
  const ppLesson=G.lessons[curIdx-2];
  const ppHwKeys=getLessonHwKeys(ppLesson);
  const result=[];
  ppHwKeys.forEach((k,i)=>{
    const text=ppLesson[k];if(!text)return;
    const status=stFromExcel(rec[`과제${i+1}_상태`]||'');
    if(status==='미완료'||status==='부분완료'){
      result.push({text,fromDate:ppLesson.날짜});
    }
  });
  return result;
}

// ─── 이번 주차 과제 + 추가과제 + 미완료 캐리 반영 (리포트카드) ───
function updateNoticeWithCarry(){
  const cur=getCurL();if(!cur)return;
  const hwKeys=getLessonHwKeys(cur);
  const baseHw=hwKeys.map(k=>cur[k]||'').filter(x=>x);
  // 학생별 추가 과제
  const extraHw=(G.extraHw||[]).map(it=>it.text).filter(x=>x);
  // 미완료 이월
  const unfinished=[];
  G.hwItems.forEach((text,i)=>{
    const st=G.hwStatus[i];
    if(st==='미완료'||st==='부분완료')unfinished.push(text);
  });
  const list=$$('rNoticeList');
  const baseHtml=baseHw.map(t=>`<div class="next-hw-li">${esc(t)}</div>`).join('');
  const extraHtml=extraHw.map(t=>`<div class="next-hw-li"><span class="carry-tag">(추가)</span>${esc(t)}</div>`).join('');
  const carryHtml=unfinished.map(t=>
    `<div class="next-hw-li"><span class="carry-tag">(전)</span>${esc(t)}</div>`
  ).join('');
  const allBase=baseHw.length+extraHw.length;
  const total=allBase+unfinished.length;
  if(total>3&&unfinished.length>0){
    list.className='next-hw-list compact';
    list.innerHTML=`<div class="hw-col"><div class="hw-col-label">본과제</div>${baseHtml}${extraHtml}</div>`
      +`<div class="hw-col"><div class="hw-col-label">미완료</div>${carryHtml}</div>`;
  }else{
    list.className='next-hw-list';
    list.innerHTML=baseHtml+extraHtml+carryHtml;
  }
  // 패널 이번 주차 과제 목록 갱신
  renderCurHwList();
}

// ─── 패널: 이번 주차 과제 목록 (읽기전용 레슨 과제) ───
function renderCurHwList(){
  const c=$$('curHwList');if(!c)return;
  const cur=getCurL();if(!cur){c.innerHTML='';return;}
  const hwKeys=getLessonHwKeys(cur);
  const hw=hwKeys.map(k=>cur[k]||'').filter(x=>x);
  c.innerHTML=hw.map(t=>`<div class="cur-hw-item">${esc(t)}</div>`).join('');
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

// 엑셀 기호/숫자 → UI 한글 상태 변환
function stFromExcel(v){
  if(v==='○'||v==='2')return'완료';
  if(v==='△'||v==='1')return'부분완료';
  if(v==='X'||v==='x'||v==='✗'||v==='×'||v==='✕'||v==='0')return'미완료';
  return v;
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
    // base 항목: 직전 레슨 과제 + 직전 날짜의 학생별 추가과제
    const prev=getPrevL();
    let baseItems=[];
    if(prev){
      const prevHwKeys=getLessonHwKeys(prev);
      baseItems=prevHwKeys.map(k=>prev[k]||'').filter(x=>x);
    }
    const prevExtra=getPrevExtraHw(G.selStudent,G.selDate);
    baseItems=[...baseItems,...prevExtra];
    // 캐리오버 항목
    const carryItems=computeCarryover(G.selStudent,G.selDate);
    // 병합 (base + carry)
    G.hwItems=[...baseItems,...carryItems.map(c=>c.text)];
    G.hwItemTypes=[
      ...baseItems.map(()=>({type:'base'})),
      ...carryItems.map(c=>({type:'carry',fromDate:c.fromDate}))
    ];
    // 상태 로드 — 인덱스 기반 매칭 (base), fromDate 기반 (carry)
    const key=G.selDate?`${G.selStudent}||${G.selDate}`:null;
    const hwR=key?G.hwRec[key]:null;
    if(hwR&&hwR.items&&hwR.items.length){
      const savedBase=hwR.items.filter(it=>it.type==='base');
      const savedCarry=hwR.items.filter(it=>it.type==='carry');
      let baseIdx=0,carryIdx=0;
      G.hwStatus=G.hwItems.map((_,i)=>{
        const typ=G.hwItemTypes[i];
        if(typ.type==='base'){
          const saved=savedBase[baseIdx++];
          return saved?saved.status:'';
        }else if(typ.type==='carry'){
          // carry: fromDate + 텍스트로 매칭 (이월 원본이 같은 것)
          const match=savedCarry.find(it=>it.fromDate===typ.fromDate&&it.text===G.hwItems[i]);
          if(match)carryIdx++;
          return match?match.status:'';
        }
        return'';
      });
    }else{
      // 레거시: base items만 과제N_상태 사용
      G.hwStatus=G.hwItems.map((_,i)=>{
        if(i<baseItems.length&&hwR)return stFromExcel(hwR[`과제${i+1}_상태`]||'');
        return'';
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
