// ─── 점수 계산 ───
function calcScore(){
  const c=Number($$('inputCorrect').value),t=Number($$('inputTotal').value)||G.totalQ||5;
  if($$('inputCorrect').value===''){
    $$('calcResult').textContent='—';G.scoreCalc=null;
    $$('rCorrect').innerText='—';$$('rTotal').innerText='—';return;
  }
  const sc=Math.min(50,20+Math.ceil((Math.min(c,t)/t)*30));
  $$('calcResult').textContent=`${c} / ${t}`;G.scoreCalc=sc;
  $$('rCorrect').innerText=c;$$('rTotal').innerText=t;
}

// ─── 자동 채우기 (날짜 기준 공통) ───
function autoFillCommon(){
  const cur=getCurL();if(!cur)return;
  const prev=getPrevL(),next=getNextL();
  G.totalQ=cur.전체문제수||5;setAuto('inputTotal',G.totalQ);
  updateHeaderDate(cur.날짜,next?.날짜||'');
  setAuto('inCurBook',cur.교재);fp('rCurBook','inCurBook');
  setAuto('inCurChap',cur.단원);fp('rCurChap','inCurChap');
  setAuto('inCurDetail',cur.상세진도);fp('rCurDetail','inCurDetail');
  setAuto('inPrevBook',prev?.교재||'');fp('rPrevBook','inPrevBook');
  setAuto('inPrevChap',prev?.단원||'');fp('rPrevChap','inPrevChap');
  setAuto('inPrevDetail',prev?.상세진도||'');fp('rPrevDetail','inPrevDetail');
  const hwT=[1,2,3,4,5].map(i=>cur[`과제${i}`]||'').filter(x=>x);
  setAuto('inputNotice',hwT.join('\n'));updateNoticeList(hwT.join('\n'));
  const sign=cur.강사명||'';setAuto('inputTeacher',sign);
  fp('commentBody','inputComment');
  updateCurProgSummary();updateNextHwSummary();updateCommentSign();
}

// 엑셀 기호 → UI 한글 상태 변환 (○/△/X → 완료/부분완료/미완료)
function stFromExcel(v){
  if(v==='○')return'완료';
  if(v==='△')return'부분완료';
  if(v==='X'||v==='x'||v==='✗'||v==='×'||v==='✕')return'미완료';
  return v; // '완료'/'부분완료'/'미완료'(재저장 후 재로드) 또는 '' 그대로
}

// ─── 자동 채우기 (학생+날짜 기준 전체) ───
function autoFillAll(){
  autoFillCommon();$$('rName').innerText=G.selStudent;
  const hadData=restoreTabData(G.selStudent);
  if(hadData){
    renderHwEditor();updateHwDisplay();
    if(G.hwRateManual!==null){$$('inputRate').value=G.hwRateManual;$$('inputRate').classList.remove('auto');}
    else{
      setAuto('inputRate',G.rates[G.selStudent]?.[G.selDate]??'');
    }
    calcScore();updateWrongTags($$('inputWrong').value);
  }else{
    // 학생 전환 시 이전 값 잔류 방지 — 항상 초기화 후 새 값 설정
    $$('inputCorrect').value='';$$('inputCorrect').classList.remove('auto');
    $$('inputComment').value='';fp('commentBody','inputComment');
    const sc=G.scores[G.selStudent]?.[G.selDate],ct=G.corrects[G.selStudent]?.[G.selDate];
    if(ct!==undefined){$$('inputCorrect').value=ct;$$('inputCorrect').classList.add('auto');}
    if(sc!==undefined){G.scoreCalc=sc;$$('calcResult').textContent=ct!==undefined?`${ct} / ${G.totalQ}`:'—';}
    if(ct!==undefined){$$('rCorrect').innerText=ct;$$('rTotal').innerText=G.totalQ;}
    $$('inputWrong').value=G.wrong[G.selStudent]?.[G.selDate]||'';
    updateWrongTags($$('inputWrong').value);calcScore();
    const prev=getPrevL();
    G.hwItems=prev?[1,2,3,4,5].map(i=>prev[`과제${i}`]||'').filter(x=>x):[];
    const key=G.selDate?`${G.selStudent}||${G.selDate}`:null,hwR=key?G.hwRec[key]:null;
    G.hwStatus=G.hwItems.map((_,i)=>hwR?stFromExcel(hwR[`과제${i+1}_상태`]||''):'');
    setAuto('inputRate',G.rates[G.selStudent]?.[G.selDate]??'');G.hwRateManual=null;
    renderHwEditor();updateHwDisplay();
  }
  const rv=$$('inputRate').value;
  const isFirst=G.lessons.length>0&&G.selDate===G.lessons[0].날짜;
  if(rv===''||isFirst){$$('secRate').style.display='none';}
  else if(Number(rv)===-1){$$('secRate').style.display='';$$('rRate').innerText='-';}
  else{$$('secRate').style.display='';$$('rRate').innerText=rv;}
  updateHwBadge();rebuildGraph();
  updateCommentSign();
}
