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
}

// ─── 과제 에디터 ───
function renderHwEditor(){
  const c=$$('hwEditor');
  if(!G.hwItems.length){c.innerHTML='<div style="font-size:11px;color:#b5bac4;padding:4px 2px;">이전 주차 과제 없음</div>';updateHwDisplay();return;}
  c.innerHTML=G.hwItems.map((item,i)=>{
    const st=G.hwStatus[i]||'';
    return`<div class="hw-item"><input type="text" class="${st?'':'auto'}" value="${esc(item)}"
      oninput="G.hwItems[${i}]=this.value;this.classList.remove('auto');updateHwDisplay();">
      <button class="hw-btn s${st}" onclick="cycleHwStatus(${i})">${hwBtnLabel(st)}</button>
    </div>`;}).join('');
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
  updateHwBadge();rebuildGraph();
}
function calcRateFromStatus(s){
  const v=s.filter(x=>x);if(!v.length)return null;
  return Math.round(v.reduce((a,x)=>a+(x==='완료'?1:x==='부분완료'?.5:0),0)/v.length*100);
}

// ─── 과제 순환 버튼 ───
const hwBtnLabel=s=>({'완료':'✓ 완료','부분완료':'◑ 부분완료','미완료':'✗ 미완료'}[s]||'— 없음');
function cycleHwStatus(i){
  const order=['','완료','부분완료','미완료'];
  const next=order[(order.indexOf(G.hwStatus[i])+1)%order.length];
  G.hwStatus[i]=next;
  const btns=document.querySelectorAll('.hw-btn');
  if(btns[i]){btns[i].className='hw-btn s'+next;btns[i].textContent=hwBtnLabel(next);}
  if(G.hwRateManual===null){
    const r=calcRateFromStatus(G.hwStatus);
    const val=r!==null?String(r):'';
    setAuto('inputRate',val);
    if(val===''){$$('secRate').style.display='none';}
    else{$$('secRate').style.display='';$$('rRate').innerText=val;}
    if(G.selStudent&&G.selDate){
      G.rates[G.selStudent]=G.rates[G.selStudent]||{};
      if(r!==null)G.rates[G.selStudent][G.selDate]=r;
      else delete G.rates[G.selStudent][G.selDate];
    }
  }
  updateHwDisplay();updateHwBadge();rebuildGraph();saveSession();
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
function updateHwDisplay(){
  const list=$$('rHwList'),sec=$$('secPrevHw');
  const visible=G.hwItems.filter((_,i)=>G.hwStatus[i]!=='');
  if(!G.hwItems.length||!visible.length){if(sec)sec.style.display='none';list.innerHTML='';return;}
  if(sec)sec.style.display='';
  list.innerHTML=G.hwItems.map((item,i)=>{
    if(!item.trim()||G.hwStatus[i]==='')return'';
    const st=G.hwStatus[i]||'미완료';
    const icons={'완료':'✓','부분완료':'◑','미완료':'✗'};
    return`<li class="s${st}"><span class="hw-icon">${icons[st]||'?'}</span><span class="hw-text">${esc(item.trim())}</span><span class="hw-chip ${st}">${st}</span></li>`;}).join('');
  updateHwBadge();
}
function updateHwBadge(){}
function updateNoticeList(text){
  const list=$$('rNoticeList');if(!text||!text.trim()){list.innerHTML='';return;}
  list.innerHTML=text.split('\n').filter(l=>l.trim()).map(l=>`<li>${esc(l.trim())}</li>`).join('');
}
function updateCommentSign(){
  const sign=$$('inputTeacher').value.trim();
  $$('commentSign').innerText=sign?`From. ${sign} T`:'';
}
function updateWrongTags(tagStr){
  const tags=tagStr?tagStr.split(',').map(t=>t.trim()).filter(t=>t):[];
  $$('rWrongTags').innerHTML=tags.map(t=>`<span class="wtag">${esc(t)} 틀림</span>`).join('');
}
function updateCurProgSummary(){
  const b=$$('inCurBook').value,c=$$('inCurChap').value;
  $$('curProgSummary').textContent=(b||c)?b+(b&&c?' · ':'')+c:'—';
}
function updateNextHwSummary(){
  const lines=($$('inputNotice').value||'').split('\n').filter(l=>l.trim());
  $$('nextHwSummary').textContent=lines.length?`${lines.length}개 과제`:'—';
}
