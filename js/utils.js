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

// ─── 이월 판별 헬퍼 ───
// 해당 항목의 fromDate가 직전 수업 날짜가 아니면 이월과제
function isCarryItem(fromDate){
  const prev=getPrevL();
  return prev?fromDate!==prev.날짜:false;
}
// 날짜를 직접 지정하여 이월 판별 (autoFillAll 등에서 사용)
function isCarryForDate(fromDate,date){
  const idx=G.lessons.findIndex(l=>l.날짜===date);
  if(idx<=0)return false;
  return fromDate!==G.lessons[idx-1].날짜;
}

// ref → 체크 날짜 (원본 수업 다음 수업일 = 숙제 확인일)
function refToCheckDate(ref){
  if(!ref)return'';
  const di=ref.lastIndexOf('-');if(di<0)return'';
  const lid=ref.slice(0,di);
  const sl=G.lessons.find(l=>l.id===lid);if(!sl)return'';
  const si=G.lessons.indexOf(sl);
  return(si>=0&&si<G.lessons.length-1)?G.lessons[si+1].날짜:'';
}

// ─── HTML 이스케이프 ───
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ─── 한국 시간 (KST, UTC+9) ───
function nowKST(){return new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Seoul'}));}
function todayKST(){const d=nowKST();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function nowKSTStr(){const d=nowKST();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;}
