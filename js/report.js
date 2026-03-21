// ─── 이행률 표정 ───
function updateRateFace(){
  const el=$$('rateFace');if(!el)return;
  const v=parseFloat($$('inputRate')?.value);
  if(isNaN(v)||v===-1){el.textContent='';return;}
  if(v>=90)el.textContent='(๑˃̵ᴗ˂̵)و';
  else if(v>=70)el.textContent='(•‿•)';
  else if(v>=50)el.textContent='(•_•)';
  else el.textContent='(；´∀`)';
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
