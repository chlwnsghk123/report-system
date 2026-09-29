// ─── 학원 저장소 (구글 로그인) · 문제 노트 숙제 채점 · 앱 사이 이동 ───
// 서버는 문제 노트 사이트(mathpro.app)의 Worker다 — 이 앱에는 서버 코드가 없다.
//  · 로그인: 구글 계정 → 세션 토큰(14일, localStorage 'rs:auth'). 운영자가 학원마다 등록한 이메일만 통과.
//  · 학원 저장소: '리포트'(엑셀 파일 한 개 분량 = DATA_KEYS 전체)를 학원 단위로 저장·공유.
//    열어 둔 리포트는 편집할 때마다 자동 저장(1.5초 뒤). 다른 곳에서 먼저 저장했으면 충돌 안내.
//    엑셀 저장(💾)은 백업용으로 그대로 쓰고, 로그인하지 않으면 지금처럼 엑셀 + 자동 백업으로만 동작한다.
//  · 숙제 채점: 문제 노트에서 낸 숙제를 '나눠 준 수업'의 '다음 수업까지 과제'에 넣고, 그다음 수업(검사하는 날)의
//    '지난 수업 과제 검사' 옆 카드와 '📘 숙제 채점(반 전체)' 창에서 틀린 문제만 눌러 채점 → 학생별 문제 기록.
//    리포트 '지난 수업 과제'에 "12/15 맞음 · 다시 볼 문제"로 나온다. 안 해 오면 '안 해 옴'(다음 수업까지 이월).
//  · 오답 다시 풀기: 틀린 문제는 학생마다 해결될 때까지 '다음 수업까지 과제'에 자동으로 붙고(ON/OFF 가능),
//    다음 수업에 다시 채점한다(다른 날 두 번 맞히면 해결). 같은 기록을 문제 노트의 '숙제·채점'도 쓴다.
//  · 앱 사이 이동: '📘 문제 노트 ↗'는 로그인·학원(+갈 곳 #go=)을 넘겨 mathpro.app 을 연다(#mph= 넘김 코드, 2분).
//    반대로 문제 노트에서 넘어오면 #mph= 로 같은 계정 로그인, #go=student:이름 이면 그 학생을 골라 연다.
// 다른 파일과의 연결점(없으면 조용히 건너뜀): saveAppData→cloudOnChange, _appSnapshot→cloudSnapshotTag,
// _curHwOnOffItems→noteNextItems, updateHwDisplay→noteCheckRows, confirmMissingInputs→noteUngradedNames,
// autoFillAll→renderNotePanel, loadExcel·_clearAllData→cloudDetach, Ctrl+S→cloudSaveNow, window.onload→cloudInit

const CLOUD_API_DEFAULT='https://mathpro.app';
const CLOUD_LS={auth:'rs:auth',tenant:'rs:tenant',book:'rs:book',api:'rs:apiBase',notes:'rs:notes'};
const CLOUD={
  config:null,      // {enabled, clientId}
  auth:null,        // {token, user:{email,name}, tenants:[{path,name,role}]}
  expired:false,    // 로그인 만료 — 다시 로그인하면 멈춘 저장을 이어서
  tenant:'',        // 선택한 학원 "seed/slug"
  book:null,        // 열어 둔 리포트 {id,title,rev,updatedAt}
  books:null,       // 학원 리포트 목록 (모달용)
  dirty:false,saving:false,again:false,timer:null,retry:0,conflict:null,
  notes:{tenant:'',homework:[],recs:{},at:''}, // 숙제 + 학생별 문제 기록 {items, missing} (학원 단위, 이 기기에 캐시)
  markQ:{},markBusy:{},recLoading:{},notesAt:0, // 학생별 채점 저장 줄 (한 번에 하나씩 → 서로 덮어쓰지 않게)·기록 불러오는 중
  goStudent:'', // 문제 노트에서 '학습 리포트에서 보기'로 넘어온 학생 (리포트를 연 뒤 그 학생으로)
};
const _CLOUD_DEF={lessons:[],students:[],teacherName:'',showMini:false,showComment:false,colorMode:false,lastSaved:''};
const _CLOUD_MSG={
  'not-member':'이 구글 계정은 아직 학원에 등록되지 않았습니다 — 운영자에게 등록을 요청해 주세요',
  'bad-google-token':'구글 로그인 확인에 실패했습니다 — 다시 시도해 주세요',
  'auth-not-configured':'학원 저장소 로그인이 아직 설정되지 않았습니다',
  'too-many-attempts':'시도가 너무 많습니다 — 잠시 후 다시 해 주세요',
  'not-signed-in':'로그인이 만료됐습니다 — 다시 로그인해 주세요',
  'storage-error':'학원 저장소에 연결하지 못했습니다 — 잠시 후 다시 시도해 주세요',
  'storage-missing':'학원 저장소가 아직 준비되지 않았습니다 — 운영자에게 알려 주세요',
  'storage-not-configured':'학원 저장소 설정이 없습니다 — 운영자에게 알려 주세요',
  'too-large':'리포트가 너무 커서 저장할 수 없습니다 (최대 4MB)',
  'not-found':'학원 저장소에서 찾지 못했습니다 (삭제됐을 수 있습니다)',
  'no-valid-items':'숙제 내용을 확인해 주세요',
  'bad-handoff':'로그인 넘김이 만료됐습니다 — 다시 로그인해 주세요',
};

function _lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
function _lsSet(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
// 서버 주소 — 기본 mathpro.app, 시험용으로 localStorage 'rs:apiBase'에 다른 주소를 넣을 수 있음
function cloudApiBase(){let b='';try{b=localStorage.getItem(CLOUD_LS.api)||'';}catch(e){}return(b||CLOUD_API_DEFAULT).replace(/\/+$/,'');}
function _tokenOk(t){try{const c=JSON.parse(atob(String(t).split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return c.exp*1000>Date.now()+60000;}catch(e){return false;}}
const cloudSignedIn=()=>!!(CLOUD.auth&&CLOUD.auth.token&&!CLOUD.expired);
const cloudActive=()=>!!CLOUD.book;
const cloudIsDirty=()=>!!(CLOUD.book&&(CLOUD.dirty||CLOUD.saving||CLOUD.conflict));
// 자동 백업(IndexedDB) 스냅샷에 붙이는 표시 — 어느 학원 리포트의 몇 번째 저장본 위에서 작업 중인지
function cloudSnapshotTag(){return CLOUD.book?{tenant:CLOUD.tenant,id:CLOUD.book.id,rev:CLOUD.book.rev,title:CLOUD.book.title}:null;}
function _fmtTime(iso,short){
  if(!iso)return'';const d=new Date(iso);if(isNaN(d))return'';
  const k=new Date(d.toLocaleString('en-US',{timeZone:'Asia/Seoul'}));
  const hm=`${String(k.getHours()).padStart(2,'0')}:${String(k.getMinutes()).padStart(2,'0')}`;
  return short&&ymd(k)===todayKST()?hm:`${k.getMonth()+1}.${k.getDate()} ${hm}`;
}
const _shortEmail=e=>String(e||'').split('@')[0];

// ─── 서버 호출 ───
async function _cloudFetch(path,{method='GET',body,query,auth=true}={}){
  const url=new URL(cloudApiBase()+path);
  Object.entries(query||{}).forEach(([k,v])=>url.searchParams.set(k,v));
  const headers={};
  if(auth&&CLOUD.auth?.token)headers.Authorization='Bearer '+CLOUD.auth.token;
  if(body!==undefined)headers['Content-Type']='application/json';
  let r;
  try{r=await fetch(url,{method,headers,body:body!==undefined?JSON.stringify(body):undefined,cache:'no-store'});}
  catch(e){const err=new Error('학원 저장소에 연결하지 못했습니다 (인터넷 연결을 확인해 주세요)');err.network=true;throw err;}
  let d={};try{d=await r.json();}catch(e){}
  if(!r.ok){
    const err=new Error(_CLOUD_MSG[d.error]||d.error||`요청 실패 (${r.status})`);
    err.status=r.status;err.code=d.error||'';err.data=d;
    if(auth&&r.status===401)_cloudExpired();
    throw err;
  }
  return d;
}
const _ws=(route,o={})=>_cloudFetch('/api/workspace/'+route,{...o,query:{tenant:CLOUD.tenant,...(o.query||{})}});

// ─── 시작 (window.onload에서 지난 작업 확인 뒤 호출) ───
async function cloudInit(){
  const a=_lsGet(CLOUD_LS.auth);
  if(a&&a.token&&_tokenOk(a.token))CLOUD.auth=a;else if(a)_lsSet(CLOUD_LS.auth,null);
  CLOUD.tenant=_lsGet(CLOUD_LS.tenant)||'';
  if(CLOUD.auth&&!(CLOUD.auth.tenants||[]).some(t=>t.path===CLOUD.tenant))CLOUD.tenant=CLOUD.auth.tenants?.[0]?.path||'';
  await _cloudConsumeHandoff(); // 문제 노트에서 넘어온 로그인(#mph=)
  const n=_lsGet(CLOUD_LS.notes);
  if(n&&n.tenant&&n.tenant===CLOUD.tenant&&Array.isArray(n.homework))CLOUD.notes={tenant:n.tenant,homework:n.homework,recs:n.recs||{},at:n.at||''};
  try{
    const c=await _cloudFetch('/api/auth/config',{auth:false});
    CLOUD.config={enabled:!!(c.enabled&&c.clientId),clientId:c.clientId||''};
  }catch(e){CLOUD.config={enabled:false,clientId:''};}
  // 로그인 없이도 앱은 그대로 — ☁ 버튼은 늘 보이고, 누르면 로그인하거나 연결 상태를 알려 준다
  window.addEventListener('beforeunload',e=>{if(cloudIsDirty()){e.preventDefault();e.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&CLOUD.book&&CLOUD.dirty&&!CLOUD.saving)_cloudSave();});
  // 문제 노트·다른 선생님이 바꾼 과제·채점을 창으로 돌아올 때 새로 받기 (1분에 한 번)
  window.addEventListener('focus',()=>{if(cloudSignedIn()&&Date.now()-CLOUD.notesAt>60000)cloudLoadNotes();});
  _cloudStatus();
  _cloudApplyGo(); // 이 기기 백업으로 이미 화면에 리포트가 있으면 바로
  if(!cloudSignedIn())return;
  cloudLoadNotes();
  cloudResume();
}

// ─── 구글 로그인 ───
let _gisP=null;
function _loadGis(){
  if(window.google?.accounts?.id)return Promise.resolve(window.google);
  if(!_gisP)_gisP=new Promise((res,rej)=>{
    const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;
    s.onload=()=>window.google?.accounts?.id?res(window.google):rej(new Error('gis'));
    s.onerror=()=>{_gisP=null;rej(new Error('gis'));};
    document.head.appendChild(s);
  });
  return _gisP;
}
function _renderGoogleBtn(el){
  if(!el)return;
  if(!CLOUD.config?.clientId){el.innerHTML='<div class="cloud-err">학원 저장소 로그인이 아직 설정되지 않았거나 서버에 연결하지 못했습니다</div>';return;}
  _loadGis().then(g=>{
    g.accounts.id.initialize({client_id:CLOUD.config.clientId,callback:r=>cloudSignIn(r.credential),auto_select:false,cancel_on_tap_outside:true});
    g.accounts.id.renderButton(el,{theme:'outline',size:'large',shape:'pill',text:'signin_with',locale:'ko',width:260});
  }).catch(()=>{el.innerHTML='<div class="cloud-err">구글 로그인 버튼을 불러오지 못했습니다 (인터넷·광고 차단 확장을 확인해 주세요)</div>';});
}
async function cloudSignIn(credential){
  const msg=$$('cloudLoginMsg');
  if(msg){msg.className='cloud-hint';msg.textContent='확인 중…';}
  try{
    const d=await _cloudFetch('/api/auth/google',{method:'POST',body:{credential},auth:false});
    CLOUD.auth={token:d.token,user:d.user||{},tenants:d.tenants||[]};CLOUD.expired=false;
    _lsSet(CLOUD_LS.auth,CLOUD.auth);
    const keep=CLOUD.auth.tenants.find(t=>t.path===CLOUD.tenant);
    _cloudSetTenant(keep?keep.path:(CLOUD.auth.tenants[0]?.path||''));
    toast(`${d.user?.email||''} 계정으로 로그인했습니다`);
    if(CLOUD.book){if(CLOUD.dirty)_cloudSchedule(0);}
    else cloudResume();
    _cloudStatus();_renderCloudModal();_loadBooks();
  }catch(e){
    const text=e.code==='not-member'&&e.data?.email?`${e.data.email} — ${e.message}`:e.message;
    if(msg){msg.className='cloud-err';msg.textContent=text;}else toast(text);
  }
}
function cloudSignOut(){
  if(cloudIsDirty()&&!confirm('학원 저장소에 아직 저장되지 않은 변경이 있습니다.\n로그아웃하면 이 변경은 이 기기에만 남습니다. 계속할까요?'))return;
  if(CLOUD.book){cloudDetach();markUnsaved();_localBar();saveAppDataNow();}
  CLOUD.auth=null;CLOUD.expired=false;CLOUD.books=null;_lsSet(CLOUD_LS.auth,null);
  // 로그아웃하면 이 기기의 숙제·채점 캐시도 비움 (리포트에는 직접 입력한 미니 테스트만 표시)
  CLOUD.notes={tenant:'',homework:[],recs:{},at:''};_lsSet(CLOUD_LS.notes,null);
  try{window.google?.accounts?.id?.disableAutoSelect?.();}catch(e){}
  _refreshNoteViews();_cloudStatus();_renderCloudModal();
  toast('로그아웃했습니다');
}
function _cloudExpired(){
  if(CLOUD.expired)return;
  CLOUD.expired=true;_lsSet(CLOUD_LS.auth,null);
  _cloudStatus();_renderCloudModal();
  toast('학원 저장소 로그인이 만료됐습니다 — ☁ 학원 저장소에서 다시 로그인해 주세요');
}
function _cloudSetTenant(path){
  if(path!==CLOUD.tenant&&CLOUD.book){cloudDetach();markUnsaved();_localBar();saveAppDataNow();}
  if(path!==CLOUD.tenant||CLOUD.notes.tenant!==path){
    CLOUD.notes={tenant:path,homework:[],recs:{},at:''};_lsSet(CLOUD_LS.notes,null);
  }
  CLOUD.tenant=path;_lsSet(CLOUD_LS.tenant,path);CLOUD.books=null;
  cloudLoadNotes();
}
function cloudChangeTenant(path){
  if(CLOUD.book&&cloudIsDirty()&&!confirm('지금 리포트에 학원 저장소로 못 올린 변경이 있습니다.\n다른 학원으로 바꾸면 이 리포트와 연결이 끊기고 변경은 이 기기에만 남습니다. 계속할까요?')){_renderCloudModal();return;}
  _cloudSetTenant(path);_renderCloudModal();_loadBooks();
}

// ─── 리포트 데이터 ↔ 저장 형식 (hwDisabled의 Set은 JSON에 담기지 않아 배열로) ───
function _cloudPayload(){
  const d={};DATA_KEYS.forEach(k=>{d[k]=G[k];});
  const hd={};
  Object.entries(G.hwDisabled||{}).forEach(([k,s])=>{const a=s instanceof Set?[...s]:Array.isArray(s)?s:[];if(a.length)hd[k]=a;});
  d.hwDisabled=hd;
  d.pendingPropagations=G.pendingPropagations||[];
  d.fileName=G.excelFileName;
  return d;
}
function _cloudApply(src){
  DATA_KEYS.forEach(k=>{
    if(src[k]!==undefined)G[k]=src[k];
    else{const d=_CLOUD_DEF[k];G[k]=d===undefined?{}:Array.isArray(d)?[]:d;}
  });
  ['rates','wrong','hwRec','memos','attend','mascotChoices','hwDisabled','journalNote','journalPlan','journalInfo','miniTest','miniScore']
    .forEach(k=>{if(!G[k]||typeof G[k]!=='object'||Array.isArray(G[k]))G[k]={};});
  const hd={};
  Object.entries(G.hwDisabled).forEach(([k,v])=>{const a=v instanceof Set?[...v]:Array.isArray(v)?v:[];if(a.length)hd[k]=new Set(a);});
  G.hwDisabled=hd;
  G.lessons=Array.isArray(G.lessons)?G.lessons.filter(l=>l&&isValidDate(l.날짜)):[];
  if(!Array.isArray(G.students))G.students=[];
  G.pendingPropagations=Array.isArray(src.pendingPropagations)?src.pendingPropagations:[];
  if(src.fileName)G.excelFileName=src.fileName;
  G.tabData={};G.studentPdfs={};G.pdfCanvases=[];
  G.hwItems=[];G.hwStatus=[];G.hwItemRefs=[];G.extraHw=[];G.hwRateManual=null;
}
function _cloudBind(doc){
  CLOUD.book={id:doc.id,title:doc.title||'리포트',rev:doc.rev,updatedAt:doc.updatedAt||''};
  CLOUD.dirty=false;CLOUD.again=false;CLOUD.conflict=null;CLOUD.retry=0;
  _lsSet(CLOUD_LS.book,{...CLOUD.book,tenant:CLOUD.tenant});
  _cloudStatus();
}
// 불러온 데이터를 화면에 표시 (sel: 유지할 날짜·학생 선택)
function _cloudShow(sel){
  const d=sel?.selDate,s=sel?.selStudent;
  G.selDate=d&&G.lessons.some(l=>l.날짜===d)?d:'';
  G.selStudent=s&&G.students.includes(s)?s:'';
  dismissRecovery();
  applyViewSettings();updateLastSavedDisplay();
  showGroups(!!G.selDate);
  markSaved();
  _cloudBar();
  _cloudApplyGo();
}
function _cloudBar(){
  if(!CLOUD.book)return;
  setBar('ok','☁ '+CLOUD.book.title);
  const b=$$('sbar');b.onclick=openCloudModal;b.title='학원 저장소 리포트 — 눌러서 다른 리포트 열기·올리기';
}
function _localBar(){
  setBar('ok','✏️ 이 기기에서 작업 중 (학원 저장소와 연결 안 됨 — 💾로 엑셀 저장)');
  const b=$$('sbar');b.onclick=triggerLoad;b.title='';
}
function cloudDetach(){
  if(!CLOUD.book)return;
  clearTimeout(CLOUD.timer);CLOUD.timer=null;
  CLOUD.book=null;CLOUD.dirty=false;CLOUD.again=false;CLOUD.conflict=null;CLOUD.retry=0;
  _lsSet(CLOUD_LS.book,null);
  _cloudStatus();
}
function cloudDisconnect(){
  if(cloudIsDirty()&&!confirm('학원 저장소에 아직 저장되지 않은 변경이 있습니다.\n연결을 끊으면 이 변경은 이 기기에만 남습니다. 계속할까요?'))return;
  cloudDetach();markUnsaved();_localBar();saveAppDataNow();_renderCloudModal();
}

// ─── 이어서 열기 (시작할 때·다시 로그인했을 때) ───
async function cloudResume(){
  const b=_lsGet(CLOUD_LS.book);
  if(!b||!b.id||!cloudSignedIn()||b.tenant!==CLOUD.tenant||CLOUD.book)return;
  const hadLocal=(G.lessons.length||G.students.length)&&G.unsaved; // 로그아웃 동안 이 기기에서 한 작업
  const sel={selDate:G.selDate,selStudent:G.selStudent};
  if(!hadLocal)dismissRecovery();
  setBar('wait','☁ 학원 저장소에서 불러오는 중…');
  let doc;
  try{doc=await _ws('report',{query:{id:b.id}});}
  catch(e){
    if(e.status===404||e.status===403)_lsSet(CLOUD_LS.book,null);
    setBar('err',e.status===404?'☁ 열어 두었던 리포트가 학원 저장소에 없습니다':'☁ '+e.message+' — 눌러서 다시 시도');
    $$('sbar').onclick=e.status===404||e.status===403?triggerLoad:()=>cloudResume();
    if(!hadLocal)checkRecovery(); // 이 기기 백업으로 이어하기는 그대로 가능
    return;
  }
  if(hadLocal){
    const k=await _cloudAsk('학원 저장소 리포트 열기',
      `이 기기에서 작업한 내용이 화면에 있습니다.<br>학원 저장소의 「<b>${esc(doc.title)}</b>」(${esc(_fmtTime(doc.updatedAt))} · ${esc(_shortEmail(doc.updatedBy))})와 어떻게 할까요?`,
      [{key:'server',label:'학원 저장소 버전 열기 (화면의 작업은 사라짐)',cls:'btn-p'},
       {key:'mine',label:'화면의 작업으로 이 리포트 덮어쓰기'},
       {key:'keep',label:'연결하지 않고 이 기기에서 계속'}]);
    if(k==='server'){_cloudBind(doc);_cloudApply(doc.data);_cloudShow(sel);saveAppDataNow();}
    else if(k==='mine'){_cloudBind(doc);_cloudBar();CLOUD.dirty=true;markUnsaved();_cloudSave(true);}
    else{if(k==='keep')_lsSet(CLOUD_LS.book,null);_localBar();}
    return;
  }
  // 이 기기 백업이 이 리포트의 '못 올린 변경'인지 확인
  let snap=null;try{snap=await dbGet('appData');}catch(e){}
  const local=snap&&snap.cloud&&snap.cloud.id===b.id&&snap.unsaved?snap:null;
  let src=doc.data,force=false,useLocal=false;
  if(local){
    if(Number(local.cloud.rev)===Number(doc.rev))useLocal=true; // 그 사이 아무도 저장 안 함 → 이어서 올림
    else{
      const k=await _cloudAsk('⚠ 저장 충돌',
        `이 기기에 학원 저장소로 못 올린 변경이 있는데, 그 사이 <b>${esc(_shortEmail(doc.updatedBy)||'다른 곳')}</b>에서 먼저 저장했습니다 (${esc(_fmtTime(doc.updatedAt))}).`,
        [{key:'server',label:'학원 저장소 버전 열기 (이 기기 변경 버림)',cls:'btn-p'},
         {key:'local',label:'이 기기 버전으로 덮어쓰기'}]);
      if(!k){setBar('err','☁ 불러오기를 취소했습니다 — 눌러서 다시');$$('sbar').onclick=()=>cloudResume();checkRecovery();return;}
      useLocal=force=k==='local';
    }
    if(useLocal)src=local;
  }
  _cloudBind(doc);
  _cloudApply(src);
  _cloudShow(useLocal?local:sel);
  if(useLocal){CLOUD.dirty=true;markUnsaved();_cloudSave(force);toast('이 기기에서 못 올린 변경을 이어서 저장합니다');}
  else saveAppDataNow();
}

// ─── 자동 저장 ───
function cloudOnChange(){ // session.js saveAppData()에서 호출 — 데이터가 바뀔 때마다
  if(!CLOUD.book)return;
  CLOUD.dirty=true;_cloudStatus();
  if(CLOUD.saving)CLOUD.again=true;else _cloudSchedule(1500);
}
function _cloudSchedule(ms){clearTimeout(CLOUD.timer);CLOUD.timer=setTimeout(()=>{CLOUD.timer=null;_cloudSave();},ms);}
async function _cloudSave(force){
  const b=CLOUD.book;
  if(!b||!cloudSignedIn()||(CLOUD.conflict&&!force))return;
  if(CLOUD.saving){CLOUD.again=true;return;}
  if(!CLOUD.dirty&&!force)return;
  clearTimeout(CLOUD.timer);CLOUD.timer=null;
  CLOUD.saving=true;CLOUD.again=false;CLOUD.dirty=false;CLOUD.conflict=null;_cloudStatus();
  try{
    const r=await _ws('report',{method:'PUT',query:{id:b.id},body:{baseRev:b.rev,force:!!force,data:_cloudPayload()}});
    if(CLOUD.book===b){b.rev=r.rev;b.updatedAt=r.updatedAt;_lsSet(CLOUD_LS.book,{...b,tenant:CLOUD.tenant});}
    CLOUD.retry=0;
    if(CLOUD.book===b&&!CLOUD.dirty&&!CLOUD.again){markSaved();saveAppDataNow();} // 백업에도 새 저장본·저장됨 반영
  }catch(e){
    if(CLOUD.book===b){
      CLOUD.dirty=true;
      if(e.status===409){CLOUD.conflict=e.data||{};setTimeout(_cloudConflict,0);}
      else if(e.status===401){/* 로그인 만료 — 다시 로그인하면 이어서 저장 */}
      else if(e.status===404){toast('이 리포트가 학원 저장소에서 삭제됐습니다 — 💾로 엑셀 백업하거나 새로 올려 주세요');cloudDetach();markUnsaved();_localBar();}
      else if(e.status===403||e.status===413)toast(e.message);
      else{CLOUD.retry=Math.min(CLOUD.retry+1,6);_cloudSchedule(Math.min(60000,2000*2**CLOUD.retry));}
    }
  }finally{
    CLOUD.saving=false;_cloudStatus();
    if(CLOUD.book===b&&CLOUD.again&&!CLOUD.conflict)_cloudSchedule(400);
  }
}
// Ctrl+S (학원 저장소 리포트를 열어 둔 경우) — 바로 저장
async function cloudSaveNow(){
  if(!CLOUD.book)return false;
  if(CLOUD.conflict){_cloudConflict();return false;}
  if(!cloudSignedIn()){openCloudModal();return false;}
  for(let i=0;i<50&&CLOUD.saving;i++)await new Promise(r=>setTimeout(r,100));
  if(!CLOUD.dirty){toast('학원 저장소에 저장되어 있습니다');return true;}
  await _cloudSave();
  if(!cloudIsDirty())toast('학원 저장소에 저장했습니다');
  return !cloudIsDirty();
}
async function _cloudConflict(){
  if(!CLOUD.book||!CLOUD.conflict||document.querySelector('.stu-modal-overlay[data-type="cloud-ask"]'))return;
  const c=CLOUD.conflict;
  const k=await _cloudAsk('⚠ 저장 충돌',
    `이 리포트를 <b>${esc(_shortEmail(c.updatedBy)||'다른 곳')}</b>에서 먼저 저장했습니다 (${esc(_fmtTime(c.updatedAt))}).<br>어느 쪽으로 맞출까요?`,
    [{key:'server',label:'학원 저장소 버전 불러오기 (내 변경 버림)',cls:'btn-p'},
     {key:'mine',label:'내 버전으로 덮어쓰기'},
     {key:'excel',label:'내 버전을 엑셀로 먼저 받아두기'}]);
  if(k==='excel'){await saveToExcel();CLOUD.dirty=true;return _cloudConflict();}
  if(k==='server'){
    const sel={selDate:G.selDate,selStudent:G.selStudent};
    try{const doc=await _ws('report',{query:{id:CLOUD.book.id}});_cloudBind(doc);_cloudApply(doc.data);_cloudShow(sel);saveAppDataNow();toast('학원 저장소 버전을 불러왔습니다');}
    catch(e){toast(e.message);}
  }else if(k==='mine'){CLOUD.dirty=true;_cloudSave(true);}
  _cloudStatus();
}
function _cloudStatus(){
  const nb=$$('btnNote');if(nb)nb.style.display=cloudSignedIn()&&CLOUD.tenant?'':'none'; // 로그인하면 문제 노트로 바로 가기
  const el=$$('cloudStatus');if(!el)return;
  if(!CLOUD.book){el.style.display='none';return;}
  let t,c='';
  if(CLOUD.conflict){t='⚠ 저장 충돌 — 눌러서 해결';c='err';}
  else if(!cloudSignedIn()){t='⚠ 로그인 필요 — 저장 멈춤';c='err';}
  else if(CLOUD.saving)t='☁ 저장 중…';
  else if(CLOUD.dirty){t=CLOUD.retry?'⚠ 저장 실패 — 다시 시도 중':'☁ 저장 대기';if(CLOUD.retry)c='err';}
  else{t='☁ 저장됨 '+_fmtTime(CLOUD.book.updatedAt,true);c='ok';}
  el.textContent=t;el.className='cloud-status '+c;el.style.display='';
}
function cloudStatusClick(){if(CLOUD.conflict)_cloudConflict();else openCloudModal();}

// 버튼 몇 개로 고르는 작은 창 — 고른 key, 닫으면(ESC 등) null
function _cloudAsk(title,msgHtml,buttons){
  return new Promise(res=>{
    document.querySelector('.stu-modal-overlay[data-type="cloud-ask"]')?.remove();
    const ov=document.createElement('div');ov.className='stu-modal-overlay';ov.dataset.type='cloud-ask';
    ov.innerHTML=`<div class="stu-modal"><div class="stu-modal-header"><span class="stu-modal-title">${esc(title)}</span></div>
      <div class="stu-modal-body"><div class="cloud-msg">${msgHtml}</div>
      ${buttons.map(b=>`<button class="${b.cls||'btn-s'} cloud-ask-btn" data-k="${esc(b.key)}">${esc(b.label)}</button>`).join('')}</div></div>`;
    let done=false;
    const finish=k=>{if(done)return;done=true;obs.disconnect();ov.remove();res(k);};
    const obs=new MutationObserver(()=>{if(!ov.isConnected)finish(null);});
    ov.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>finish(b.dataset.k));
    document.body.appendChild(ov);
    obs.observe(document.body,{childList:true});
  });
}

// ─── 학원 저장소 창 ───
function openCloudModal(){
  if(typeof _closeHoverMenus==='function')_closeHoverMenus();
  let ov=document.querySelector('.stu-modal-overlay[data-type="cloud"]');
  if(!ov){
    ov=document.createElement('div');ov.className='stu-modal-overlay';ov.dataset.type='cloud';
    ov.innerHTML=`<div class="stu-modal cloud-modal"><div class="stu-modal-header"><span class="stu-modal-title">☁ 학원 저장소</span>
      <button class="ms-close" onclick="_closeCloudModal()">✕</button></div><div class="stu-modal-body" id="cloudBody"></div></div>`;
    ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
    document.body.appendChild(ov);
  }
  _renderCloudModal();
  if(cloudSignedIn()){_loadBooks();cloudLoadNotes();}
}
function _closeCloudModal(){document.querySelector('.stu-modal-overlay[data-type="cloud"]')?.remove();}
async function _loadBooks(){
  if(!cloudSignedIn()||!CLOUD.tenant)return;
  try{const d=await _ws('reports');CLOUD.books=d.items||[];}
  catch(e){CLOUD.books={error:e.message};}
  _renderCloudModal();
}
function _defaultTitle(){
  if(CLOUD.book)return CLOUD.book.title+' 복사본';
  return String(G.excelFileName||'').replace(/\.xlsx?$/i,'')||'학습 리포트';
}
function _renderCloudModal(){
  const body=$$('cloudBody');if(!body)return;
  if(!cloudSignedIn()){
    body.innerHTML=`<div class="cloud-intro">학원에 등록된 <b>구글 계정</b>으로 로그인하면 리포트를 학원 저장소에 저장해 <b>다른 컴퓨터·다른 선생님</b>과 함께 쓰고, 문제 노트에서 낸 숙제를 채점해 <b>틀린 문제를 학생별 다음 과제(오답 다시 풀기)</b>로 이어 줍니다.</div>
      ${CLOUD.expired?'<div class="cloud-warn">로그인이 만료됐습니다 — 다시 로그인하면 멈춘 저장을 이어서 합니다.</div>':''}
      <div id="cloudGoogleBtn" class="cloud-gbtn"></div>
      <div id="cloudLoginMsg" class="cloud-hint"></div>
      <div class="cloud-hint">로그인하지 않아도 지금처럼 엑셀 파일로 쓸 수 있습니다.</div>`;
    _renderGoogleBtn($$('cloudGoogleBtn'));
    return;
  }
  const u=CLOUD.auth.user||{},ts=CLOUD.auth.tenants||[];
  const tenantSel=ts.length>1
    ?`<select onchange="cloudChangeTenant(this.value)">${ts.map(t=>`<option value="${esc(t.path)}"${t.path===CLOUD.tenant?' selected':''}>${esc(t.name||t.path)}</option>`).join('')}</select>`
    :`<b>${esc(ts[0]?.name||CLOUD.tenant)}</b>`;
  const bk=CLOUD.books;
  const list=bk==null?'<div class="cloud-hint">리포트 목록을 불러오는 중…</div>'
    :bk.error?`<div class="cloud-err">${esc(bk.error)}</div>`
    :!bk.length?'<div class="cloud-hint">아직 학원 저장소에 리포트가 없습니다. 아래에서 지금 작업을 올려 보세요.</div>'
    :bk.map(b=>{const on=CLOUD.book?.id===b.id;return`<div class="cloud-book${on?' on':''}">
        <div class="cloud-book-main"><div class="cloud-book-title">${esc(b.title)}${on?' <span class="ab">열려 있음</span>':''}</div>
        <div class="cloud-book-meta">학생 ${(b.students||[]).length}명 · 수업 ${Number(b.lessons)||0}회 · ${esc(_fmtTime(b.updatedAt))} ${esc(_shortEmail(b.updatedBy))}</div></div>
        ${on?'':`<button class="cloud-mini-btn" data-open="${esc(b.id)}">열기</button>`}
        <button class="cloud-mini-btn danger" data-del="${esc(b.id)}" title="학원 저장소에서 삭제">🗑</button></div>`;}).join('');
  const hasData=G.lessons.length||G.students.length;
  body.innerHTML=`<div class="cloud-who"><span>${esc(u.email||'')}</span>${tenantSel}<button class="cloud-mini-btn" onclick="openNoteApp()" title="문제 노트(mathpro.app)를 같은 계정·학원으로 열기">📘 문제 노트 ↗</button><button class="cloud-mini-btn" onclick="cloudSignOut()">로그아웃</button></div>
    <div class="cloud-sec-title">학원 리포트</div><div class="cloud-books">${list}</div>
    <button class="btn-s cloud-wide" onclick="$$('cloudExcelInput').click()">📂 엑셀 파일을 학원 저장소에 올리기</button>
    <input type="file" id="cloudExcelInput" accept=".xlsx,.xls" style="display:none" onchange="cloudUploadExcel(this)">
    <div class="cloud-sec-title">${CLOUD.book?'지금 화면을 복사본으로 올리기':'지금 작업을 학원 저장소에 올리기'}</div>
    <div class="cloud-new"><input type="text" id="cloudNewTitle" maxlength="100" placeholder="리포트 이름 (예: 고2 A반 2학기)" value="${esc(_defaultTitle())}">
      <button class="btn-p cloud-new-btn" onclick="cloudUploadCurrent()"${hasData?'':' disabled'}>☁ 올리기</button></div>
    <button class="btn-s cloud-wide" onclick="cloudCreateBlank()">＋ 빈 리포트 새로 만들기</button>
    ${CLOUD.book?'<button class="btn-s cloud-wide" onclick="cloudDisconnect()">연결 끊고 이 기기에서만 작업하기</button>':''}
    <div class="cloud-hint">열어 둔 리포트는 편집할 때마다 자동으로 저장되고, 같은 학원 선생님과 함께 씁니다. 💾 저장은 엑셀 백업 파일을 내려받습니다.</div>`;
  body.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>cloudOpenBook(b.dataset.open));
  body.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>cloudDeleteBook(b.dataset.del));
}
async function cloudOpenBook(id){
  if(CLOUD.book?.id===id){_closeCloudModal();return;}
  if(!CLOUD.book&&G.unsaved&&(G.lessons.length||G.students.length)&&!confirm('엑셀에 저장하지 않은 현재 작업이 있습니다.\n학원 저장소의 리포트를 열면 지금 화면의 작업은 사라집니다. 계속할까요?'))return;
  if(CLOUD.book&&cloudIsDirty()){
    await cloudSaveNow();
    if(cloudIsDirty()&&!confirm('지금 리포트의 변경을 학원 저장소에 저장하지 못했습니다.\n그래도 다른 리포트를 열까요? (저장 못 한 변경은 사라집니다)'))return;
  }
  let doc;
  try{doc=await _ws('report',{query:{id}});}catch(e){toast(e.message);return;}
  _cloudBind(doc);_cloudApply(doc.data);_cloudShow(null);saveAppDataNow();
  _closeCloudModal();
  toast(`「${doc.title}」 리포트를 열었습니다`);
}
async function cloudUploadCurrent(){
  if(!G.lessons.length&&!G.students.length){toast('올릴 데이터가 없습니다 — 엑셀을 불러오거나 직접 시작해 주세요');return;}
  const title=($$('cloudNewTitle')?.value||'').trim()||_defaultTitle();
  if(G.selStudent&&G.selDate)saveTabData();
  try{
    const r=await _ws('report',{method:'POST',body:{title,data:_cloudPayload()}});
    _cloudBind({id:r.id,title,rev:r.rev,updatedAt:r.updatedAt});
    markSaved();saveAppDataNow();_cloudBar();
    toast(`「${title}」을(를) 학원 저장소에 올렸습니다 — 이제 자동으로 저장됩니다`);
    CLOUD.books=null;_renderCloudModal();_loadBooks();
  }catch(e){toast(e.message);}
}
async function cloudCreateBlank(){
  if((G.lessons.length||G.students.length)&&(G.unsaved||cloudIsDirty())&&!confirm('저장하지 않은 현재 작업이 있습니다.\n빈 리포트를 새로 만들면 지금 화면의 작업은 사라집니다. 계속할까요?'))return;
  const title=(prompt('새 리포트 이름',CLOUD.book?'':_defaultTitle())||'').trim();
  if(!title)return;
  _clearAllData(); // 화면 비우기 (지금 리포트와의 연결도 끊김)
  try{
    const r=await _ws('report',{method:'POST',body:{title,data:_cloudPayload()}});
    _cloudBind({id:r.id,title,rev:r.rev,updatedAt:r.updatedAt});
  }catch(e){toast(e.message);return;}
  zeroStart();_cloudBar();
  _closeCloudModal();
  toast(`「${title}」 리포트를 만들었습니다 — 수업 진도부터 설정해 주세요`);
}
async function cloudDeleteBook(id){
  const b=(Array.isArray(CLOUD.books)?CLOUD.books:[]).find(x=>x.id===id);
  if(!confirm(`학원 저장소에서 「${b?.title||'리포트'}」를 지울까요?\n같은 학원 선생님 모두에게서 사라집니다. (운영자에게 요청하면 복구할 수 있습니다)`))return;
  try{await _ws('report',{method:'DELETE',query:{id}});}catch(e){toast(e.message);return;}
  if(CLOUD.book?.id===id){cloudDetach();markUnsaved();_localBar();saveAppDataNow();}
  CLOUD.books=null;_renderCloudModal();_loadBooks();
}

// ─── 엑셀 파일을 곧바로 학원 저장소에 올리기 ───
async function cloudUploadExcel(input){
  const file=input.files[0];input.value='';if(!file)return;
  if(!cloudSignedIn()){openCloudModal();return;}
  const rb=$$('recoverBanner'),pendingBackup=rb&&rb.style.display!=='none'&&rb._snap?.unsaved;
  if((G.unsaved||pendingBackup||cloudIsDirty())&&!confirm('저장하지 않은 현재 작업이 있습니다.\n엑셀 파일을 올려 열면 지금 화면의 작업은 사라집니다. 계속할까요?'))return;
  setBar('wait','⏳ 엑셀을 읽는 중…');
  const backup={};DATA_KEYS.forEach(k=>{backup[k]=G[k];});
  try{parseWB(XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false,raw:false}));}
  catch(e){DATA_KEYS.forEach(k=>{G[k]=backup[k];});setBar('err','❌ 엑셀을 읽지 못했습니다: '+e.message);return;}
  cloudDetach();
  G.excelFileName=file.name.replace(/\.xls$/i,'.xlsx');
  G.tabData={};G.pendingPropagations=[];G.studentPdfs={};G.pdfCanvases=[];
  G.hwItems=[];G.hwStatus=[];G.hwItemRefs=[];G.extraHw=[];G.hwRateManual=null;
  if(!G.students.includes(G.selStudent))G.selStudent='';
  const title=file.name.replace(/\.xlsx?$/i,'')||'학습 리포트';
  try{
    const r=await _ws('report',{method:'POST',body:{title,data:_cloudPayload()}});
    _cloudBind({id:r.id,title,rev:r.rev,updatedAt:r.updatedAt});
  }catch(e){
    applyViewSettings();showGroups();markUnsaved();saveAppDataNow();_localBar();
    toast('엑셀은 열었지만 학원 저장소에 올리지 못했습니다: '+e.message);return;
  }
  applyViewSettings();showGroups();markSaved();saveAppDataNow();_cloudBar();
  CLOUD.books=null;_renderCloudModal();_loadBooks();cloudLoadNotes();
  toast(`「${title}」을(를) 학원 저장소에 올렸습니다 — 이제 자동으로 저장됩니다`);
}

// ─── 앱 사이 이동 (학습 리포트 ↔ 문제 노트) ───
// 로그인돼 있으면 2분짜리 넘김 코드를 받아 주소의 # 뒤에 붙여 연다 (서버 로그에 남지 않음)
async function openNoteApp(go){
  const win=window.open('about:blank','_blank');
  let url=cloudApiBase()+'/';
  const parts=[];
  if(cloudSignedIn()&&CLOUD.tenant){
    url=`${cloudApiBase()}/${CLOUD.tenant}`;
    try{const d=await _cloudFetch('/api/auth/handoff',{method:'POST'});if(d.code)parts.push(`mph=${encodeURIComponent(d.code)}`);}catch(e){}
  }
  // 갈 곳: 'classroom'(숙제·채점) · 'student:이름'(그 학생 오답·기록) — 문제 노트가 # 을 읽고 바로 지운다
  if(typeof go==='string'&&go)parts.push(`go=${encodeURIComponent(go)}`);
  if(parts.length)url+='#'+parts.join('&');
  if(win){try{win.opener=null;}catch(e){}win.location.href=url;}else location.href=url; // 새 탭이 이 탭을 조작하지 못하게
}
async function _cloudConsumeHandoff(){
  const h=location.hash||'';
  const m=/[#&]mph=([^&]+)/.exec(h);
  const g=/[#&]go=([^&]+)/.exec(h);
  if(!m&&!g)return;
  const t=(/[#&]t=([^&]+)/.exec(h)||[])[1];
  window.history.replaceState(null,'',location.pathname+location.search); // 주소창·방문 기록에서 바로 지움
  // 문제 노트의 '학습 리포트에서 보기' — 그 학생을 골라 연다 (리포트를 불러온 뒤 _cloudApplyGo)
  try{const go=g?decodeURIComponent(g[1]):'';if(go.startsWith('student:'))CLOUD.goStudent=go.slice(8).slice(0,50);}catch(e){}
  if(!m)return;
  try{
    const d=await _cloudFetch('/api/auth/redeem',{method:'POST',body:{code:decodeURIComponent(m[1])},auth:false});
    CLOUD.auth={token:d.token,user:d.user||{},tenants:d.tenants||[]};CLOUD.expired=false;
    _lsSet(CLOUD_LS.auth,CLOUD.auth);
    const has=p=>!!p&&CLOUD.auth.tenants.some(x=>x.path===p);
    const want=t?decodeURIComponent(t):'';
    const next=has(want)?want:has(CLOUD.tenant)?CLOUD.tenant:(CLOUD.auth.tenants[0]?.path||'');
    if(next!==CLOUD.tenant){CLOUD.tenant=next;_lsSet(CLOUD_LS.tenant,next);}
    toast(`${d.user?.email||''} 계정으로 이어서 로그인했습니다`);
  }catch(e){toast('로그인을 이어받지 못했습니다 — ☁ 학원 저장소에서 로그인해 주세요');}
}
// 넘어온 학생 선택 적용 — 리포트가 화면에 올라온 뒤 (학생이 이 리포트에 있을 때만)
function _cloudApplyGo(){
  const s=CLOUD.goStudent;if(!s)return;
  if(!G.students.length||!G.selDate)return;
  CLOUD.goStudent='';
  if(G.students.includes(s)&&G.selStudent!==s)switchTab(s);
}

// ─── 숙제 채점 · 오답 다시 풀기 — 공통 규칙 (문제 노트 note-pro src/lib/classroomRules.js 와 한 벌, 고치면 둘 다) ───
// 기록 h = [[날짜, 'o'|'x', 숙제 id?], …] (날짜순). 기록이 없으면 '안 풂'. 서버: 같은 날짜·숙제는 덮어쓰고 '-' 는 지운다.
//  · 상태: x 가 없으면 맞음 · 마지막 x = 틀림 · 틀린 뒤 다른 날 1번 맞힘 = 확인 중 · 다른 날 2번 맞힘 = 해결.
//    오답 = 틀림 + 확인 중 (한 번 맞히고 바로 빼면 오래 기억 못 한다 — 두 번 연속으로 확인).
//  · 숙제: 나눠 주는 수업 = 숙제 날짜 당일 또는 그 뒤 첫 수업, 검사하는 수업 = 그다음 수업
//    (검사일을 정했으면 그날 또는 그 뒤 첫 수업). 안 해 오면(안 해 옴) 해 올 때까지 다음 수업으로 이월.
//  · 오답 다시 풀기: 수업 L 의 '다음 수업까지 과제' = L 까지 오답 전부(학생마다 다름),
//    수업 L 에서 검사 = 바로 전 수업까지 오답이었고 L 전날까지도 오답인 문제.
const NOTE_SOLVE_STREAK=2,NOTE_HELP_AFTER=3;
function _nStatus(h){
  if(!Array.isArray(h)||!h.length)return'none';
  let lx=-1;for(let i=h.length-1;i>=0;i--)if(h[i][1]==='x'){lx=i;break;}
  if(lx<0)return'correct';
  if(lx===h.length-1)return'wrong';
  const days=new Set();for(let i=lx+1;i<h.length;i++)if(h[i][1]==='o'&&h[i][0]!==h[lx][0])days.add(h[i][0]);
  return days.size>=NOTE_SOLVE_STREAK?'fixed':'checking';
}
const _nPending=st=>st==='wrong'||st==='checking';
const _nUpto=(h,d)=>_nStatus(Array.isArray(h)?h.filter(e=>e[0]<=d):[]);
const _nBefore=(h,d)=>_nStatus(Array.isArray(h)?h.filter(e=>e[0]<d):[]);
const _wrongCount=h=>Array.isArray(h)?h.filter(e=>e[1]==='x').length:0;
const _needsHelp=h=>_wrongCount(h)>=NOTE_HELP_AFTER;
function _entryOn(h,date,hw){return(Array.isArray(h)&&h.find(x=>x[0]===date&&(x[2]||'')===(hw||'')))||null;}
function _lastMarkFor(h,hw){if(!Array.isArray(h))return null;for(let i=h.length-1;i>=0;i--)if((h[i][2]||'')===hw)return h[i];return null;}
const _onOrAfter=(ds,d)=>ds.find(x=>x>=d)||'';
const _after=(ds,d)=>ds.find(x=>x>d)||'';
function _before(ds,d){let o='';for(const x of ds){if(x<d)o=x;else break;}return o;}
const _hwGiven=(hw,ds)=>_onOrAfter(ds,hw.date)||hw.date;
const _hwCheck=(hw,ds)=>hw.due?(_onOrAfter(ds,hw.due)||hw.due):_after(ds,_hwGiven(hw,ds));

// ─── 숙제 · 학생별 기록 (학원 단위, 이 기기에 캐시) ───
const _recItems=student=>CLOUD.notes.recs?.[student]?.items||{};
const _recMissing=student=>CLOUD.notes.recs?.[student]?.missing||{};
const _recOf=student=>CLOUD.notes.recs[student]||(CLOUD.notes.recs[student]={items:{},missing:{}}); // 늘 지금 캐시의 객체
const _notesOn=()=>cloudSignedIn()&&!!CLOUD.notes.tenant&&CLOUD.notes.tenant===CLOUD.tenant;
const _lessonDates=()=>G.lessons.map(l=>l.날짜).filter(Boolean).sort();

async function cloudLoadNotes(){
  if(!cloudSignedIn()||!CLOUD.tenant)return;
  CLOUD.notesAt=Date.now();
  const tenant=CLOUD.tenant;
  try{
    const d=await _ws('homework');
    if(tenant!==CLOUD.tenant)return;
    const homework=d.items||[];
    const recs=CLOUD.notes.tenant===tenant?{...CLOUD.notes.recs}:{};
    CLOUD.notes={tenant,homework,recs,at:new Date().toISOString()};
    // 이 리포트 학생 전원의 문제 기록 — 숙제 채점·오답 다시 풀기·리포트 표시 (40명씩 한 번에)
    await _fetchRecsMany(G.students.slice());
    _lsSet(CLOUD_LS.notes,CLOUD.notes);
  }catch(e){if(!e.network&&e.status!==401)console.warn('숙제 불러오기 실패:',e);}
  _refreshNoteViews();
}
async function _fetchRecsMany(students){
  const list=[...new Set(students.filter(Boolean))];
  for(let i=0;i<list.length;i+=40){
    const url=new URL(cloudApiBase()+'/api/workspace/records');
    url.searchParams.set('tenant',CLOUD.tenant);url.searchParams.set('many','1');
    list.slice(i,i+40).forEach(s=>url.searchParams.append('student',s));
    let d;
    try{
      const r=await fetch(url,{headers:{Authorization:'Bearer '+(CLOUD.auth?.token||'')},cache:'no-store'});
      if(r.status===401){_cloudExpired();return;}
      if(!r.ok)continue;
      d=await r.json();
    }catch(e){continue;}
    // 예전 서버(여러 명 한 번에 받기 전)는 students 없이 한 명 형식으로 답한다 → 한 명씩 받기
    if(!d.students){await Promise.all(list.slice(i,i+40).map(s=>_fetchRecs(s)));continue;}
    Object.entries(d.students).forEach(([s,rec])=>{
      if(!CLOUD.markBusy[s])CLOUD.notes.recs[s]={items:rec.items||{},missing:rec.missing||{}}; // 저장 중인 학생은 화면 값 유지
    });
  }
}
async function _fetchRecs(student,force){
  if(CLOUD.markBusy[student]&&!force)return;
  try{
    const d=await _ws('records',{query:{student}});
    if(force||!CLOUD.markBusy[student])CLOUD.notes.recs[student]={items:d.items||{},missing:d.missing||{}};
  }catch(e){}
  finally{delete CLOUD.recLoading[student];}
}
function _refreshNoteViews(){
  renderNotePanel();
  if(G.selStudent&&G.selDate){
    if(typeof updateNoticeWithCarry==='function')updateNoticeWithCarry();
    if(typeof updateHwDisplay==='function')updateHwDisplay();
    fitReportCard();
  }
  _renderClassGrade();
}

// 학생 한 명 × 숙제 한 개 → 채점 결과
function _hwRes(student,hw){
  const items=_recItems(student);
  const marks={};let marked=0,wrong=0,at='';
  hw.problems.forEach(p=>{const e=_lastMarkFor(items[p.id]?.h,hw.id);if(e){marks[p.id]=e[1];marked++;if(e[1]==='x')wrong++;if(!at||e[0]<at)at=e[0];}});
  const missing=(!marked&&_recMissing(student)[hw.id])||'';
  return{marks,marked,wrong,correct:marked-wrong,total:hw.problems.length,missing,gradedAt:at};
}
const _myHw=student=>_notesOn()?(CLOUD.notes.homework||[]).filter(h=>(h.students||[]).includes(String(student||'').trim())):[];
// 이 수업(date)에 검사할 숙제 — [{hw, carry}] (carry = 안 해 와서 지난 수업에서 넘어온 숙제)
function _hwCheckAt(student,date){
  if(!student||!date)return[];
  const ds=_lessonDates();
  return _myHw(student).map(hw=>{
    const g=_hwGiven(hw,ds),c=_hwCheck(hw,ds);
    if(isHwOff(student,g,'mp:'+hw.id))return null; // 나눠 준 수업에서 이 과제를 꺼 뒀으면 검사도 없음
    if(c===date)return{hw,carry:false};
    if(c&&c<date){const r=_hwRes(student,hw);if(r.missing?!r.marked:r.gradedAt===date)return{hw,carry:true};}
    return null;
  }).filter(Boolean);
}
// 이 수업에 나가는 숙제 — [{hw, carry}] (carry = 안 해 와서 다시 나가는 숙제)
function _hwGivenAt(student,date){
  if(!student||!date)return[];
  const ds=_lessonDates();
  return _myHw(student).map(hw=>{
    const g=_hwGiven(hw,ds),c=_hwCheck(hw,ds);
    if(g===date)return{hw,carry:false};
    if(c&&c<=date){const r=_hwRes(student,hw);if(r.missing&&!r.marked)return{hw,carry:true};}
    return null;
  }).filter(Boolean);
}
// 문제 순서 — 숙제에 나온 순서(오래된 숙제부터), 모르면 id
function _problemOrder(){
  const o=new Map();let i=0;
  [...(CLOUD.notes.homework||[])].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0).forEach(h=>h.problems.forEach(p=>{if(!o.has(p.id))o.set(p.id,i++);}));
  return(a,b)=>(o.has(a)?o.get(a):1e9)-(o.has(b)?o.get(b):1e9)||(a<b?-1:a>b?1:0);
}
// 이 수업까지 남은 오답 — '다음 수업까지 과제'의 오답 다시 풀기
function _wrongGivenAt(student,date){
  if(!_notesOn()||!student||!date)return[];
  const items=_recItems(student);
  return Object.keys(items).filter(id=>_nPending(_nUpto(items[id].h,date))).sort(_problemOrder());
}
// 이 수업에서 검사할 오답 (지난 수업에 나간 것)
function _wrongCheckAt(student,date){
  if(!_notesOn()||!student||!date)return[];
  const prev=_before(_lessonDates(),date);
  if(!prev||isHwOff(student,prev,'mp:wrong'))return[];
  const items=_recItems(student);
  return Object.keys(items).filter(id=>_nPending(_nBefore(items[id].h,date))&&_nPending(_nUpto(items[id].h,prev))).sort(_problemOrder());
}
// 문제가 마지막으로 나온 숙제 (학생이 받은 종이에서 찾기 쉽게)
function _sourceOf(student,id){
  const h=_recItems(student)[id]?.h||[];
  const byId=new Map((CLOUD.notes.homework||[]).map(x=>[x.id,x]));
  for(let i=h.length-1;i>=0;i--){const hw=h[i][2]&&byId.get(h[i][2]);if(hw){const p=hw.problems.find(x=>x.id===id);if(p)return{hw,p};}}
  for(const hw of CLOUD.notes.homework||[]){const p=hw.problems.find(x=>x.id===id);if(p)return{hw,p};}
  return null;
}
// 칩 이름 "20강 5" · 전체 이름 "20강 순열 학습지 · 20강 5번"
function _chipName(student,id){const s=_sourceOf(student,id);if(!s)return id;return s.p.unit?`${s.p.unit} ${s.p.no}`:`${s.hw.title.slice(0,8)} ${s.p.no||s.p.label}`;}
function _paperName(student,id){const s=_sourceOf(student,id);if(!s)return id;return s.p.unit?`${s.hw.title} · ${s.p.unit} ${s.p.no}번`:`${s.hw.title} ${s.p.no}번`;}
// 학부모 리포트용 짧은 목록 — "20강 2·5번, 21강 3번"
function _wrongSummary(student,ids){
  const groups=[];
  ids.forEach(id=>{
    const s=_sourceOf(student,id);
    const key=s?(s.p.unit||s.hw.title):'';const no=s?String(s.p.no||s.p.label||'').replace(/번$/,''):id;
    let g=groups.find(x=>x.key===key);if(!g){g={key,nos:[]};groups.push(g);}g.nos.push(no);
  });
  const parts=groups.slice(0,3).map(g=>`${g.key?g.key+' ':''}${g.nos.join('·')}번`);
  const shown=groups.slice(0,3).reduce((n,g)=>n+g.nos.length,0);
  return parts.join(', ')+(ids.length>shown?` 외 ${ids.length-shown}문제`:'');
}

// ─── 리포트 연결점 (autofill.js·report.js·domain.js·pdf.js 가 typeof 로 확인 후 부른다) ───
// '다음 수업까지 과제'에 붙는 문제 노트 항목 — [{text, ref}] (ref 로 ON/OFF)
function noteNextItems(student,date){
  if(!_notesOn())return[];
  const out=_hwGivenAt(student,date).map(({hw,carry})=>({text:`${carry?'(이월) ':''}📘 ${hw.title} (${hw.problems.length}문제)`,ref:'mp:'+hw.id}));
  const w=_wrongGivenAt(student,date);
  if(w.length)out.push({text:`📘 오답 다시 풀기 ${w.length}문제 — ${_wrongSummary(student,w)}`,ref:'mp:wrong'});
  return out;
}
// '지난 수업 과제'에 붙는 채점 결과 — [{text, chip, st, sub}] (st: 2 완료 · 0 안 해 옴)
function noteCheckRows(student,date){
  if(!_notesOn()||isAbsent(student,date))return[];
  const rows=[];
  _hwCheckAt(student,date).forEach(({hw,carry})=>{
    const r=_hwRes(student,hw);const t=`${carry?'(이월) ':''}📘 ${hw.title}`;
    if(r.missing&&!r.marked)rows.push({text:t,chip:'안 해 옴',st:0,sub:''});
    else if(r.marked){
      const wrong=hw.problems.filter(p=>r.marks[p.id]==='x').map(p=>p.no||p.label);
      rows.push({text:t,chip:`${r.correct}/${r.total} 맞음`,st:2,sub:wrong.length?`다시 볼 문제 ${wrong.map(n=>String(n).replace(/번$/,'')).join('·')}번`:'다 맞음'});
    }
  });
  const ids=_wrongCheckAt(student,date);
  if(ids.length){
    const items=_recItems(student);const marked=ids.filter(id=>_entryOn(items[id]?.h,date,''));
    if(marked.length){
      const ok=marked.filter(id=>_entryOn(items[id].h,date,'')[1]==='o').length;
      rows.push({text:'📘 오답 다시 풀기',chip:`${ok}/${ids.length} 맞음`,st:2,sub:ok<ids.length?'또 틀린 문제는 다음 과제로 다시 나가요':''});
    }
  }
  return rows;
}
// 수업 일지표용 — 이 날짜에 검사한 문제 노트 숙제별로 많이 틀린 문제 [{title, top:[[번호, 명]]}] (결석 제외)
function noteWrongTally(date){
  if(!_notesOn())return[];
  const by=new Map();
  G.students.forEach(s=>{
    if(isAbsent(s,date))return;
    _hwCheckAt(s,date).forEach(({hw})=>{
      const r=_hwRes(s,hw);if(!r.marked)return;
      if(!by.has(hw.id))by.set(hw.id,{title:hw.title,cnt:new Map(),order:hw.problems.map(p=>p.id),names:new Map(hw.problems.map(p=>[p.id,p.unit?`${p.unit} ${p.no}`:(p.no||p.label)]))});
      const g=by.get(hw.id);
      hw.problems.forEach(p=>{if(r.marks[p.id]==='x')g.cnt.set(p.id,(g.cnt.get(p.id)||0)+1);});
    });
  });
  return[...by.values()].filter(g=>g.cnt.size).map(g=>({title:g.title,top:[...g.cnt].sort((a,b)=>b[1]-a[1]||g.order.indexOf(a[0])-g.order.indexOf(b[0])).slice(0,8).map(([id,c])=>[g.names.get(id)||id,c])}));
}
// 일괄 출력 전 점검용 — 검사할 숙제를 아직 채점하지도, 안 해 옴으로 표시하지도 않은 학생
function noteUngradedNames(date,students){
  if(!_notesOn())return[];
  return students.filter(s=>_hwCheckAt(s,date).some(({hw})=>{const r=_hwRes(s,hw);return!r.marked&&!r.missing;}));
}

// ─── 패널: 문제 노트 숙제 채점 카드 (학생 한 명) ───
function renderNotePanel(){
  const card=$$('noteHwCard');
  const btn=$$('btnClassGrade');
  if(btn){const any=_notesOn()&&G.selDate&&G.students.some(s=>_hwCheckAt(s,G.selDate).length||_wrongCheckAt(s,G.selDate).length);btn.style.display=any?'':'none';}
  if(!card)return;
  const st=G.selStudent,date=G.selDate;
  const list=_notesOn()?_hwCheckAt(st,date):[];
  const wrongIds=_notesOn()?_wrongCheckAt(st,date):[];
  const given=_notesOn()?_hwGivenAt(st,date).filter(x=>!x.carry):[];
  if(!list.length&&!wrongIds.length&&!given.length){card.style.display='none';card.innerHTML='';return;}
  card.style.display='';
  const hints=[];
  if(isAbsent(st,date))hints.push('결석한 날은 리포트에 표시되지 않습니다 — 해 오면 다음 수업에 채점하세요');
  const body=list.map(_hwHtml).join('')+(wrongIds.length?_wrongHtml(st,date,wrongIds):'');
  const next=given.length?`<div class="label-hint note-hint">오늘 나간 숙제: ${given.map(x=>'📘 '+esc(x.hw.title)).join(', ')} → 다음 수업에 여기서 채점해요</div>`:'';
  // 머리글은 label 이 아니라 div — label 안의 버튼은 제목 글자를 눌러도 눌린다
  card.innerHTML=`<div class="cg"><div class="note-head">📘 문제 노트 숙제 채점 <span class="ab">자동</span>
    <button class="note-refresh" data-act="refresh" title="문제 노트·다른 선생님이 채점한 것까지 새로 받기" aria-label="새로 받기">↻</button>
    <button class="note-link" data-act="note" title="이 학생의 오답·기록을 문제 노트에서 보고 오답 노트를 인쇄해요">문제 노트 ↗</button></div>
    ${body}${next}${hints.map(h=>`<div class="label-hint note-hint">${esc(h)}</div>`).join('')}</div>`;
  card.onclick=e=>_noteClick(e,st,date);
}
function _hwHtml({hw,carry}){
  const st=G.selStudent,items=_recItems(st),r=_hwRes(st,hw);
  const done=r.marked,left=r.total-done;
  const badge=r.missing&&!done?'<span class="note-st bad">안 해 옴</span>':!done?'<span class="note-st">미채점</span>':r.wrong?`<span class="note-st bad">틀림 ${r.wrong}</span>`:left?'<span class="note-st">채점 중</span>':'<span class="note-st good">모두 맞음</span>';
  const saving=CLOUD.markBusy[st]?'<span class="label-hint">저장 중…</span>':'';
  const id=esc(hw.id);
  const btns=!done&&!r.missing
    ?`<button class="note-mini-btn" data-hw="${id}" data-act="all">모두 맞음</button><button class="note-mini-btn" data-hw="${id}" data-act="allx">모두 틀림</button><button class="note-mini-btn" data-hw="${id}" data-act="miss">안 해 옴</button>`
    :`${done&&left?`<button class="note-mini-btn" data-hw="${id}" data-act="rest">나머지 ${left}문제 맞음</button>`:''}<button class="note-mini-btn" data-hw="${id}" data-act="clear">채점 지우기</button>`;
  const groups=[];
  hw.problems.forEach(p=>{const u=p.unit||'';let g=groups[groups.length-1];if(!g||g.unit!==u){g={unit:u,items:[]};groups.push(g);}g.items.push(p);});
  const chips=groups.map(g=>`<div class="note-unit-row">${g.unit?`<span class="note-unit">${esc(g.unit)}</span>`:''}${g.items.map(p=>{
    const m=r.marks[p.id],h=items[p.id]?.h,w=_wrongCount(h);
    return`<button class="note-chip${m==='x'?' wrong':m==='o'?' right':''}${r.missing&&!done?' dim':''}" data-hw="${id}" data-np="${esc(p.id)}" title="${esc(p.label||p.id)}${w?` · 지금까지 ${w}번 틀림`:''}${_needsHelp(h)?' · 설명 필요':''}">${esc(p.no||p.label||p.id)}${w>1?`<span class="note-badge">${w}</span>`:''}${_needsHelp(h)?'<span class="note-help"></span>':''}</button>`;}).join('')}</div>`).join('');
  const hint=r.missing&&!done?`<div class="label-hint">안 해 옴 (${esc(r.missing)}) — 다음 수업까지 이월돼요. 해 오면 번호를 눌러 채점하세요</div>`
    :done?'<div class="label-hint">누를 때마다 맞음↔틀림 · 틀린 문제는 오답 다시 풀기로 다음 과제에 붙어요</div>'
    :'<div class="label-hint">틀린 문제만 누르세요 — 나머지는 맞음으로 저장돼요</div>';
  return`<div class="note-asg"><div class="note-asg-head"><span class="note-asg-title">${carry?'<span class="carry-tag">(이월)</span> ':''}${esc(hw.title||'숙제')}</span><span class="label-hint">${esc(shortD(hw.date))} 낸 숙제 · ${hw.problems.length}문제</span>${badge}${saving}
    <span class="note-asg-btns">${btns}</span></div>${chips}${hint}</div>`;
}
function _wrongHtml(st,date,ids){
  const items=_recItems(st);
  const marked=ids.filter(id=>_entryOn(items[id]?.h,date,''));
  const bad=marked.filter(id=>_entryOn(items[id].h,date,'')[1]==='x').length;
  const badge=!marked.length?'<span class="note-st">미채점</span>':bad?`<span class="note-st bad">또 틀림 ${bad}</span>`:'<span class="note-st good">모두 맞음</span>';
  const btns=!marked.length?'<button class="note-mini-btn" data-wr="1" data-act="wall">모두 맞음</button>':'<button class="note-mini-btn" data-wr="1" data-act="wclear">채점 지우기</button>';
  const chips=ids.map(id=>{
    const e=_entryOn(items[id]?.h,date,''),h=items[id]?.h,checking=_nBefore(h,date)==='checking';
    return`<button class="note-chip${e?.[1]==='x'?' wrong':e?.[1]==='o'?' right':''}" data-wr="1" data-np="${esc(id)}" title="${esc(_paperName(st,id))} · 지금까지 ${_wrongCount(h)}번 틀림${checking?' · 한 번 맞힘(확인 중)':''}">${esc(_chipName(st,id))}${checking?'<span class="note-ok1">✓1</span>':''}${_needsHelp(h)?'<span class="note-help"></span>':''}</button>`;
  }).join('');
  return`<div class="note-asg note-wrong"><div class="note-asg-head"><span class="note-asg-title">✎ 오답 다시 풀기</span><span class="label-hint">지난 수업에 낸 ${ids.length}문제</span>${badge}<span class="note-asg-btns">${btns}</span></div>
    <div class="note-unit-row">${chips}</div><div class="label-hint">또 틀린 문제만 누르세요 · ✓1 = 한 번 맞힌 문제(다른 날 한 번 더 맞히면 해결) · 주황 점 = 3번 이상 틀림</div></div>`;
}
// 칩·버튼 누름 → 채점 (학생 한 명) — 반 전체 채점 창도 같은 함수를 쓴다
function _noteClick(e,st,date){
  const t=e.target.closest('[data-act],[data-np]');if(!t)return;
  if(t.dataset.act==='refresh'){cloudLoadNotes();return;}
  if(t.dataset.act==='note'){openNoteApp('student:'+st);return;}
  if(t.dataset.act==='classgrade'){openClassGrade();return;}
  st=t.dataset.st||st;
  if(CLOUD.recLoading[st])return;
  const items=_recItems(st);
  if(t.dataset.wr){ // 오답 다시 풀기 (숙제 없음 — 이 수업 날짜의 한 회차)
    const ids=_wrongCheckAt(st,date);
    const markOf=id=>_entryOn(items[id]?.h,date,'')?.[1]||null;
    if(t.dataset.np){
      const id=t.dataset.np;
      if(!ids.some(markOf)){_noteMark(st,'',ids.map(x=>({id:x,r:x===id?'x':'o',date})));return;}
      _noteMark(st,'',[{id,r:markOf(id)==='x'?'o':'x',date}]);
    }else if(t.dataset.act==='wall')_noteMark(st,'',ids.map(x=>({id:x,r:'o',date})));
    else if(t.dataset.act==='wclear'){if(!confirm(`${st} — 오늘 오답 채점을 지울까요?`))return;_noteMark(st,'',ids.filter(markOf).map(x=>({id:x,r:'-',date})));}
    return;
  }
  const hw=(CLOUD.notes.homework||[]).find(x=>x.id===t.dataset.hw);if(!hw)return;
  const lastOf=p=>_lastMarkFor(items[p.id]?.h,hw.id);
  if(t.dataset.np){
    const p=hw.problems.find(x=>x.id===t.dataset.np);if(!p)return;
    // 처음 누르면 누른 문제는 틀림·나머지는 맞음으로 한 번에, 그 뒤로는 맞음↔틀림 (숙제는 학생마다 한 번 채점 — 고치면 그 기록의 날짜로)
    if(!hw.problems.some(q=>lastOf(q))){_noteMark(st,hw.id,hw.problems.map(q=>({id:q.id,r:q.id===p.id?'x':'o',date})));return;}
    const e0=lastOf(p);
    _noteMark(st,hw.id,[{id:p.id,r:e0&&e0[1]==='x'?'o':'x',date:e0?e0[0]:date}]);
  }else if(t.dataset.act==='all')_noteMark(st,hw.id,hw.problems.map(p=>({id:p.id,r:'o',date})));
  else if(t.dataset.act==='allx')_noteMark(st,hw.id,hw.problems.map(p=>({id:p.id,r:'x',date})));
  else if(t.dataset.act==='rest')_noteMark(st,hw.id,hw.problems.filter(p=>!lastOf(p)).map(p=>({id:p.id,r:'o',date})));
  else if(t.dataset.act==='miss')_noteMark(st,hw.id,[],{missing:true,date});
  else if(t.dataset.act==='clear'){
    if(!confirm(`${st} — 「${hw.title}」 채점을 지울까요?`))return;
    _noteMark(st,hw.id,hw.problems.map(p=>[p,lastOf(p)]).filter(x=>x[1]).map(([p,e0])=>({id:p.id,r:'-',date:e0[0]})),{missing:false,date});
  }
}
// 채점 표시 → 화면에 바로 반영하고, 학생마다 한 번에 하나씩 순서대로 서버에 저장
// flag = {missing:true|false, date} — 숙제 '안 해 옴' 표시 (채점하면 저절로 풀림)
function _noteMark(student,hwId,marks,flag){
  if(!marks.length&&!flag)return;
  if(!cloudSignedIn()){openCloudModal();return;}
  const rec=_recOf(student);rec.missing=rec.missing||{};
  let graded=false;
  marks.forEach(({id,r,date})=>{
    const h=(rec.items[id]?.h||[]).filter(e=>!(e[0]===date&&(e[2]||'')===hwId));
    if(r!=='-'){h.push(hwId?[date,r,hwId]:[date,r]);graded=true;}
    h.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
    if(h.length)rec.items[id]={h};else delete rec.items[id];
  });
  if(hwId){if(flag?.missing===true&&!graded)rec.missing[hwId]=flag.date;else if(flag?.missing===false||graded)delete rec.missing[hwId];}
  CLOUD.markBusy[student]=(CLOUD.markBusy[student]||0)+1;
  _refreshNoteViews();
  const byDate={};marks.forEach(m=>{(byDate[m.date]=byDate[m.date]||[]).push({id:m.id,r:m.r});});
  if(!marks.length&&flag)byDate[flag.date]=[];
  CLOUD.markQ[student]=(CLOUD.markQ[student]||Promise.resolve()).then(async()=>{
    try{
      let first=true;
      for(const[date,ms]of Object.entries(byDate)){
        const body={student,date,hw:hwId,marks:ms};
        if(first&&flag&&hwId)body.missing=flag.missing;
        first=false;
        const d=await _ws('records',{method:'POST',body});
        const cur=_recOf(student); // 그 사이 캐시가 바뀌었어도 지금 객체에 반영
        Object.entries(d.items||{}).forEach(([id,r])=>{if(r.h?.length)cur.items[id]=r;else delete cur.items[id];});
        cur.missing=d.missing||{};
      }
    }catch(e){
      toast('채점 저장 실패: '+e.message);
      await _fetchRecs(student,true);
    }finally{
      CLOUD.markBusy[student]=Math.max(0,CLOUD.markBusy[student]-1);
      _lsSet(CLOUD_LS.notes,CLOUD.notes);_refreshNoteViews();
    }
  });
}

// ─── 반 전체 채점 창 — 이 수업 날짜에 검사할 숙제를 학생(줄) × 문제(칸) 한 화면에서 ───
// (학생마다 탭을 옮기지 않고 답안지를 한 장씩 넘기며 채점 — 매쓰플랫·수학대왕과 같은 반 × 숙제 화면)
function openClassGrade(){
  if(!_notesOn()||!G.selDate)return;
  let ov=document.querySelector('.stu-modal-overlay[data-type="classgrade"]');
  if(!ov){
    ov=document.createElement('div');ov.className='stu-modal-overlay';ov.dataset.type='classgrade';
    ov.innerHTML=`<div class="stu-modal cg-modal"><div class="stu-modal-header"><span class="stu-modal-title" id="cgTitle">📘 숙제 채점 (반 전체)</span>
      <button class="ms-close" onclick="_closeClassGrade()">✕</button></div><div class="stu-modal-body" id="cgBody"></div></div>`;
    ov.addEventListener('click',e=>{if(e.target===ov)_closeClassGrade();});
    document.body.appendChild(ov);
  }
  _renderClassGrade();
}
function _closeClassGrade(){
  document.querySelector('.stu-modal-overlay[data-type="classgrade"]')?.remove();
  if(G.selStudent&&G.selDate&&typeof autoFillAll==='function'){renderNotePanel();}
}
function _renderClassGrade(){
  const body=$$('cgBody');if(!body)return;
  const date=G.selDate;
  const sts=G.students.filter(s=>!isAbsent(s,date));
  $$('cgTitle').textContent=`📘 숙제 채점 (반 전체) · ${fmtKo(date)}`;
  // 이 날짜에 검사할 숙제별로 모으기
  const byHw=new Map();
  sts.forEach(s=>_hwCheckAt(s,date).forEach(({hw,carry})=>{if(!byHw.has(hw.id))byHw.set(hw.id,{hw,rows:[]});byHw.get(hw.id).rows.push({s,carry});}));
  const wrongRows=sts.map(s=>({s,ids:_wrongCheckAt(s,date)})).filter(x=>x.ids.length);
  if(!byHw.size&&!wrongRows.length){body.innerHTML='<div class="cloud-hint">이 날짜에 채점할 문제 노트 숙제가 없습니다.</div>';return;}
  const tables=[...byHw.values()].map(({hw,rows})=>{
    const id=esc(hw.id);
    const head=hw.problems.map(p=>`<th title="${esc(p.label)}">${esc(p.no||p.label)}</th>`).join('');
    const trs=rows.map(({s,carry})=>{
      const r=_hwRes(s,hw),items=_recItems(s),es=esc(s);
      const stTxt=r.missing&&!r.marked?'<span class="cg-bad">안 해 옴</span>':!r.marked?'<span class="cg-dim">미채점</span>':`${r.correct}/${r.total}`;
      const acts=!r.marked&&!r.missing?`<button data-st="${es}" data-hw="${id}" data-act="all">모두 맞음</button><button data-st="${es}" data-hw="${id}" data-act="allx">모두 틀림</button><button data-st="${es}" data-hw="${id}" data-act="miss">안 해 옴</button>`
        :`${r.marked&&r.marked<r.total?`<button data-st="${es}" data-hw="${id}" data-act="rest">나머지 맞음</button>`:''}<button data-st="${es}" data-hw="${id}" data-act="clear">지우기</button>`;
      const cells=hw.problems.map(p=>{const m=r.marks[p.id],h=items[p.id]?.h;return`<td><button class="note-chip${m==='x'?' wrong':m==='o'?' right':''}${r.missing&&!r.marked?' dim':''}" data-st="${es}" data-hw="${id}" data-np="${esc(p.id)}" title="${es} · ${esc(p.label)}${_needsHelp(h)?' · 설명 필요':''}">${m==='x'?'✗':m==='o'?'○':esc(p.no||'·')}${_needsHelp(h)?'<span class="note-help"></span>':''}</button></td>`;}).join('');
      return`<tr><th class="cg-name"><div>${carry?'<span class="carry-tag">(이월)</span> ':''}${es} <span class="cg-st">${stTxt}${CLOUD.markBusy[s]?' · 저장 중…':''}</span></div><div class="cg-acts">${acts}</div></th>${cells}</tr>`;
    }).join('');
    const graded=rows.filter(({s})=>_hwRes(s,hw).marked).length;
    const wrongBy=hw.problems.map(p=>rows.filter(({s})=>_hwRes(s,hw).marks[p.id]==='x').length);
    const foot=graded?`<tr class="cg-foot"><th class="cg-name">틀린 학생 수</th>${wrongBy.map(n=>`<td class="${n&&n/graded>=0.4?'cg-hot':''}">${n||'·'}</td>`).join('')}</tr>`:'';
    return`<div class="cg-sec"><div class="cg-sec-title">📘 ${esc(hw.title)} <span class="label-hint">${esc(shortD(hw.date))} 낸 숙제 · ${hw.problems.length}문제 · 채점 ${graded}/${rows.length}명</span></div>
      <div class="cg-scroll"><table class="cg-table"><thead><tr><th class="cg-name">학생</th>${head}</tr></thead><tbody>${trs}${foot}</tbody></table></div></div>`;
  }).join('');
  const wr=wrongRows.length?`<div class="cg-sec"><div class="cg-sec-title">✎ 오답 다시 풀기 <span class="label-hint">지난 수업에 학생마다 낸 틀린 문제 — 또 틀린 것만 누르세요</span></div>
    ${wrongRows.map(({s,ids})=>{const items=_recItems(s),es=esc(s);const marked=ids.filter(id=>_entryOn(items[id]?.h,date,''));
      const bad=marked.filter(id=>_entryOn(items[id].h,date,'')[1]==='x').length;
      return`<div class="cg-wrow"><div class="cg-wname">${es} <span class="cg-st">${marked.length?`맞음 ${marked.length-bad} · 또 틀림 ${bad}`:'<span class="cg-dim">미채점</span>'}${CLOUD.markBusy[s]?' · 저장 중…':''}</span>
        <span class="cg-acts">${marked.length?`<button data-st="${es}" data-wr="1" data-act="wclear">지우기</button>`:`<button data-st="${es}" data-wr="1" data-act="wall">모두 맞음</button>`}</span></div>
        <div class="note-unit-row">${ids.map(id=>{const e=_entryOn(items[id]?.h,date,''),h=items[id]?.h,ck=_nBefore(h,date)==='checking';
          return`<button class="note-chip${e?.[1]==='x'?' wrong':e?.[1]==='o'?' right':''}" data-st="${es}" data-wr="1" data-np="${esc(id)}" title="${esc(_paperName(s,id))}">${esc(_chipName(s,id))}${ck?'<span class="note-ok1">✓1</span>':''}${_needsHelp(h)?'<span class="note-help"></span>':''}</button>`;}).join('')}</div></div>`;}).join('')}</div>`:'';
  body.innerHTML=`<div class="cg-intro">답안지를 한 장씩 보면서 <b>그 학생 줄에서 틀린 문제만</b> 누르세요 — 누르지 않은 문제는 맞음으로 저장됩니다. 틀린 문제는 학생마다 <b>오답 다시 풀기</b>로 '다음 수업까지 과제'에 자동으로 붙어요.</div>${tables}${wr}
    <div class="cg-foot-row"><button class="cloud-mini-btn" data-act="refresh">↻ 새로 받기</button><button class="cloud-mini-btn" onclick="openNoteApp('classroom')">문제 노트에서 학생별 오답 노트 인쇄 ↗</button></div>`;
  body.onclick=e=>_noteClick(e,'',date);
}
