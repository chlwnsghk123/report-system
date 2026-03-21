// ─── 이행률 마스코트 (랜덤 캐릭터) ───
const MASCOTS=[
  // 고양이
  `<svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M25 30 L30 5 L45 25 Z" fill="#222"/>
    <path d="M75 30 L70 5 L55 25 Z" fill="#222"/>
    <ellipse cx="50" cy="45" rx="28" ry="25" fill="#222"/>
    <ellipse cx="50" cy="85" rx="24" ry="30" fill="#222"/>
    <ellipse cx="50" cy="90" rx="16" ry="22" fill="#fff"/>
    <ellipse cx="42" cy="42" rx="5" ry="6" fill="#fff"/>
    <ellipse cx="58" cy="42" rx="5" ry="6" fill="#fff"/>
    <circle cx="42" cy="43" r="2.5" fill="#222"/>
    <circle cx="58" cy="43" r="2.5" fill="#222"/>
    <path d="M48 50 L50 52 L52 50" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <line x1="20" y1="42" x2="35" y2="44" stroke="#222" stroke-width="1" stroke-linecap="round"/>
    <line x1="20" y1="48" x2="35" y2="47" stroke="#222" stroke-width="1" stroke-linecap="round"/>
    <line x1="80" y1="42" x2="65" y2="44" stroke="#222" stroke-width="1" stroke-linecap="round"/>
    <line x1="80" y1="48" x2="65" y2="47" stroke="#222" stroke-width="1" stroke-linecap="round"/>
    <path d="M74 75 Q85 65 80 55" stroke="#222" stroke-width="5" fill="none" stroke-linecap="round"/>
  </svg>`,
  // 강아지
  `<svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="50" rx="30" ry="28" fill="#222"/>
    <ellipse cx="50" cy="88" rx="22" ry="26" fill="#222"/>
    <ellipse cx="50" cy="92" rx="14" ry="18" fill="#fff"/>
    <path d="M22 35 Q10 20 18 45" fill="#222" stroke="#222" stroke-width="2"/>
    <path d="M78 35 Q90 20 82 45" fill="#222" stroke="#222" stroke-width="2"/>
    <ellipse cx="42" cy="46" rx="5" ry="5.5" fill="#fff"/>
    <ellipse cx="58" cy="46" rx="5" ry="5.5" fill="#fff"/>
    <circle cx="42" cy="47" r="2.5" fill="#222"/>
    <circle cx="58" cy="47" r="2.5" fill="#222"/>
    <ellipse cx="50" cy="55" rx="4" ry="3" fill="#555"/>
    <path d="M46 58 Q50 62 54 58" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M75 78 Q88 72 82 62" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`,
  // 토끼
  `<svg viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M38 40 Q36 5 42 5 Q48 5 44 40" fill="#222"/>
    <path d="M40 38 Q38 12 42 12 Q46 12 43 38" fill="#fff"/>
    <path d="M56 40 Q54 5 58 5 Q64 5 62 40" fill="#222"/>
    <path d="M58 38 Q56 12 58 12 Q62 12 60 38" fill="#fff"/>
    <ellipse cx="50" cy="55" rx="26" ry="24" fill="#222"/>
    <ellipse cx="50" cy="95" rx="22" ry="28" fill="#222"/>
    <ellipse cx="50" cy="98" rx="14" ry="20" fill="#fff"/>
    <ellipse cx="42" cy="52" rx="4.5" ry="5" fill="#fff"/>
    <ellipse cx="58" cy="52" rx="4.5" ry="5" fill="#fff"/>
    <circle cx="42" cy="53" r="2.5" fill="#222"/>
    <circle cx="58" cy="53" r="2.5" fill="#222"/>
    <path d="M48 60 L50 62 L52 60" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <circle cx="38" cy="60" r="4" fill="#ddd" opacity="0.5"/>
    <circle cx="62" cy="60" r="4" fill="#ddd" opacity="0.5"/>
  </svg>`
];
function updateRateFace(){
  const el=$$('rateMascot');if(!el)return;
  if(!el.dataset.idx){el.dataset.idx=Math.floor(Math.random()*MASCOTS.length);}
  el.innerHTML=MASCOTS[+el.dataset.idx];
}

// ─── 이행률 그래프 ───
function rebuildGraph(){
  if(!G.selDate||!G.selStudent)return;
  const firstDate=G.lessons[0]?.날짜;
  let entries=G.lessons
    .filter(l=>l.날짜<=G.selDate)
    .map(l=>({date:l.날짜,v:G.rates[G.selStudent]?.[l.날짜]}))
    .filter(e=>e.v!=null&&!isNaN(e.v)&&e.v!==-1&&e.date!==firstDate);
  const cur=parseFloat($$('inputRate').value);
  if(!isNaN(cur)&&cur!==-1&&G.selDate!==firstDate){
    const i=entries.findIndex(e=>e.date===G.selDate);
    if(i>=0)entries[i].v=cur;else entries.push({date:G.selDate,v:cur});
  }
  entries=entries.slice(-4);
  const svg=$$('svgChart');
  if(!entries.length){svg.innerHTML='';$$('gLabels').innerHTML='';return;}
  const pts=entries.map((e,i)=>{let y=88-(e.v/100)*72;if(y<10)y=10;if(y>88)y=88;return{x:30+i*200,y,v:e.v,date:e.date};});
  let html=pts.length>1?`<polyline points="${pts.map(p=>`${p.x},${p.y}`).join(' ')}" class="cl"/>`:'';
  pts.forEach((p,i)=>{const a=i===pts.length-1;
    html+=`<circle cx="${p.x}" cy="${p.y}" class="cd ${a?'active':''}"/>
           <text x="${p.x}" y="${p.y-11}" class="clbl ${a?'':'past'}">${p.v}%</text>`;});
  svg.innerHTML=html;
  let lbl='';for(let i=0;i<4;i++){const a=i===entries.length-1;
    lbl+=`<span class="${a?'act':''}">${i<entries.length?shortD(entries[i].date):''}</span>`;}
  $$('gLabels').innerHTML=lbl;
  updateRateFace();
}

// ─── 과제 에디터 (좌패널: 텍스트 readonly, 상태 버튼만 조작) ───
function renderHwEditor(){
  const c=$$('hwEditor');
  if(!G.hwItems.length){c.innerHTML='<div style="font-size:11px;color:#b5bac4;padding:4px 2px;">이전 주차 과제 없음</div>';updateHwDisplay();return;}
  const firstCarryIdx=G.hwItemTypes.findIndex(t=>t.type==='carry');
  let html='';
  G.hwItems.forEach((item,i)=>{
    const st=G.hwStatus[i]||'';
    const isCarry=G.hwItemTypes[i]?.type==='carry';
    const fromDate=G.hwItemTypes[i]?.fromDate||'';
    if(i===firstCarryIdx){
      html+='<div class="hw-carry-divider">이월 과제</div>';
    }
    html+=`<div class="hw-item${isCarry?' hw-carry':''}">
      ${isCarry?`<span class="hw-carry-badge" title="${fromDate?fmtKo(fromDate):''}">(전)</span>`:''}
      <input type="text" class="${isCarry?'auto':''}" value="${esc(item)}" readonly
        style="cursor:default;opacity:.8;">
      <button class="hw-btn s${st}" onclick="cycleHwStatus(${i})">${hwBtnLabel(st)}</button>
    </div>`;
  });
  c.innerHTML=html;
}
function onRateManual(){
  const v=$$('inputRate').value;G.hwRateManual=v!==''?Number(v):null;
  $$('inputRate').classList.remove('auto');
  const isFirst=G.lessons.length>0&&G.selDate===G.lessons[0].날짜;
  if(v===''||isFirst){$$('secRate').style.display='none';}
  else if(Number(v)===-1){$$('secRate').style.display='';$$('rRate').innerText='-';}
  else{$$('secRate').style.display='';$$('rRate').innerText=v;}
  if(G.selStudent&&G.selDate){
    G.rates[G.selStudent]=G.rates[G.selStudent]||{};
    if(v!=='')G.rates[G.selStudent][G.selDate]=Number(v);
    else delete G.rates[G.selStudent][G.selDate];
  }
  updateHwBadge();rebuildGraph();updateRateFace();
}

// ─── 과제 순환 버튼 ───
const hwBtnLabel=s=>({'완료':'✓ 완료','부분완료':'◑ 부분완료','미완료':'✗ 미완료'}[s]||'— 없음');
function cycleHwStatus(i){
  const order=['','완료','부분완료','미완료'];
  const next=order[(order.indexOf(G.hwStatus[i])+1)%order.length];
  G.hwStatus[i]=next;
  const btns=document.querySelectorAll('.hw-btn');
  if(btns[i]){btns[i].className='hw-btn s'+next;btns[i].textContent=hwBtnLabel(next);}
  // 좌패널에서 변경 → 리포트 override 제거
  delete G.reportEdits.rHwList;
  delete G.reportEdits.rNoticeList;
  updateHwDisplay();updateHwBadge();rebuildGraph();
  updateNoticeWithCarry();
  syncHwRecItems(G.selStudent,G.selDate);
  saveAppData();saveSession();
}

// ─── 리포트 UI 업데이트 ───
function updateHeaderDate(curDate,nextDate){
  if(!curDate)return;
  const[y,m,d]=curDate.split('-'),days=['일','월','화','수','목','금','토'];
  $$('rDate').textContent=`${y}년 ${+m}월 ${+d}일 (${days[new Date(+y,+m-1,+d).getDay()]})`;
  $$('rCurDt').textContent=`~${m}.${d}`;
  const prev=getPrevL();$$('rPrevDt').textContent=prev?shortD(prev.날짜)+'~':'';
  const pHw=$$('rPrevHwDate');if(pHw)pHw.textContent=prev?`(~${shortD(curDate)})`:'';
  const nHw=$$('rNextHwDate');
  if(nHw&&nextDate)nHw.textContent=`(~${shortD(nextDate)})`;else if(nHw)nHw.textContent='';
}

// ─── 저번 주차 과제 표시 (2열 레이아웃 지원) ───
function updateHwDisplay(){
  const list=$$('rHwList'),sec=$$('secPrevHw');
  const visible=G.hwItems.filter((_,i)=>G.hwStatus[i]!=='');
  if(!G.hwItems.length||!visible.length){if(sec)sec.style.display='none';list.innerHTML='';return;}
  if(sec)sec.style.display='';
  const icons={'완료':'✓','부분완료':'◑','미완료':'✗'};
  const baseHtml=[],carryHtml=[];
  G.hwItems.forEach((item,i)=>{
    if(!item.trim()||G.hwStatus[i]==='')return;
    const st=G.hwStatus[i]||'미완료';
    const isCarry=G.hwItemTypes[i]?.type==='carry';
    const li=`<div class="hw-li s${st}">
      <span class="hw-icon">${icons[st]||'?'}</span>
      ${isCarry?'<span class="hw-carry-mark">(전)</span>':''}
      <span class="hw-text">${esc(item.trim())}</span>
      <span class="hw-chip">${st}</span>
    </div>`;
    if(isCarry)carryHtml.push(li);else baseHtml.push(li);
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
  updateHwBadge();
}
function updateHwBadge(){}
function updateNoticeList(text){
  const list=$$('rNoticeList');if(!text||!text.trim()){list.innerHTML='';return;}
  list.innerHTML=text.split('\n').filter(l=>l.trim()).map(l=>`<div class="next-hw-li">${esc(l.trim())}</div>`).join('');
}
function updateCommentSign(){
  const sign=$$('inputTeacher').value.trim();
  $$('commentSign').innerText=sign?`From. ${sign} T`:'';
}
function updateWrongTags(tagStr){
  const tags=tagStr?tagStr.split(',').map(t=>t.trim()).filter(t=>t):[];
  $$('rWrongTags').innerHTML=tags.map(t=>`<span class="wtag">${esc(t)} 틀림</span>`).join('');
}

// ─── 리포트 편집 override 적용 ───
function applyReportEdits(){
  if(!G.reportEdits)return;
  ['rHwList','rNoticeList','commentBody','commentSign'].forEach(id=>{
    if(G.reportEdits[id]!=null){
      const el=$$(id);if(el)el.innerHTML=G.reportEdits[id];
    }
  });
}

// ─── 리포트카드 편집 리스너 초기화 ───
function initReportListeners(){
  ['rHwList','rNoticeList','commentBody','commentSign'].forEach(id=>{
    const el=$$(id);if(!el)return;
    el.setAttribute('contenteditable','true');
    el.addEventListener('input',function(){
      G.reportEdits[id]=this.innerHTML;
    });
    el.addEventListener('paste',function(e){
      e.preventDefault();
      document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));
    });
  });
}
