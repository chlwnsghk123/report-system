// ─── lesson 헬퍼 ───
const getCurL=()=>G.lessons.find(r=>r.날짜===G.selDate);
const getPrevL=()=>{const c=getCurL();if(!c)return null;const i=G.lessons.indexOf(c);return i>0?G.lessons[i-1]:null;};
const getNextL=()=>{const c=getCurL();if(!c)return null;const i=G.lessons.indexOf(c);return i<G.lessons.length-1?G.lessons[i+1]:null;};

// ─── 인풋 유틸 ───
function setAuto(id,val){
  const el=$$(id);if(!el)return;
  el.value=String(val??'');el.classList.add('auto');
  if(!el._al){el.addEventListener('input',function(){this.classList.remove('auto');});el._al=true;}
}
function rmAuto(el){el.classList.remove('auto');}

// ─── 상태바 ───
function setBar(t,m){const e=$$('sbar');e.className='sbar '+t;e.textContent=m;}

// ─── 날짜 포맷 ───
function shortD(d){if(!d)return'';const p=d.split('-');return`${p[1]}.${p[2]}`;}
function fmtKo(d){
  if(!d)return d;
  const[y,m,day]=d.split('-');
  const w=['일','월','화','수','목','금','토'][new Date(+y,+m-1,+day).getDay()];
  return`${y}년 ${+m}월 ${+day}일 (${w})`;
}

// ─── HTML 이스케이프 ───
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
