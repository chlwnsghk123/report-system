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
  // 진도 → hidden inputs → 리포트카드
  $$('inCurBook').value=cur.교재;fp('rCurBook','inCurBook');
  $$('inCurChap').value=cur.단원;fp('rCurChap','inCurChap');
  $$('inCurDetail').value=cur.상세진도;fp('rCurDetail','inCurDetail');
  $$('inPrevBook').value=prev?.교재||'';fp('rPrevBook','inPrevBook');
  $$('inPrevChap').value=prev?.단원||'';fp('rPrevChap','inPrevChap');
  $$('inPrevDetail').value=prev?.상세진도||'';fp('rPrevDetail','inPrevDetail');
  // 이번 주차 과제 (동적 개수)
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
    $$('inputCorrect').value='';$$('inputCorrect').classList.remove('auto');
    $$('inputComment').value='';fp('commentBody','inputComment');
    const sc=G.scores[G.selStudent]?.[G.selDate],ct=G.corrects[G.selStudent]?.[G.selDate];
    if(ct!==undefined){$$('inputCorrect').value=ct;$$('inputCorrect').classList.add('auto');}
    if(sc!==undefined){G.scoreCalc=sc;$$('calcResult').textContent=ct!==undefined?`${ct} / ${G.totalQ}`:'—';}
    if(ct!==undefined){$$('rCorrect').innerText=ct;$$('rTotal').innerText=G.totalQ;}
    $$('inputWrong').value=G.wrong[G.selStudent]?.[G.selDate]||'';
    updateWrongTags($$('inputWrong').value);calcScore();
    const prev=getPrevL();
    if(prev){
      const prevHwKeys=getLessonHwKeys(prev);
      G.hwItems=prevHwKeys.map(k=>prev[k]||'').filter(x=>x);
    }else{G.hwItems=[];}
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
