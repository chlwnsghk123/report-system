// ─── 이행률 마스코트 (이미지 기반, 점수 티어별) ───
// img/mascots/high/ : 75% 이상 / mid/ : 30% 이상 ~ 75% 미만 / low/ : 30% 미만 (기준은 domain.js RATE_TIER)
const MASCOT_IMGS={high:[],mid:[],low:[]};
const MASCOT_DIR='img/mascots/';

/* 마스코트 이미지 등록 (init.js에서 호출) */
function registerMascots(tier,fileNames){
  MASCOT_IMGS[tier]=fileNames.map(f=>MASCOT_DIR+tier+'/'+f);
}

function updateRateFace(){
  const el=$$('rateMascot');if(!el)return;
  if(isAbsent(G.selStudent,G.selDate)){el.innerHTML='';el.style.display='none';return;}
  const rate=parseFloat($$('rRate')?.innerText);
  const tier=rateTier(rate)||'mid';
  const imgs=MASCOT_IMGS[tier];
  if(!imgs||!imgs.length){el.innerHTML='';el.style.display='none';return;}
  // 학생별 저장된 마스코트 확인 (선택한 경우에만 표시)
  // 현재 점수대(티어)에 설정이 없으면 다른 티어에 설정한 캐릭터(동일 idx)를 사용 →
  // 한 번 설정한 캐릭터가 모든 날짜(점수대)에 동일하게 표시됨.
  // (티어별 이미지는 같은 순서로 등록되어 idx가 곧 같은 캐릭터를 가리킴)
  const saved=G.mascotChoices[G.selStudent];
  let pick=null;
  if(saved){
    if(saved[tier]!=null&&saved[tier]<imgs.length)pick=saved[tier];
    else for(const t of ['high','mid','low']){if(saved[t]!=null&&saved[t]<imgs.length){pick=saved[t];break;}}
  }
  if(pick==null){el.innerHTML='';el.style.display='none';return;}
  el.style.display='';
  el.dataset.mascotIdx=pick;
  el.dataset.mascotTier=tier;
  const src=imgs[pick];
  if(!el.querySelector('img')||el.querySelector('img').getAttribute('src')!==src){
    el.innerHTML=`<img src="${src}" alt="mascot" draggable="false">`;
  }
  // 클릭 이벤트 (한 번만 등록)
  if(!el._mascotClick){
    el._mascotClick=true;
    el.title='클릭하여 캐릭터 변경';
    el.addEventListener('click',openMascotPicker);
  }
}

/* 마스코트 선택 팝업 열기 */
function openMascotPicker(e){
  e.stopPropagation();
  // 이미 열려 있으면 닫기
  const exist=document.querySelector('.mascot-picker-overlay');
  if(exist){exist.remove();return;}
  const el=$$('rateMascot');if(!el)return;
  const tier=el.dataset.mascotTier;
  const imgs=MASCOT_IMGS[tier];if(!imgs||!imgs.length)return;
  const curIdx=+el.dataset.mascotIdx;
  const overlay=document.createElement('div');
  overlay.className='mascot-picker-overlay';
  const picker=document.createElement('div');
  picker.className='mascot-picker';
  picker.innerHTML=`<div class="mascot-picker-header"><span class="mascot-picker-title">캐릭터 선택 (${imgs.length}개)</span><button class="mascot-picker-close">✕</button></div>`
    +`<div class="mascot-picker-grid">`
    +imgs.map((src,i)=>`<div class="mascot-pick-item${i===curIdx?' selected':''}" data-idx="${i}"><img src="${src}" draggable="false"></div>`).join('')
    +`</div>`;
  overlay.appendChild(picker);
  document.body.appendChild(overlay);
  function closePicker(){overlay.remove();document.removeEventListener('keydown',onEsc);}
  function onEsc(ev){if(ev.key==='Escape')closePicker();}
  picker.querySelector('.mascot-picker-close').addEventListener('click',closePicker);
  overlay.addEventListener('click',function(ev){if(ev.target===overlay)closePicker();});
  picker.querySelector('.mascot-picker-grid').addEventListener('click',function(ev){
    const item=ev.target.closest('.mascot-pick-item');if(!item)return;
    const idx=+item.dataset.idx;
    if(G.selStudent){G.mascotChoices[G.selStudent]=G.mascotChoices[G.selStudent]||{};G.mascotChoices[G.selStudent][tier]=idx;saveAppData();}
    updateRateFace();
    closePicker();
  });
  document.addEventListener('keydown',onEsc);
}

// ─── 이행률 그래프 (최근 4회) ───
function rebuildGraph(){
  if(!G.selDate||!G.selStudent)return;
  const firstDate=G.lessons[0]?.날짜;
  // 결석 날짜는 이행률 % 대신 그래프에 '결석'으로 표시 (이행률 유무와 무관하게 포함)
  let entries=G.lessons
    .filter(l=>l.날짜<=G.selDate&&l.날짜!==firstDate)
    .map(l=>({date:l.날짜,v:G.rates[G.selStudent]?.[l.날짜],absent:isAbsent(G.selStudent,l.날짜)}))
    .filter(e=>e.absent||(e.v!=null&&!isNaN(e.v)&&e.v!==-1));
  const cur=parseFloat($$('inputRate').value);
  const curAbsent=isAbsent(G.selStudent,G.selDate);
  if(G.selDate!==firstDate&&(curAbsent||(!isNaN(cur)&&cur!==-1))){
    const i=entries.findIndex(e=>e.date===G.selDate);
    const ent={date:G.selDate,v:isNaN(cur)?null:cur,absent:curAbsent};
    if(i>=0)entries[i]=ent;else entries.push(ent);
  }
  entries=entries.slice(-4);
  const svg=$$('svgChart');
  if(!entries.length){svg.innerHTML='';$$('gLabels').innerHTML='';updateRateFace();return;}
  const pts=entries.map((e,i)=>{
    let y;
    // 결석은 0%(바닥)와 헷갈리지 않도록 가운데 높이에 표시하고 선으로 잇지 않음
    if(e.absent){y=55;}
    else{y=88-(e.v/100)*62;if(y<22)y=22;if(y>88)y=88;}
    return{x:30+i*200,y,v:e.v,date:e.date,absent:e.absent};
  });
  // 꺾은선은 결석이 아닌(이행률 있는) 점들만 연결
  const linePts=pts.filter(p=>!p.absent);
  let html=linePts.length>1?`<polyline points="${linePts.map(p=>`${p.x},${p.y}`).join(' ')}" class="cl"/>`:'';
  pts.forEach((p,i)=>{const a=i===pts.length-1;
    if(p.absent){
      html+=`<circle cx="${p.x}" cy="${p.y}" class="cd absent ${a?'active':''}"/>
           <text x="${p.x}" y="${p.y-11}" class="clbl absent ${a?'':'past'}">결석</text>`;
    }else{
      html+=`<circle cx="${p.x}" cy="${p.y}" class="cd ${a?'active':''}"/>
           <text x="${p.x}" y="${p.y-11}" class="clbl ${a?'':'past'}">${p.v}%</text>`;
    }});
  svg.innerHTML=html;
  let lbl='';for(let i=0;i<4;i++){const a=i===entries.length-1;
    lbl+=`<span class="${a?'act':''}">${i<entries.length?shortD(entries[i].date):''}</span>`;}
  $$('gLabels').innerHTML=lbl;
  updateRateFace();
}

// ─── 과제 에디터 (좌패널: 지난 수업 과제 검사, base + carry) ───
function renderHwEditor(){
  const c=$$('hwEditor');
  const prevDate=getPrevL()?.날짜||'';
  const firstCarryIdx=G.hwItemRefs.findIndex(r=>isCarryItem(r?.fromDate));
  let html='',rendered=0;
  G.hwItems.forEach((item,i)=>{
    // 직전 주차에서 OFF한 과제는 체크목록에 노출하지 않음 (=숙제 없음)
    if(isHwOff(G.selStudent,prevDate,G.hwItemRefs[i]?.ref||''))return;
    const st=G.hwStatus[i]??-1;
    const fromDate=G.hwItemRefs[i]?.fromDate||'';
    const isCarry=isCarryItem(fromDate);
    if(i===firstCarryIdx)html+='<div class="hw-carry-divider">이월 과제</div>';
    const stCls=isNone(st)?'':'st'+st;
    html+=`<div class="hw-item${isCarry?' hw-carry':''} ${stCls}" data-i="${i}" onclick="cycleHwStatus(${i})">
      ${isCarry?`<span class="hw-carry-badge" title="${fromDate?fmtKo(fromDate):''}">(이월)</span>`:''}
      <input type="text" value="${esc(item)}" readonly style="cursor:pointer;opacity:.8;" tabindex="-1">
      <span class="hw-btn s${st}">${st===0&&isOptionalHw(item)?'✗ 안 함':hwBtnLabel(st)}</span>
    </div>`;
    rendered++;
  });
  if(!rendered)html='<div style="font-size:11px;color:#b5bac4;padding:4px 2px;">검사할 지난 수업 과제 없음</div>';
  c.innerHTML=html;
  // 상태 개수 요약 (이월 과제 제외 — 이행률 계산 기준과 동일)
  const cnt=hwStatusCounts(_rateStatuses());
  const cEl=$$('hwCounts');
  if(cEl)cEl.textContent=(cnt.done+cnt.partial+cnt.miss)?`완료 ${cnt.done} · 부분 ${cnt.partial} · 미완료 ${cnt.miss}`:'';
  updateHwDisplay();
}

// ─── 추가 과제 관리 (이번 주차 과제에 추가, G.extraHw 사용) ───
function addExtraHw(){
  const input=$$('extraHwInput');if(!input)return;
  const text=input.value.trim();if(!text)return;
  // 같은 학생의 같은 회차에 동일 텍스트 추가과제 중복 방지 (silent dedupe)
  // ref가 텍스트 기반이라 중복이 생기면 ref 충돌이 발생함
  if((G.extraHw||[]).some(it=>it.text===text)){input.value='';return;}
  G.extraHw.push({text});
  input.value='';
  renderExtraHwEditor();updateNoticeWithCarry();fitReportCard();
  syncHwRecItems(G.selStudent,G.selDate);saveAppData();
}
function removeExtraHw(idx){
  if(idx<0||idx>=G.extraHw.length)return;
  G.extraHw.splice(idx,1);
  renderExtraHwEditor();updateNoticeWithCarry();fitReportCard();
  syncHwRecItems(G.selStudent,G.selDate);saveAppData();
}
function updateExtraHwText(idx,val){
  if(idx<0||idx>=G.extraHw.length)return;
  G.extraHw[idx].text=val;
  updateNoticeWithCarry();
  syncHwRecItems(G.selStudent,G.selDate);saveAppData();
}

// ─── 이행률 ───
// 계산 대상 상태: 이월 과제·(선택) 과제·직전 회차에서 OFF한 과제 제외 (domain.js calcRate 규칙)
function _rateStatuses(){
  const prevDate=getPrevL()?.날짜||'';
  return G.hwStatus.filter((s,i)=>{
    const r=G.hwItemRefs[i];
    return!isCarryForDate(r?.fromDate,G.selDate)&&!isOptionalHw(G.hwItems[i])&&!isHwOff(G.selStudent,prevDate,r?.ref||'');
  });
}
// 이행률 값 적용 (manual=true: 선생님이 직접 입력한 값)
function applyRate(v,manual){
  const inp=$$('inputRate');
  inp.value=v==null?'':v;
  inp.classList.toggle('auto',!manual&&v!=null);
  G.hwRateManual=manual&&v!=null?Number(v):null;
  if(G.selStudent&&G.selDate){
    G.rates[G.selStudent]=G.rates[G.selStudent]||{};
    if(v!=null&&v!=='')G.rates[G.selStudent][G.selDate]=Number(v);
    else delete G.rates[G.selStudent][G.selDate];
  }
  refreshRateSection();rebuildGraph();
}
// ⚡ 자동계산 버튼 — 직접 입력한 값을 과제 상태 기준으로 되돌릴 때 사용
function autoCalcRate(){
  const rate=calcRate(_rateStatuses());
  if(rate==null){toast('상태가 지정된 과제가 없습니다');return;}
  applyRate(rate,false);
  syncHwRecItems(G.selStudent,G.selDate);saveAppData();
}
// 이행률 직접 입력 (0~100으로 보정)
function onRateManual(){
  const inp=$$('inputRate');let v=inp.value;
  if(v!==''){
    let n=Math.round(Number(v));
    if(isNaN(n))n=0;
    n=Math.max(0,Math.min(100,n));
    if(String(n)!==v)inp.value=n;
    v=n;
  }else v=null;
  applyRate(v,true);
  syncHwRecItems(G.selStudent,G.selDate);saveAppData();
}
// 리포트 이행률 영역 표시 (첫 수업·미입력은 숨김, 결석은 '결석')
function refreshRateSection(){
  const sec=$$('secRate');if(!sec)return;
  const v=$$('inputRate').value;
  const isFirst=G.lessons.length>0&&G.selDate===G.lessons[0].날짜;
  const absent=isAbsent(G.selStudent,G.selDate);
  sec.classList.toggle('absent',absent);
  const lbl=$$('rCurLbl');if(lbl)lbl.textContent=absent?'빠진 수업 내용':'오늘 배운 내용';
  if(isFirst){sec.style.display='none';}
  else if(absent){sec.style.display='';$$('rRate').innerText='이번 수업 결석';}
  else if(v===''){sec.style.display='none';}
  else if(Number(v)===-1){sec.style.display='';$$('rRate').innerText='-';}
  else{sec.style.display='';$$('rRate').innerText=v;}
}

// ─── 과제 순환 버튼 ───
const hwBtnLabel=s=>({2:'✓ 완료',1:'△ 부분완료',0:'✗ 미완료'}[s]||'— 없음');
function cycleHwStatus(i){
  const order=[-1,2,1,0];
  const cur=G.hwStatus[i]??-1;
  const next=order[(order.indexOf(cur)+1)%order.length];
  const before=_rateStatuses();
  G.hwStatus[i]=next;
  _queueCarry(i,next);
  _afterHwStatusChange(before);
}
// 상태가 비어 있는 과제를 모두 '완료'로 (이월 과제는 개별 확인)
function markAllHwDone(){
  const prevDate=getPrevL()?.날짜||'';
  const before=_rateStatuses();
  let changed=0;
  G.hwItems.forEach((_,i)=>{
    const r=G.hwItemRefs[i];
    if(isHwOff(G.selStudent,prevDate,r?.ref||'')||isCarryItem(r?.fromDate)||isOptionalHw(G.hwItems[i]))return;
    if(isNone(G.hwStatus[i])){G.hwStatus[i]=2;_queueCarry(i,2);changed++;}
  });
  if(!changed){toast('상태가 비어 있는 과제가 없습니다');return;}
  _afterHwStatusChange(before);
}
// 이월 전파 예약 (학생·날짜 전환 시 일괄 적용)
function _queueCarry(i,status){
  const ref=G.hwItemRefs[i]?.ref;if(!ref)return;
  const exists=G.pendingPropagations.findIndex(p=>p.ref===ref&&p.student===G.selStudent&&p.date===G.selDate);
  if(exists>=0)G.pendingPropagations[exists].status=status;
  else G.pendingPropagations.push({student:G.selStudent,date:G.selDate,ref,status});
}
// before: 변경 전 이행률 계산 대상 상태 배열
function _afterHwStatusChange(before){
  // 이월/저번주차 과제 상태에 따라 이번주차 과제 ON/OFF 자동 동기화
  autoSyncHwDisabled();
  renderHwEditor();
  // 이행률 계산 대상(이월·선택·OFF 제외) 과제의 상태가 실제로 바뀐 경우에만 다시 계산 —
  // 이월·선택 과제만 눌렀을 때 직접 입력한 이행률이 바뀌거나 지워지지 않도록
  const after=_rateStatuses();
  if(JSON.stringify(after)!==JSON.stringify(before)){
    const rate=calcRate(after);
    if(rate!=null)applyRate(rate,false);
    else if(calcRate(before)!=null&&G.hwRateManual==null)applyRate(null,false); // 검사한 과제를 모두 되돌리면 자동값도 비움
    else rebuildGraph();
  }else rebuildGraph();
  updateNoticeWithCarry();fitReportCard();
  syncHwRecItems(G.selStudent,G.selDate);
  saveAppData();
}

// ─── 리포트 UI 업데이트 ───
function updateHeaderDate(curDate,nextDate){
  if(!curDate)return;
  $$('rDate').textContent=fmtKo(curDate);
  const prev=getPrevL();
  $$('rCurDt').textContent=`(${shortD(curDate)})`;
  $$('rPrevDt').textContent=prev?`(${shortD(prev.날짜)})`:'';
  const pHw=$$('rPrevHwDate');if(pHw)pHw.textContent=prev?`(~${shortD(curDate)})`:'';
  const nHw=$$('rNextHwDate');if(nHw)nHw.textContent=nextDate?`(~${shortD(nextDate)})`:'';
}

// ─── 지난 수업 과제 표시 (2열 레이아웃 지원) ───
function updateHwDisplay(){
  const list=$$('rHwList'),sec=$$('secPrevHw');
  const prevDate=getPrevL()?.날짜||'';
  const offHidden=i=>isHwOff(G.selStudent,prevDate,G.hwItemRefs[i]?.ref||'');
  const stName={2:'완료',1:'부분완료',0:'미완료'};
  const visible=G.hwItems.filter((_,i)=>!isNone(G.hwStatus[i])&&!offHidden(i));
  if(!G.hwItems.length||!visible.length){if(sec)sec.style.display='none';list.innerHTML='';return;}
  if(sec)sec.style.display='';
  const icons={2:'✓',1:'△',0:'✗'};
  const baseHtml=[],carryHtml=[];
  G.hwItems.forEach((item,i)=>{
    if(!item.trim()||isNone(G.hwStatus[i])||offHidden(i))return;
    const st=G.hwStatus[i]??0;
    const isCarry=isCarryItem(G.hwItemRefs[i]?.fromDate);
    const li=`<div class="hw-li s${st}">
      <span class="hw-icon">${icons[st]||'?'}</span>
      ${isCarry?'<span class="hw-carry-mark">(이월)</span>':''}
      <span class="hw-text">${esc(item.trim())}</span>
      <span class="hw-chip">${st===0&&isOptionalHw(item)?'안 함':(stName[st]||'')}</span>
    </div>`;
    if(isCarry)carryHtml.push(li);
    else baseHtml.push(li); // extra도 일반 과제와 동일 취급
  });
  const total=baseHtml.length+carryHtml.length;
  if(total>3&&carryHtml.length>0){
    list.className='hw-list compact';
    list.innerHTML=`<div class="hw-col"><div class="hw-col-label">본과제</div>${baseHtml.join('')}</div>`
      +`<div class="hw-col"><div class="hw-col-label">이월과제</div>${carryHtml.join('')}</div>`;
  }else{
    list.className='hw-list';
    list.innerHTML=baseHtml.join('')+carryHtml.join('');
  }
}
function updateNoticeList(text){
  const list=$$('rNoticeList');if(!text||!text.trim()){list.innerHTML='';return;}
  list.innerHTML=text.split('\n').filter(l=>l.trim()).map(l=>`<div class="next-hw-li">${esc(l.trim())}</div>`).join('');
}

// ─── 미니 테스트 (패널 입력 + 리포트 표시) ───
// 문항 수·범위는 날짜별(반 공통), 오답·맞힌 수는 학생별
function renderMiniPanel(){
  const t=G.miniTest[G.selDate]||{};
  const tot=$$('miniTotal'),rng=$$('miniRange'),cor=$$('miniCorrect');
  if(tot)tot.value=t.total||'';
  if(rng)rng.value=t.range||'';
  if(cor){
    const ov=G.miniScore[`${G.selStudent}||${G.selDate}`];
    cor.value=ov!=null?ov:'';
    const r=miniResult(G.selStudent,G.selDate);
    cor.placeholder=r&&r.total!=null&&ov==null?`자동 ${Math.max(0,r.total-r.wrong.length)}`:'맞힌 수';
  }
}
function onMiniInput(){
  if(!G.selDate)return;
  const total=parseInt($$('miniTotal').value),range=$$('miniRange').value.trim();
  if(total>0||range)G.miniTest[G.selDate]={total:total>0?total:null,range};
  else delete G.miniTest[G.selDate];
  const key=`${G.selStudent}||${G.selDate}`,cv=$$('miniCorrect').value.trim();
  if(G.selStudent&&cv!==''&&!isNaN(cv)){
    let n=Math.max(0,parseInt(cv));
    if(total>0&&n>total){n=total;toast(`맞힌 수는 문항 수(${total})를 넘을 수 없습니다`);}
    G.miniScore[key]=n;
  }else delete G.miniScore[key];
  renderMiniPanel();updateMiniSection();fitReportCard();saveAppData();
}
// 오답 번호 입력 — 입력 즉시 G.wrong에 저장 (수업설정을 열고 닫아도 유실되지 않도록)
function onWrongInput(val){
  if(!G.selStudent||!G.selDate)return;
  const v=String(val||'').trim();
  if(v){G.wrong[G.selStudent]=G.wrong[G.selStudent]||{};G.wrong[G.selStudent][G.selDate]=v;}
  else if(G.wrong[G.selStudent])delete G.wrong[G.selStudent][G.selDate];
  renderMiniPanel();updateMiniSection();fitReportCard();saveAppData();
}
function updateMiniSection(){
  const sec=$$('secMini');if(!sec)return;
  const r=G.showMini?miniResult(G.selStudent,G.selDate):null;
  // 시험 기록이 없는 학생·날짜는 빈 칸을 보이지 않도록 섹션을 숨김
  if(!r){sec.style.display='none';return;}
  sec.style.display='';
  const num=t=>/^\d+$/.test(t)?t+'번':t;
  const score=$$('rMiniScore');
  if(score){
    score.innerHTML=r.total!=null&&r.correct!=null
      ?`<span class="mini-score-num">${r.correct}<span class="mini-score-total">/${r.total}</span></span>`
        +`<span class="mini-score-pct">${r.perfect?'만점':r.pct+'%'}</span>`
      :'';
    score.style.display=score.innerHTML?'':'none';
  }
  const rng=$$('rMiniRange');
  if(rng){rng.textContent=r.range?`범위: ${r.range}`:'';rng.style.display=r.range?'':'none';}
  const row=$$('rMiniWrongRow');
  if(row)row.style.display=r.wrong.length?'':'none';
  $$('rWrongTags').innerHTML=r.wrong.map(t=>`<span class="wtag">${esc(num(t))}</span>`).join('');
}

// ─── 선생님 한마디 (수업 일지표 코멘트와 같은 데이터 G.journalNote 사용) ───
function renderCommentPanel(){
  const c=$$('inputComment'),t=$$('inputTeacher');
  if(c)c.value=G.journalNote[`${G.selStudent}||${G.selDate}`]||'';
  if(t)t.value=G.teacherName||'';
}
function onCommentInput(){
  if(!G.selStudent||!G.selDate)return;
  const key=`${G.selStudent}||${G.selDate}`,v=$$('inputComment').value.replace(/\r/g,'').trim();
  if(v)G.journalNote[key]=v;else delete G.journalNote[key];
  updateCommentSection();fitReportCard();saveAppData();
}
function onTeacherInput(){
  G.teacherName=$$('inputTeacher').value.trim();
  updateCommentSection();saveAppData();
}
function updateCommentSection(){
  const sec=$$('secComment');if(!sec)return;
  const note=G.showComment?(G.journalNote[`${G.selStudent}||${G.selDate}`]||''):'';
  if(!note){sec.style.display='none';return;}
  sec.style.display='';
  $$('commentBody').innerText=note;
  $$('commentSign').innerText=G.teacherName?`From. ${G.teacherName} T`:'';
}

// ─── A4 한 장 맞춤 ───
// 리포트카드는 A4 고정 크기(넘치면 잘림) — 내용이 넘치면 간격을 줄이고, 그래도 넘치면 목록을 2단으로
function fitReportCard(){
  const rc=$$('reportCard');if(!rc)return;
  rc.classList.remove('dense','dense2');
  if(rc.scrollHeight>rc.clientHeight+1)rc.classList.add('dense');
  if(rc.scrollHeight>rc.clientHeight+1)rc.classList.add('dense2');
}

// ─── 출결 토글 ───
function setAttend(val){
  if(!G.selStudent||!G.selDate)return;
  G.attend[G.selStudent]=G.attend[G.selStudent]||{};
  // 같은 버튼 재클릭 → 선택 해제(미선택). -1(제외)로 저장하면 리포트·요약에서 빠지므로 키 자체를 지움
  const cur=G.attend[G.selStudent][G.selDate];
  if(cur===val)delete G.attend[G.selStudent][G.selDate];
  else G.attend[G.selStudent][G.selDate]=val;
  updateAttendUI();
  refreshRateSection();rebuildGraph();updateMiniSection(); // 결석 여부가 리포트에 바로 반영되도록
  saveAppData();
}
// 결석이 아닌 학생 전원의 '검사 안 한' 과제를 완료로 (예외 학생만 찾아가 △/✗ 수정)
// 이월·(선택)·OFF 과제는 건드리지 않고, 과제 상태가 바뀐 학생은 이행률을 다시 계산
function markAllStudentsHwDone(){
  const date=G.selDate;if(!date||!G.students.length)return;
  const idx=G.lessons.findIndex(l=>l.날짜===date);
  const prevDate=idx>0?G.lessons[idx-1].날짜:'';
  if(!prevDate){toast('첫 수업에는 검사할 지난 과제가 없습니다');return;}
  const targets=G.students.filter(s=>!isAbsent(s,date));
  if(G.selStudent)saveTabData();
  if(targets.some(s=>!G.hwRec[`${s}||${date}`]?.items))rebuildAllHwItems(); // 로드 후 추가한 학생의 과제 기록 생성
  if(!confirm(`결석하지 않은 학생 ${targets.length}명의 '검사 안 한' 과제를 모두 완료로 표시할까요?\n(이월·선택 과제는 제외, 이후 예외 학생만 고치면 됩니다)`))return;
  let n=0;
  targets.forEach(s=>{
    const rec=G.hwRec[`${s}||${date}`];if(!rec?.items)return;
    let changed=false;
    rec.items.forEach((it,i)=>{
      if(isCarryForDate(it.fromDate,date)||isOptionalHw(it.text)||isHwOff(s,prevDate,it.ref))return;
      if(isNone(it.status)){it.status=2;rec[`과제${i+1}_상태`]=2;changed=true;}
    });
    if(!changed)return;
    n++;
    const rate=calcRate(rec.items.filter(it=>!isCarryForDate(it.fromDate,date)&&!isOptionalHw(it.text)&&!isHwOff(s,prevDate,it.ref)).map(it=>it.status));
    if(rate!=null){G.rates[s]=G.rates[s]||{};G.rates[s][date]=rate;rec.이행률=rate;}
  });
  G.tabData={};
  if(G.selStudent)autoFillAll();
  if(n)saveAppData();
  toast(n?`${n}명의 과제를 완료로 표시했습니다`:'검사 안 한 과제가 없습니다');
}
// 일괄 출력 전 빠진 입력 점검 — 있으면 목록을 보여주고 계속할지 묻기
function confirmMissingInputs(date){
  const idx=G.lessons.findIndex(l=>l.날짜===date);
  const prevDate=idx>0?G.lessons[idx-1].날짜:'';
  if(G.selStudent&&G.selDate===date)saveTabData();
  if(prevDate&&G.students.some(s=>!G.hwRec[`${s}||${date}`]?.items))rebuildAllHwItems();
  const names=arr=>arr.length>4?arr.slice(0,4).join(', ')+` 외 ${arr.length-4}명`:arr.join(', ');
  const lines=[];
  const unset=G.students.filter(s=>attOf(s,date)==null);
  if(unset.length)lines.push(`• 출결 미체크 ${unset.length}명: ${names(unset)}`);
  const present=G.students.filter(s=>!isAbsent(s,date));
  if(prevDate){
    const noCheck=present.filter(s=>{
      const its=(G.hwRec[`${s}||${date}`]?.items||[]).filter(it=>!isCarryForDate(it.fromDate,date)&&!isOptionalHw(it.text)&&!isHwOff(s,prevDate,it.ref));
      return its.length&&its.every(it=>isNone(it.status));
    });
    if(noCheck.length)lines.push(`• 숙제 검사 안 함 ${noCheck.length}명: ${names(noCheck)}`);
  }
  if(G.showMini&&(G.miniTest[date]?.total>0)){
    const noMini=present.filter(s=>!miniResult(s,date));
    if(noMini.length)lines.push(`• 미니테스트 미입력 ${noMini.length}명: ${names(noMini)} (다 맞았으면 오답칸에 0)`);
  }
  if(G.showComment){
    const noNote=present.filter(s=>!G.journalNote[`${s}||${date}`]);
    if(noNote.length)lines.push(`• 선생님 한마디 없음 ${noNote.length}명: ${names(noNote)}`);
  }
  if(!lines.length)return true;
  return confirm(`${fmtKo(date)} — 확인해 주세요:\n\n${lines.join('\n')}\n\n그대로 만들까요?`);
}

// 출결 미체크 학생을 한 번에 '출석'으로 (결석·지각만 따로 누르면 됨)
function markAllPresent(){
  if(!G.selDate||!G.students.length)return;
  let n=0;
  G.students.forEach(s=>{
    if(attOf(s,G.selDate)!=null)return;
    G.attend[s]=G.attend[s]||{};G.attend[s][G.selDate]=2;n++;
  });
  updateAttendUI();refreshRateSection();rebuildGraph();
  if(n)saveAppData();
  toast(n?`미체크 ${n}명을 출석으로 표시했습니다`:'모든 학생의 출결이 이미 체크되어 있습니다');
}
function updateAttendUI(){
  const wrap=$$('attendToggle');if(!wrap)return;
  const bar=$$('attendBar');
  if(!G.selStudent||!G.selDate||!G.lessons.length){
    if(bar)bar.style.display='none';return;
  }
  if(bar)bar.style.display='flex';
  // 실제로 선택한 값만 표시 — 미선택은 아무 버튼도 활성화하지 않음
  const val=attOf(G.selStudent,G.selDate);
  wrap.querySelectorAll('.att-btn').forEach(btn=>{
    btn.classList.toggle('active',parseInt(btn.dataset.att)===val);
  });
  // 오늘 날짜 출결 미체크 인원 표시
  const cnt=$$('attendUnset');
  if(cnt){
    const unset=G.students.filter(s=>attOf(s,G.selDate)==null).length;
    cnt.textContent=unset?`미체크 ${unset}명`:'';
  }
}
