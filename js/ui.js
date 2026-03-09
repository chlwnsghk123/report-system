// ─── 스케일 ───
function updateScale(){
  const card=$$('reportCard'),area=$$('previewArea');
  const nav=$$('pageNav'),navH=nav&&nav.style.display!=='none'?nav.offsetHeight:0;
  const availH=area.clientHeight-navH-80;
  const availW=area.clientWidth-80;
  const a4w=794,a4h=1123;
  const sv=Math.max(Math.min(availW/a4w,availH/a4h,0.9),.15);
  card.style.transform=`scale(${sv})`;
  card.style.marginBottom=`${-(a4h*(1-sv))}px`;
  [$$('leftPdfCanvas'),$$('rightPdfCanvas')].forEach(c=>{
    if(!c||c.style.display==='none')return;
    c.style.transformOrigin='top center';
    c.style.transform=`scale(${sv})`;
    c.style.marginBottom=`${-(a4h*(1-sv))}px`;
  });
}

// ─── contenteditable 동기화 ───
function initCE(){
  document.querySelectorAll('[contenteditable][data-panel]').forEach(el=>{
    el.addEventListener('input',function(){
      const p=$$(this.dataset.panel);
      if(p&&(p.tagName==='INPUT'||p.tagName==='TEXTAREA')){p.value=this.innerText.trim();p.classList.remove('auto');}
    });
    el.addEventListener('paste',function(e){e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));});
  });
  $$('rRate').addEventListener('input',function(){
    const v=parseInt(this.innerText);if(!isNaN(v)){G.hwRateManual=v;updateHwBadge();rebuildGraph();}
  });
}

// 리포트카드 → 패널 단방향 동기화
function fp(cid,pid){const c=$$(cid),p=$$(pid);if(c&&p&&c.innerText.trim()!==p.value)c.innerText=p.value;}

// ─── 탭 ───
function renderTabs(){
  const bar=$$('tabBar');
  if(!G.students.length){bar.style.display='none';return;}
  bar.style.display='flex';
  bar.innerHTML=G.students.map(n=>`<div class="tab-item${n===G.selStudent?' active':''}" onclick="switchTab('${esc(n)}')">${esc(n)}</div>`).join('');
}
function switchTab(name){
  if(name===G.selStudent)return;
  saveTabData();G.selStudent=name;renderTabs();
  if(G.selDate)autoFillAll();
  saveSession();
}
function saveTabData(){
  if(!G.selStudent)return;
  G.tabData[G.selStudent]={
    hwStatus:[...G.hwStatus],scoreCalc:G.scoreCalc,
    correctInput:$$('inputCorrect').value,totalInput:$$('inputTotal').value,
    wrongInput:$$('inputWrong').value,rateManual:G.hwRateManual,
    comment:$$('inputComment').value,
  };
}
function restoreTabData(name){
  const d=G.tabData[name];if(!d)return false;
  G.hwStatus=d.hwStatus||[];G.scoreCalc=d.scoreCalc??null;G.hwRateManual=d.rateManual??null;
  $$('inputCorrect').value=d.correctInput||'';$$('inputTotal').value=d.totalInput||'';
  $$('inputWrong').value=d.wrongInput||'';$$('inputComment').value=d.comment||'';
  fp('commentBody','inputComment');return true;
}

// ─── 토글 (미니테스트/코멘트) ───
function toggleSec(type){
  if(type==='mini'){
    G.showMini=!G.showMini;
    $$('toggleMini').classList.toggle('on',G.showMini);
    $$('gMini').style.display=G.showMini?'flex':'none';
    $$('secMini').style.display=G.showMini?'':'none';
  }else{
    G.showComment=!G.showComment;
    $$('toggleComment').classList.toggle('on',G.showComment);
    $$('gComment').style.display=G.showComment?'':'none';
    $$('secComment').style.display=G.showComment?'':'none';
  }
  setTimeout(updateScale,50);saveSession();
}

// ─── 현재 진도 / 이번 과제 접기·펼치기 ───
function toggleCurProg(){
  const e=$$('curProgEdit'),open=e.style.display!=='none';
  e.style.display=open?'none':'flex';
  const a=$$('curProgArrow');if(a)a.style.transform=open?'':'rotate(180deg)';
}
function toggleNextHw(){
  const e=$$('nextHwEdit'),open=e.style.display!=='none';
  e.style.display=open?'none':'block';
  const a=$$('nextHwArrow');if(a)a.style.transform=open?'':'rotate(180deg)';
}
