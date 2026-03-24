// ─── 이행률 마스코트 (이미지 기반, 점수 티어별 랜덤) ───
// img/mascots/high/ : 75% 이상
// img/mascots/mid/  : 30% 이상 ~ 75% 미만
// img/mascots/low/  : 30% 미만
const MASCOT_IMGS={high:[],mid:[],low:[]};
const MASCOT_DIR='img/mascots/';

/* 마스코트 이미지 등록 (init.js에서 호출) */
function registerMascots(tier,fileNames){
  MASCOT_IMGS[tier]=fileNames.map(f=>MASCOT_DIR+tier+'/'+f);
}

function updateRateFace(){
  const el=$$('rateMascot');if(!el)return;
  const rate=parseFloat($$('rRate')?.innerText);
  const tier=isNaN(rate)||rate<0?'mid':rate>=75?'high':rate>=30?'mid':'low';
  const imgs=MASCOT_IMGS[tier];
  if(!imgs||!imgs.length){el.innerHTML='';el.style.display='none';return;}
  el.style.display='';
  // 학생별·점수대별 저장된 마스코트 확인
  let idx;
  const saved=G.mascotChoices[G.selStudent];
  if(saved&&saved[tier]!=null&&saved[tier]<imgs.length){
    idx=saved[tier];
  }else{
    idx=Math.floor(Math.random()*imgs.length);
  }
  G.selectedMascot={tier,idx};
  el.dataset.mascotIdx=idx;
  el.dataset.mascotTier=tier;
  const src=imgs[idx];
  if(!el.querySelector('img')||el.querySelector('img').src!==src){
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
  // 오버레이 생성
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
  // 닫기 함수
  function closePicker(){overlay.remove();}
  // 닫기 버튼
  picker.querySelector('.mascot-picker-close').addEventListener('click',closePicker);
  // 바깥 클릭 시 닫기
  overlay.addEventListener('click',function(ev){if(ev.target===overlay)closePicker();});
  // 선택 이벤트
  picker.querySelector('.mascot-picker-grid').addEventListener('click',function(ev){
    const item=ev.target.closest('.mascot-pick-item');if(!item)return;
    const idx=+item.dataset.idx;
    el.dataset.mascotIdx=idx;
    el.innerHTML=`<img src="${imgs[idx]}" alt="mascot" draggable="false">`;
    const tier=el.dataset.mascotTier;
    G.selectedMascot={tier,idx};
    if(G.selStudent){G.mascotChoices[G.selStudent]=G.mascotChoices[G.selStudent]||{};G.mascotChoices[G.selStudent][tier]=idx;saveAppData();}
    closePicker();
  });
  // ESC 닫기
  function onEsc(ev){if(ev.key==='Escape'){closePicker();document.removeEventListener('keydown',onEsc);}}
  document.addEventListener('keydown',onEsc);
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
  const pts=entries.map((e,i)=>{let y=88-(e.v/100)*62;if(y<22)y=22;if(y>88)y=88;return{x:30+i*200,y,v:e.v,date:e.date};});
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

// ─── 과제 에디터 (좌패널: 저번 주차 과제 체크, base + carry만) ───
function renderHwEditor(){
  const c=$$('hwEditor');
  const firstCarryIdx=G.hwItemRefs.findIndex(r=>isCarryItem(r?.fromDate));
  let html='';
  if(!G.hwItems.length){
    html+='<div style="font-size:11px;color:#b5bac4;padding:4px 2px;">이전 주차 과제 없음</div>';
  }
  G.hwItems.forEach((item,i)=>{
    const st=G.hwStatus[i]??-1;
    const fromDate=G.hwItemRefs[i]?.fromDate||'';
    const carry=isCarryItem(fromDate);
    if(i===firstCarryIdx) html+='<div class="hw-carry-divider">이월 과제</div>';
    const isCarry=carry;
    const stCls=isNone(st)?'':'st'+st;
    html+=`<div class="hw-item${isCarry?' hw-carry':''} ${stCls}" onclick="cycleHwStatus(${i})">
      ${isCarry?`<span class="hw-carry-badge" title="${fromDate?fmtKo(fromDate):''}">(전)</span>`:''}
      <input type="text" value="${esc(item)}" readonly style="cursor:pointer;opacity:.8;" tabindex="-1">
      <span class="hw-btn s${st}">${hwBtnLabel(st)}</span>
    </div>`;
  });
  c.innerHTML=html;
  updateHwDisplay();
}

// ─── 추가 숙제 관리 ───
// ─── 추가 과제 관리 (이번 주차 과제에 추가, G.extraHw 사용) ───
function addExtraHw(){
  const input=$$('extraHwInput');if(!input)return;
  const text=input.value.trim();if(!text)return;
  G.extraHw.push({text});
  input.value='';
  renderExtraHwEditor();updateNoticeWithCarry();
  syncHwRecItems(G.selStudent,G.selDate);saveAppData();
}
function removeExtraHw(idx){
  if(idx<0||idx>=G.extraHw.length)return;
  G.extraHw.splice(idx,1);
  renderExtraHwEditor();updateNoticeWithCarry();
  syncHwRecItems(G.selStudent,G.selDate);saveAppData();
}
function updateExtraHwText(idx,val){
  if(idx<0||idx>=G.extraHw.length)return;
  G.extraHw[idx].text=val;
  updateNoticeWithCarry();
  syncHwRecItems(G.selStudent,G.selDate);saveAppData();
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
  // 이행률 입력 시 결석→출석 자동 전환
  if(v!==''&&Number(v)!==-1)autoAttendOnRate();
}

// ─── 과제 순환 버튼 ───
const hwBtnLabel=s=>({2:'✓ 완료',1:'△ 부분완료',0:'✗ 미완료'}[s]||'— 없음');
function cycleHwStatus(i){
  const order=[-1,2,1,0];
  const cur=G.hwStatus[i]??-1;
  const next=order[(order.indexOf(cur)+1)%order.length];
  G.hwStatus[i]=next;
  // 박스 전체 + 버튼 갱신
  const items=$$('hwEditor').querySelectorAll('.hw-item');
  if(items[i]){
    items[i].className=items[i].className.replace(/\bst-?\d?\b/g,'').trim()+(isNone(next)?'':' st'+next);
    const btn=items[i].querySelector('.hw-btn');
    if(btn){btn.className='hw-btn s'+next;btn.textContent=hwBtnLabel(next);}
  }
  // 좌패널에서 변경 → 리포트 override 제거
  delete G.reportEdits.rHwList;
  delete G.reportEdits.rNoticeList;
  updateHwDisplay();updateHwBadge();rebuildGraph();
  updateNoticeWithCarry();
  syncHwRecItems(G.selStudent,G.selDate);
  // 이월 전파 예약 (세션 전환 시 일괄 적용)
  const ref=G.hwItemRefs[i]?.ref;
  if(ref){
    const exists=G.pendingPropagations.findIndex(p=>p.ref===ref&&p.student===G.selStudent&&p.date===G.selDate);
    if(exists>=0)G.pendingPropagations[exists].status=next;
    else G.pendingPropagations.push({student:G.selStudent,date:G.selDate,ref,status:next});
  }
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
  const stName={2:'완료',1:'부분완료',0:'미완료'};
  const visible=G.hwItems.filter((_,i)=>!isNone(G.hwStatus[i]));
  if(!G.hwItems.length||!visible.length){if(sec)sec.style.display='none';list.innerHTML='';return;}
  if(sec)sec.style.display='';
  const icons={2:'✓',1:'△',0:'✗'};
  const baseHtml=[],carryHtml=[],extraHtml=[];
  G.hwItems.forEach((item,i)=>{
    if(!item.trim()||isNone(G.hwStatus[i]))return;
    const st=G.hwStatus[i]??0;
    const isCarry=isCarryItem(G.hwItemRefs[i]?.fromDate);
    const li=`<div class="hw-li s${st}">
      <span class="hw-icon">${icons[st]||'?'}</span>
      ${isCarry?'<span class="hw-carry-mark">(전)</span>':''}
      <span class="hw-text">${esc(item.trim())}</span>
      <span class="hw-chip">${stName[st]||''}</span>
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

// ─── 출결 토글 ───
function setAttend(val){
  if(!G.selStudent||!G.selDate)return;
  G.attend[G.selStudent]=G.attend[G.selStudent]||{};
  // 같은 버튼 재클릭 → 해제(-1)
  const cur=G.attend[G.selStudent][G.selDate];
  G.attend[G.selStudent][G.selDate]=(cur===val)?-1:val;
  updateAttendUI();
  saveAppData();
}

function updateAttendUI(){
  const wrap=$$('attendToggle');if(!wrap)return;
  if(!G.selStudent||!G.selDate||!G.lessons.length||G.selDate===G.lessons[0].날짜){
    wrap.style.display='none';return;
  }
  wrap.style.display='';
  const val=G.attend[G.selStudent]?.[G.selDate];
  // -1=해제(특수), 미래 공란은 선택 안 함, 과거 공란은 결석
  const today=todayKST();
  let effective=val;
  if(val===-1)effective=null; // 해제 상태 → 아무 버튼도 선택 안 함
  else if(val==null||val===undefined){
    effective=G.selDate<=today?0:null;
  }
  wrap.querySelectorAll('.att-btn').forEach(btn=>{
    const bv=parseInt(btn.dataset.att);
    btn.classList.toggle('active',bv===effective);
  });
}

// 이행률 변경 시 결석→출석 자동 전환
function autoAttendOnRate(){
  if(!G.selStudent||!G.selDate)return;
  const att=G.attend[G.selStudent]?.[G.selDate];
  if(att===0||att==null){
    G.attend[G.selStudent]=G.attend[G.selStudent]||{};
    G.attend[G.selStudent][G.selDate]=2;
    updateAttendUI();
  }
}
