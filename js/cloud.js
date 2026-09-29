// ─── 학원 저장소 (구글 로그인) · 문제 노트 과제 채점 ───
// 서버는 문제 노트 사이트(mathpro.app)의 Worker다 — 이 앱에는 서버 코드가 없다.
//  · 로그인: 구글 계정 → 세션 토큰(14일, localStorage 'rs:auth'). 운영자가 학원마다 등록한 이메일만 통과.
//  · 학원 저장소: '리포트'(엑셀 파일 한 개 분량 = DATA_KEYS 전체)를 학원 단위로 저장·공유.
//    열어 둔 리포트는 편집할 때마다 자동 저장(1.5초 뒤). 다른 곳에서 먼저 저장했으면 충돌 안내.
//    엑셀 저장(💾)은 백업용으로 그대로 쓰고, 로그인하지 않으면 지금처럼 엑셀 + 자동 백업으로만 동작한다.
//  · 노트 과제: 문제 노트에서 학생별로 배정한 과제를 그 날짜(또는 그 뒤 첫 수업)에 띄우고,
//    틀린 문제를 눌러 채점 → 결과는 학원 저장소에 저장되고, 리포트 '미니 테스트'에 반영된다
//    (그 학생·날짜에 직접 입력한 미니 테스트가 있으면 직접 입력이 우선).
// 다른 파일과의 연결점(없으면 조용히 건너뜀): saveAppData→cloudOnChange, _appSnapshot→cloudSnapshotTag,
// miniResult→noteMiniResult, confirmMissingInputs→noteUngradedNames, autoFillAll→renderNotePanel,
// loadExcel·_clearAllData→cloudDetach, Ctrl+S→cloudSaveNow, window.onload→cloudInit

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
  notes:{tenant:'',assignments:[],results:{},at:''}, // 노트 과제·채점 결과 (학원 단위, 이 기기에 캐시)
  notePending:new Set(),noteTimers:{},notesAt:0,
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
  'no-valid-items':'배정할 내용을 확인해 주세요',
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
  const n=_lsGet(CLOUD_LS.notes);
  if(n&&n.tenant&&n.tenant===CLOUD.tenant)CLOUD.notes={tenant:n.tenant,assignments:n.assignments||[],results:n.results||{},at:n.at||''};
  try{
    const c=await _cloudFetch('/api/auth/config',{auth:false});
    CLOUD.config={enabled:!!(c.enabled&&c.clientId),clientId:c.clientId||''};
  }catch(e){CLOUD.config={enabled:false,clientId:''};}
  // 서버가 준비되지 않았거나 연결이 안 되면 버튼을 숨김 (이미 로그인해 둔 경우는 표시)
  const btn=$$('btnCloud');if(btn)btn.style.display=(CLOUD.config.enabled||CLOUD.auth)?'':'none';
  window.addEventListener('beforeunload',e=>{if(cloudIsDirty()){e.preventDefault();e.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&CLOUD.book&&CLOUD.dirty&&!CLOUD.saving)_cloudSave();});
  // 문제 노트·다른 선생님이 바꾼 과제·채점을 창으로 돌아올 때 새로 받기 (1분에 한 번)
  window.addEventListener('focus',()=>{if(cloudSignedIn()&&Date.now()-CLOUD.notesAt>60000)cloudLoadNotes();});
  _cloudStatus();
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
    const btn=$$('btnCloud');if(btn)btn.style.display='';
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
  // 로그아웃하면 이 기기의 노트 과제 캐시도 비움 (리포트에는 직접 입력한 미니 테스트만 표시)
  CLOUD.notes={tenant:'',assignments:[],results:{},at:''};_lsSet(CLOUD_LS.notes,null);
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
    CLOUD.notes={tenant:path,assignments:[],results:{},at:''};_lsSet(CLOUD_LS.notes,null);
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
    body.innerHTML=`<div class="cloud-intro">학원에 등록된 <b>구글 계정</b>으로 로그인하면 리포트를 학원 저장소에 저장해 <b>다른 컴퓨터·다른 선생님</b>과 함께 쓰고, 문제 노트에서 학생별로 배정한 과제를 채점할 수 있습니다.</div>
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
  body.innerHTML=`<div class="cloud-who"><span>${esc(u.email||'')}</span>${tenantSel}<button class="cloud-mini-btn" onclick="cloudSignOut()">로그아웃</button></div>
    <div class="cloud-sec-title">학원 리포트</div><div class="cloud-books">${list}</div>
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

// ─── 노트 과제 (문제 노트에서 배정) ───
async function cloudLoadNotes(){
  if(!cloudSignedIn()||!CLOUD.tenant)return;
  CLOUD.notesAt=Date.now();
  const tenant=CLOUD.tenant;
  try{
    const[a,r]=await Promise.all([_ws('assignments'),_ws('results')]);
    if(tenant!==CLOUD.tenant)return;
    // 채점 중 아직 서버에 못 올린 결과는 이 기기 값을 유지 (그리고 다시 보냄)
    const results=r.items||{};
    CLOUD.notePending.forEach(id=>{
      if(CLOUD.notes.results[id])results[id]=CLOUD.notes.results[id];else delete results[id];
      if(!CLOUD.noteTimers[id])CLOUD.noteTimers[id]=setTimeout(()=>_noteSave(id),200);
    });
    CLOUD.notes={tenant,assignments:a.items||[],results,at:new Date().toISOString()};
    _lsSet(CLOUD_LS.notes,CLOUD.notes);
  }catch(e){if(!e.network&&e.status!==401)console.warn('노트 과제 불러오기 실패:',e);}
  _refreshNoteViews();
}
function _refreshNoteViews(){
  renderNotePanel();
  if(G.selStudent&&G.selDate){updateMiniSection();renderMiniPanel();fitReportCard();}
}
// 과제 날짜 → 리포트 수업 날짜 (그 날짜 또는 그 뒤 첫 수업)
function _noteLessonDate(d){
  const ds=G.lessons.map(l=>l.날짜).filter(Boolean).sort();
  return ds.find(x=>x>=d)||'';
}
// 이 학생·수업 날짜에 걸린 노트 과제 (이 기기 캐시 기준)
function _notesFor(student,date){
  if(!student||!date||!CLOUD.notes.tenant||CLOUD.notes.tenant!==CLOUD.tenant)return[];
  const s=String(student).trim();
  return(CLOUD.notes.assignments||[]).filter(a=>String(a.student||'').trim()===s&&_noteLessonDate(a.date)===date);
}
// 채점한 노트 과제 → 미니 테스트 결과 (domain.js miniResult에서 직접 입력이 없을 때 사용)
function noteMiniResult(student,date){
  const list=_notesFor(student,date).filter(a=>CLOUD.notes.results[a.id]);
  if(!list.length)return null;
  let total=0;const wrong=[],titles=[];
  list.forEach(a=>{
    const w=new Set(CLOUD.notes.results[a.id].wrong||[]);
    total+=a.problems.length;
    a.problems.forEach(p=>{if(w.has(p.id))wrong.push(p.label||p.id);});
    if(a.title&&!titles.includes(a.title))titles.push(a.title);
  });
  const correct=Math.max(0,total-wrong.length);
  return{total,correct,wrong,range:titles.join(' · '),pct:total?Math.round(correct/total*100):null,perfect:total>0&&!wrong.length};
}
// 일괄 출력 전 점검용 — 노트 과제가 있는데 채점 안 한 학생
function noteUngradedNames(date,students){
  if(!cloudSignedIn())return[];
  return students.filter(s=>_notesFor(s,date).some(a=>!CLOUD.notes.results[a.id]));
}
function renderNotePanel(){
  const card=$$('noteHwCard');if(!card)return;
  const list=cloudSignedIn()?_notesFor(G.selStudent,G.selDate):[];
  if(!list.length){card.style.display='none';card.innerHTML='';return;}
  card.style.display='';
  const hints=[];
  if(isAbsent(G.selStudent,G.selDate))hints.push('결석한 날은 리포트에 표시되지 않습니다');
  else if(!G.showMini)hints.push('채점 결과는 아래 \'미니 테스트\'를 켜면 리포트에 점수·다시 볼 문제로 표시됩니다');
  else if(miniResult(G.selStudent,G.selDate)&&(G.wrong[G.selStudent]?.[G.selDate]||G.miniScore[`${G.selStudent}||${G.selDate}`]!=null))
    hints.push('미니 테스트를 직접 입력해서 리포트에는 직접 입력한 결과가 표시됩니다');
  card.innerHTML=`<div class="cg"><label>📘 노트 과제 <span class="ab">문제 노트</span><span class="label-hint">틀린 문제를 누르세요</span>
    <button class="note-refresh" data-act="refresh" title="새로 받기">↻</button></label>
    ${list.map(_noteAsgHtml).join('')}
    ${hints.map(h=>`<div class="label-hint note-hint">${esc(h)}</div>`).join('')}</div>`;
  card.onclick=e=>{
    const t=e.target.closest('[data-act],[data-np]');if(!t)return;
    const aid=t.dataset.na;
    if(t.dataset.np)noteToggle(aid,t.dataset.np);
    else if(t.dataset.act==='all')_noteSet(aid,[]);
    else if(t.dataset.act==='clear')_noteSet(aid,null);
    else if(t.dataset.act==='refresh')cloudLoadNotes();
  };
}
function _noteAsgHtml(a){
  const r=CLOUD.notes.results[a.id],w=new Set(r?.wrong||[]);
  const st=!r?'<span class="note-st">미채점</span>':w.size?`<span class="note-st bad">오답 ${w.size}</span>`:'<span class="note-st good">모두 맞음</span>';
  const saving=CLOUD.notePending.has(a.id)?'<span class="label-hint">저장 중…</span>':'';
  // 단원별로 묶어 번호 칩 표시 (문제 노트의 인쇄 번호와 같음)
  const groups=[];
  a.problems.forEach(p=>{const u=p.unit||'';let g=groups[groups.length-1];if(!g||g.unit!==u){g={unit:u,items:[]};groups.push(g);}g.items.push(p);});
  const id=esc(a.id);
  const chips=groups.map(g=>`<div class="note-unit-row">${g.unit?`<span class="note-unit">${esc(g.unit)}</span>`:''}${g.items.map(p=>
    `<button class="note-chip${w.has(p.id)?' wrong':''}" data-na="${id}" data-np="${esc(p.id)}" title="${esc(p.label||p.id)}">${esc(p.no||p.label||p.id)}</button>`).join('')}</div>`).join('');
  return`<div class="note-asg"><div class="note-asg-head"><span class="note-asg-title">${esc(a.title||'노트 과제')}</span><span class="label-hint">${a.problems.length}문항</span>${st}${saving}
    <span class="note-asg-btns"><button class="note-mini-btn" data-na="${id}" data-act="all">모두 맞음</button>${r?`<button class="note-mini-btn" data-na="${id}" data-act="clear">채점 취소</button>`:''}</span></div>${chips}</div>`;
}
function noteToggle(aid,pid){
  const a=CLOUD.notes.assignments.find(x=>x.id===aid);if(!a)return;
  const w=new Set(CLOUD.notes.results[aid]?.wrong||[]);
  if(w.has(pid))w.delete(pid);else w.add(pid);
  _noteSet(aid,a.problems.map(p=>p.id).filter(id=>w.has(id)));
}
function _noteSet(aid,wrong){
  if(!cloudSignedIn()){openCloudModal();return;}
  if(wrong===null)delete CLOUD.notes.results[aid];
  else CLOUD.notes.results[aid]={wrong,gradedAt:new Date().toISOString(),gradedBy:CLOUD.auth?.user?.email||''};
  _lsSet(CLOUD_LS.notes,CLOUD.notes);
  CLOUD.notePending.add(aid);
  _refreshNoteViews();
  clearTimeout(CLOUD.noteTimers[aid]);
  CLOUD.noteTimers[aid]=setTimeout(()=>_noteSave(aid),600);
}
async function _noteSave(aid){
  delete CLOUD.noteTimers[aid];
  const r=CLOUD.notes.results[aid];
  try{
    await _ws('results',{method:'PUT',body:{assignmentId:aid,wrong:r?r.wrong:null}});
    if(!CLOUD.noteTimers[aid])CLOUD.notePending.delete(aid);
  }catch(e){
    if(e.status===404){
      CLOUD.notePending.delete(aid);delete CLOUD.notes.results[aid];
      CLOUD.notes.assignments=CLOUD.notes.assignments.filter(x=>x.id!==aid);
      toast('문제 노트에서 배정을 지운 과제입니다');
    }else toast('채점 저장 실패: '+e.message+' (다시 연결되면 이어서 저장합니다)');
  }
  _lsSet(CLOUD_LS.notes,CLOUD.notes);
  _refreshNoteViews();
}
