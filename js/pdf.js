// ─── PDF 첨부 (학생별) ───
let _pdfAttachTarget=''; // '' = current student, '_all_' = all students
let _pdfReplaceMode=false;

async function _processPdfFile(file){
  setBar('wait','⏳ PDF 렌더링 중...');
  try{
    const buf=await file.arrayBuffer();
    const pdfDoc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
    const totalPages=pdfDoc.numPages;
    // 첫 페이지만 추출 (용량 최적화)
    const page=await pdfDoc.getPage(1);const vp=page.getViewport({scale:2.5});
    const raw=document.createElement('canvas');raw.width=vp.width;raw.height=vp.height;
    await page.render({canvasContext:raw.getContext('2d'),viewport:vp}).promise;
    const W=raw.width,H=raw.height;
    const cT=Math.round(H*0.05),cB=Math.round(H*0.06),cropH=H-cT-cB;
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;
    const ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);
    const destY=Math.round((H-cropH)/2+H*0.04);
    ctx.drawImage(raw,0,cT,W,cropH,0,destY,W,cropH);
    // 첫 페이지만 PNG로 저장 (원본 PDF bytes 대신, 용량 절감)
    const pngDataUrl=cv.toDataURL('image/png');
    const pngBytes=dataUrlToBytes(pngDataUrl);
    if(totalPages>1){
      alert(`이 PDF는 ${totalPages}페이지입니다. 첫 페이지만 저장됩니다.`);
    }
    return{bytes:pngBytes,name:file.name,canvases:[cv],pageCount:1,isPng:true};
  }catch(e){setBar('err','❌ PDF 로드 실패: '+e.message);console.error(e);return null;}
}

function _addPdfToStudent(student,pdfData){
  if(!G.studentPdfs[student])G.studentPdfs[student]=[];
  G.studentPdfs[student].push(pdfData);
}

function _getStudentPdfCanvases(student){
  const pdfs=G.studentPdfs[student]||[];
  const all=[];
  pdfs.forEach(p=>all.push(...p.canvases));
  return all;
}

function _getStudentPdfPageCount(student){
  return(G.studentPdfs[student]||[]).reduce((s,p)=>s+p.pageCount,0);
}

// 하위 호환: 전역 pdfCanvases/pdfPageCount를 현재 학생 기준으로 동기화
function _syncGlobalPdf(){
  if(!G.selStudent){G.pdfCanvases=[];G.pdfPageCount=0;return;}
  G.pdfCanvases=_getStudentPdfCanvases(G.selStudent);
  G.pdfPageCount=_getStudentPdfPageCount(G.selStudent);
}

async function handlePdfInput(input){
  const file=input.files[0];if(!file)return;
  const pdfData=await _processPdfFile(file);
  if(!pdfData){input.value='';return;}
  if(_pdfAttachTarget==='_all_'){
    G.students.forEach(s=>{
      G.studentPdfs[s]=[];  // 전체 교체
      _addPdfToStudent(s,{
        bytes:new Uint8Array(pdfData.bytes),name:pdfData.name,pageCount:pdfData.pageCount,isPng:!!pdfData.isPng,
        canvases:pdfData.canvases.map(cv=>{
          const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;
          c.getContext('2d').drawImage(cv,0,0);return c;
        })
      });
    });
  }else{
    const target=_pdfAttachTarget||G.selStudent;
    if(_pdfReplaceMode)G.studentPdfs[target]=[];  // 교체 모드: 기존 삭제
    _addPdfToStudent(target,pdfData);
  }
  _pdfAttachTarget='';_pdfReplaceMode=false;
  _syncGlobalPdf();
  G.currentSpread=0;renderSpread();renderTabs();
  setBar('ok',`✅ ${G.excelFileName}`);
  _savePdfData();
  input.value='';
}

// 리포트 옆 인라인 + 버튼
function inlinePdfAttach(){
  if(!G.selStudent)return;
  _showInlineMenu();
}

function _showInlineMenu(){
  _closePdfMenu();
  const menu=document.createElement('div');
  menu.className='pdf-attach-menu';menu.id='pdfAttachMenu';
  menu.innerHTML=`
    <button onclick="_pdfAttachTarget=G.selStudent;$$('pdfInput').click();_closePdfMenu();">
      <span style="font-size:16px;">👤</span> 이 학생에게만 첨부
    </button>
    <div class="pam-sep"></div>
    <button onclick="_pdfAttachTarget='_all_';$$('pdfInput').click();_closePdfMenu();">
      <span style="font-size:16px;">👥</span> 모든 학생에게 첨부
    </button>
    <div class="pam-sep"></div>
    <button onclick="_closePdfMenu();_attachSummaryForCurrent();">
      <span style="font-size:16px;">📊</span> 이행률 요약표 첨부
    </button>`;
  document.body.appendChild(menu);
  const btn=$$('pdfAddInline');
  if(btn){
    const rect=btn.getBoundingClientRect();
    menu.style.left=rect.left+'px';
    menu.style.bottom=(window.innerHeight-rect.top+8)+'px';
  }
  setTimeout(()=>document.addEventListener('click',_closePdfMenuOnClick,{once:true}),0);
}
function _closePdfMenu(){const m=$$('pdfAttachMenu');if(m)m.remove();}
function _closePdfMenuOnClick(e){if(!e.target.closest('.pdf-attach-menu'))_closePdfMenu();}

function attachPdfForStudent(name){
  // 이미 PDF 있으면 교체 (기존 삭제 후 새로 첨부)
  _pdfAttachTarget=name;
  _pdfReplaceMode=!!(G.studentPdfs[name]?.length);
  $$('pdfInput').click();
}

function removeStudentPdf(student,idx){
  if(!confirm('이 PDF를 삭제하시겠습니까?'))return;
  const pdfs=G.studentPdfs[student];
  if(!pdfs)return;
  pdfs.splice(idx,1);
  if(!pdfs.length)delete G.studentPdfs[student];
  _syncGlobalPdf();
  G.currentSpread=0;renderSpread();renderTabs();
  _savePdfData();
}

function removeAllStudentPdfs(student){
  if(!confirm(`${student} 학생의 모든 PDF를 삭제하시겠습니까?`))return;
  delete G.studentPdfs[student];
  _syncGlobalPdf();
  G.currentSpread=0;renderSpread();renderTabs();
  _savePdfData();
}

// PDF 데이터 IndexedDB 저장 (bytes만, canvases는 런타임)
async function _savePdfData(){
  const data={};
  for(const[name,pdfs]of Object.entries(G.studentPdfs)){
    data[name]=pdfs.map(p=>({bytes:p.bytes,name:p.name,pageCount:p.pageCount,isPng:!!p.isPng}));
  }
  try{await dbSet('studentPdfs',data);}catch(e){console.error('PDF 저장 실패:',e);}
}

// PDF 데이터 IndexedDB 복원 (앱 시작 시)
async function restorePdfData(){
  try{
    const data=await dbGet('studentPdfs');
    if(!data)return;
    for(const[name,pdfs]of Object.entries(data)){
      G.studentPdfs[name]=[];
      for(const p of pdfs){
        try{
          if(p.isPng){
            // PNG 형식 (첫 페이지만 저장된 경우)
            const blob=new Blob([p.bytes],{type:'image/png'});
            const url=URL.createObjectURL(blob);
            const img=new Image();
            await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
            const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
            cv.getContext('2d').drawImage(img,0,0);
            URL.revokeObjectURL(url);
            G.studentPdfs[name].push({bytes:p.bytes,name:p.name,canvases:[cv],pageCount:1,isPng:true});
          }else{
            // 레거시 PDF 형식
            const pdfDoc=await pdfjsLib.getDocument({data:p.bytes.buffer.slice(0)}).promise;
            const canvases=[];
            for(let i=1;i<=Math.min(pdfDoc.numPages,1);i++){
              const page=await pdfDoc.getPage(i);const vp=page.getViewport({scale:2.5});
              const raw=document.createElement('canvas');raw.width=vp.width;raw.height=vp.height;
              await page.render({canvasContext:raw.getContext('2d'),viewport:vp}).promise;
              const W=raw.width,H=raw.height;
              const cT=Math.round(H*0.05),cB=Math.round(H*0.06),cropH=H-cT-cB;
              const cv=document.createElement('canvas');cv.width=W;cv.height=H;
              const ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);
              const destY=Math.round((H-cropH)/2+H*0.04);
              ctx.drawImage(raw,0,cT,W,cropH,0,destY,W,cropH);
              canvases.push(cv);
            }
            G.studentPdfs[name].push({bytes:p.bytes,name:p.name,canvases,pageCount:canvases.length});
          }
        }catch(e){console.error(`PDF 복원 실패 (${name}/${p.name}):`,e);}
      }
      if(!G.studentPdfs[name].length)delete G.studentPdfs[name];
    }
  }catch(e){console.error('PDF 데이터 복원 실패:',e);}
}

function renderSpread(){
  _syncGlobalPdf();
  // 페이지 네비게이션 항상 숨김 (1장 첨부만 지원)
  const nav=$$('pageNav');nav.style.display='none';
  G.currentSpread=0;

  const rc=$$('reportCard'),lc=$$('leftPdfCanvas'),rs=$$('rightSlot'),rpc=$$('rightPdfCanvas');
  // 기존 X 버튼 제거
  document.querySelectorAll('.pdf-page-del').forEach(el=>el.remove());
  const stu=esc(G.selStudent||'');
  // 항상 리포트 표시 (왼쪽)
  rc.style.display='';lc.style.display='none';$$('leftLabel').textContent='리포트';
  // 오른쪽: 첨부 PDF 1장 표시
  const hasPdf=G.pdfCanvases.length>0;
  if(hasPdf){
    rs.style.display='';
    drawPdfPrev(rpc,G.pdfCanvases[0]);
    $$('rightLabel').textContent='시험자료';
    _addPdfDelBtn(rs,stu);
  }else{
    rs.style.display='none';
  }
  $$('spreadRow').classList.toggle('dual',hasPdf);
  // + 버튼 표시/숨김
  const inlineBtn=$$('pdfAddInline');
  if(inlineBtn)inlineBtn.style.display=hasPdf?'none':'flex';
  setTimeout(updateScale,60);
}
function _addPdfDelBtn(slot,studentName){
  const btn=document.createElement('button');
  btn.className='pdf-page-del';btn.title='PDF 삭제';btn.textContent='✕';
  btn.onclick=()=>removeAllStudentPdfs(decodeURIComponent(studentName));
  slot.appendChild(btn);
}
function drawPdfPrev(tgt,src){
  tgt.width=src.width;tgt.height=src.height;
  tgt.style.width='794px';tgt.style.height='1123px';
  tgt.style.transformOrigin='top center';
  tgt.getContext('2d').drawImage(src,0,0);
}
function prevSpread(){if(G.currentSpread>0){G.currentSpread--;renderSpread();}}
function nextSpread(){const s=Math.ceil((1+G.pdfPageCount)/2);if(G.currentSpread<s-1){G.currentSpread++;renderSpread();}}

// ─── PDF 저장 ───
async function dlPdf(){
  const btn=$$('btnPdf');if(!btn)return;const origPdfText=btn.textContent;btn.textContent='⏳ 생성 중...';btn.disabled=true;
  try{
    document.querySelectorAll('[contenteditable]').forEach(e=>e.blur());
    const rc=$$('reportCard');
    const reportCanvas=await html2canvas(rc,{scale:2,useCORS:true,backgroundColor:'#fff',
      onclone:doc=>{const c=doc.getElementById('reportCard');c.style.transform='none';c.style.margin='0';
        const sr=doc.getElementById('spreadRow');if(sr){sr.style.transform='none';sr.style.marginBottom='';}
        doc.querySelectorAll('[contenteditable]').forEach(e=>e.style.outline='none');},
      width:rc.offsetWidth,height:rc.offsetHeight,scrollX:0,scrollY:0,windowWidth:rc.offsetWidth,windowHeight:rc.offsetHeight});
    const{PDFDocument}=PDFLib;const outDoc=await PDFDocument.create();
    const LW=841.89,LH=595.28,margin=20,gap=12;
    const slotW=(LW-margin*2-gap)/2,slotH=LH-margin*2;
    const allPages=[{canvas:reportCanvas}];
    G.pdfCanvases.forEach(cv=>allPages.push({canvas:cv}));
    for(let i=0;i<allPages.length;i+=2){
      const page=outDoc.addPage([LW,LH]);
      for(let slot=0;slot<2;slot++){
        const pi=allPages[i+slot];if(!pi)break;
        const xOff=margin+slot*(slotW+gap);
        const pngBytes=dataUrlToBytes(pi.canvas.toDataURL('image/png'));
        const pngImg=await outDoc.embedPng(pngBytes);
        const{width:iw,height:ih}=pngImg;
        const scale=Math.min(slotW/iw,slotH/ih);
        const dw=iw*scale,dh=ih*scale;
        page.drawImage(pngImg,{x:xOff+(slotW-dw)/2,y:margin+(slotH-dh)/2,width:dw,height:dh});
      }
    }
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([await outDoc.save()],{type:'application/pdf'}));
    a.download=`${G.selStudent||'학생'}_${G.selDate||'report'}_리포트.pdf`;
    a.click();URL.revokeObjectURL(a.href);
  }catch(e){alert('PDF 오류: '+e.message);console.error(e);}
  btn.textContent=origPdfText;btn.disabled=false;
}
// ─── 툴바 메뉴 ───
function toggleToolbarMenu(id){
  const el=$$(id);el.classList.toggle('open');
  // 다른 메뉴 닫기
  document.querySelectorAll('.tb-dropdown').forEach(d=>{if(d.id!==id)d.classList.remove('open');});
}
function closeToolbarMenus(){document.querySelectorAll('.tb-dropdown').forEach(d=>d.classList.remove('open'));}
document.addEventListener('click',function(e){
  if(!e.target.closest('.tb-dropdown'))closeToolbarMenus();
});

// ─── 전체 과제 요약 (긴 이미지 PNG) ───
function dlSummaryPdf(){
  if(!G.selDate||!G.students.length){alert('날짜와 학생 데이터가 필요합니다.');return;}
  // 확인 모달
  showConfirmModal('전체 과제 요약 이미지를 생성하시겠습니까?',`${G.students.length}명 학생 · ${fmtKo(G.selDate)}`,_doSummaryImage);
}

async function _doSummaryImage(){
  const btn=document.querySelector('#tbMenu .tb-btn');
  const origText=btn.textContent;btn.textContent='⏳ 생성 중...';btn.disabled=true;
  try{
    saveTabData();
    const date=G.selDate;
    const prevLesson=getPrevL();
    const W=800; // 이미지 폭
    const minCardH=160; // 결석 등 최소 높이
    const stLabel={2:'완료',1:'부분완료',0:'미완료'};
    const stColor={2:'#166534',1:'#92400e',0:'#991b1b'};
    const stBg={2:'#dcfce7',1:'#fef3c7',0:'#fee2e2'};

    // 학생별 카드 HTML 생성
    const cardHtmls=G.students.map(name=>{
      const key=`${name}||${date}`;
      const rec=G.hwRec[key];
      const rate=G.rates[name]?.[date];
      let items=rec?.items||[];
      if(!items.length&&prevLesson){
        const hwKeys=getLessonHwKeys(prevLesson);
        items=hwKeys.map((k,i)=>({text:prevLesson[k]||'',status:rec?.[`과제${i+1}_상태`]||'',ref:`${prevLesson.id}-${k}`,fromDate:prevLesson.날짜})).filter(it=>it.text);
      }
      const hasRate=rate!=null&&!isNaN(rate);
      // 헤더
      let html=`<div style="border-bottom:1.5px solid #000;padding-bottom:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div style="font-size:22px;font-weight:800;color:#000;">${esc(name)} <span style="font-size:14px;font-weight:400;color:#555;">학생</span></div>
        ${hasRate?`<div style="font-size:24px;font-weight:900;color:${rate>=75?'#1b7340':rate>=30?'#b45309':'#dc2626'};line-height:1;">${rate}%</div>`:''}
      </div>`;
      if(!hasRate){
        html+=`<div style="padding:8px 0;"><span style="font-size:18px;font-weight:800;color:#dc2626;">결석</span></div>`;
      }else{
        const visible=items.filter(it=>!isNone(it.status)&&stLabel[it.status]);
        if(visible.length){
          let idx=0;
          html+=visible.map(it=>{
            idx++;
            return`<div style="display:flex;align-items:center;padding:10px 14px;border-radius:8px;background:#f8f9fa;border:1px solid #e5e7eb;gap:10px;margin-bottom:5px;">
              <div style="width:22px;height:22px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#374151;flex-shrink:0;">${idx}</div>
              <div style="flex:1;font-size:13px;color:#222;font-weight:500;">${esc(it.text)}</div>
              <div style="padding:3px 10px;border-radius:5px;font-size:11px;font-weight:700;color:${stColor[it.status]};background:${stBg[it.status]};flex-shrink:0;">${stLabel[it.status]}</div>
            </div>`;
          }).join('');
        }else{
          html+=`<div style="padding:12px;color:#9ca3af;font-size:13px;text-align:center;">상태 지정된 과제 없음</div>`;
        }
      }
      return html;
    });

    // 하나의 긴 컨테이너에 모든 카드 배치
    const wrap=document.createElement('div');
    wrap.style.cssText='position:fixed;left:-9999px;top:0;';
    document.body.appendChild(wrap);

    const container=document.createElement('div');
    container.style.cssText=`width:${W}px;background:#fff;padding:30px 36px;box-sizing:border-box;font-family:Pretendard,sans-serif;`;
    // 타이틀
    container.innerHTML=`<div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:20px;font-weight:800;color:#111;">과제 요약</div>
      <div style="font-size:13px;color:#888;margin-top:4px;">${fmtKo(date)}</div>
    </div>`+cardHtmls.map(h=>`<div style="margin-bottom:230px;">${h}</div>`).join('')
      +`<div style="text-align:center;font-size:10px;color:#bbb;padding-top:8px;">Generated by 학습리포트</div>`;
    wrap.appendChild(container);

    // html2canvas로 캡처
    const canvas=await html2canvas(container,{scale:2,useCORS:true,backgroundColor:'#fff',
      width:W,scrollX:0,scrollY:0,windowWidth:W});
    document.body.removeChild(wrap);

    // PNG 다운로드
    canvas.toBlob(blob=>{
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=`과제요약_${G.selDate}.png`;
      a.click();URL.revokeObjectURL(a.href);
    },'image/png');
  }catch(e){alert('요약 이미지 오류: '+e.message);console.error(e);}
  btn.textContent=origText;btn.disabled=false;
}

// ─── 확인/취소 모달 ───
function showConfirmModal(title,desc,onConfirm){
  let overlay=$$('confirmModalOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='confirmModalOverlay';
    overlay.className='lm-overlay';
    overlay.innerHTML=`<div class="lm-modal" style="max-width:400px;">
      <div style="padding:28px 28px 24px;text-align:center;">
        <div id="confirmTitle" style="font-size:16px;font-weight:800;color:#111;margin-bottom:8px;"></div>
        <div id="confirmDesc" style="font-size:13px;color:#888;margin-bottom:24px;"></div>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button id="confirmCancel" class="btn-s" style="width:auto;padding:10px 28px;">취소</button>
          <button id="confirmOk" class="btn-p" style="padding:10px 28px;">확인</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(overlay);
  }
  $$('confirmTitle').textContent=title;
  $$('confirmDesc').textContent=desc;
  overlay.style.display='flex';
  document.body.classList.add('modal-open');
  const close=()=>{overlay.style.display='none';document.body.classList.remove('modal-open');};
  $$('confirmCancel').onclick=close;
  $$('confirmOk').onclick=()=>{close();onConfirm();};
  overlay.onclick=e=>{if(e.target===overlay)close();};
}

function dataUrlToBytes(u){
  const b=atob(u.split(',')[1]);const a=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;
}

// ─── 기능1: 일괄 PDF 내보내기 ───
function dlBatchPdf(){
  if(!G.selDate||!G.students.length){alert('날짜와 학생 데이터가 필요합니다.');return;}
  // 결석 제외 학생 수 계산
  const eligible=G.students.filter(n=>G.rates[n]?.[G.selDate]!=null);
  if(!eligible.length){alert('해당 날짜에 출석한 학생이 없습니다.');return;}
  showConfirmModal(
    '일괄 PDF를 생성하시겠습니까?',
    `${eligible.length}명 학생 (결석 ${G.students.length-eligible.length}명 제외) · ${fmtKo(G.selDate)}`,
    _doBatchPdf
  );
}

async function _doBatchPdf(){
  const btn=document.querySelector('#tbMenu .tb-btn');
  const origText=btn.textContent;btn.textContent='⏳ 생성 중...';btn.disabled=true;
  const preview=$$('previewArea');
  try{
    saveTabData();
    const origStudent=G.selStudent;
    const date=G.selDate;
    const eligible=G.students.filter(n=>G.rates[n]?.[date]!=null);

    // 미리보기 깜빡임 방지
    preview.style.opacity='0';

    const canvases=[];
    for(const name of eligible){
      // 학생 전환 + 리포트 렌더링
      G.selStudent=name;
      autoFillAll();
      // DOM 렌더 대기
      await new Promise(r=>setTimeout(r,150));

      const rc=$$('reportCard');
      const cv=await html2canvas(rc,{scale:2,useCORS:true,backgroundColor:'#fff',
        onclone:doc=>{
          const c=doc.getElementById('reportCard');c.style.transform='none';c.style.margin='0';
          const sr=doc.getElementById('spreadRow');if(sr){sr.style.transform='none';sr.style.marginBottom='';}
          doc.querySelectorAll('[contenteditable]').forEach(e=>e.style.outline='none');
        },
        width:rc.offsetWidth,height:rc.offsetHeight,scrollX:0,scrollY:0,
        windowWidth:rc.offsetWidth,windowHeight:rc.offsetHeight});
      // 학생별 첨부 PDF 캔버스도 수집
      const stuPdfCvs=_getStudentPdfCanvases(name);
      canvases.push({name,canvas:cv,pdfCanvases:stuPdfCvs});
    }

    // PDF 생성 (가로 A4, 학생당 리포트+첨부PDF 2장씩)
    const{PDFDocument}=PDFLib;
    const outDoc=await PDFDocument.create();
    const LW=841.89,LH=595.28,margin=20,gap=12;
    const slotW=(LW-margin*2-gap)/2,slotH=LH-margin*2;

    for(const{canvas,pdfCanvases:stuPdfs}of canvases){
      const allPages=[{canvas}];
      stuPdfs.forEach(cv=>allPages.push({canvas:cv}));
      for(let i=0;i<allPages.length;i+=2){
        const page=outDoc.addPage([LW,LH]);
        for(let slot=0;slot<2;slot++){
          const pi=allPages[i+slot];if(!pi)break;
          const xOff=margin+slot*(slotW+gap);
          const pngBytes=dataUrlToBytes(pi.canvas.toDataURL('image/png'));
          const pngImg=await outDoc.embedPng(pngBytes);
          const{width:iw,height:ih}=pngImg;
          const scale=Math.min(slotW/iw,slotH/ih);
          const dw=iw*scale,dh=ih*scale;
          page.drawImage(pngImg,{x:xOff+(slotW-dw)/2,y:margin+(slotH-dh)/2,width:dw,height:dh});
        }
      }
    }

    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([await outDoc.save()],{type:'application/pdf'}));
    a.download=`일괄리포트_${date}.pdf`;
    a.click();URL.revokeObjectURL(a.href);

    // 원래 학생 복원
    G.selStudent=origStudent;
    autoFillAll();
  }catch(e){alert('일괄 PDF 오류: '+e.message);console.error(e);}
  preview.style.opacity='';
  btn.textContent=origText;btn.disabled=false;
}

// ─── 기능2: 성적 요약표 ───
function dlGradeSummary(){
  if(!G.lessons.length||!G.students.length){alert('수업 및 학생 데이터가 필요합니다.');return;}
  // 날짜 범위 선택 모달 생성
  let overlay=$$('gradeModalOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='gradeModalOverlay';
    overlay.className='lm-overlay';
    overlay.innerHTML=`<div class="lm-modal" style="max-width:440px;">
      <div class="lm-header"><h3>📊 숙제 이행률 요약표 (전체)</h3><button class="lm-close" id="gradeClose">✕</button></div>
      <div style="padding:20px 24px;">
        <div style="font-size:13px;font-weight:700;color:#4e5968;margin-bottom:10px;">날짜 범위 선택</div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:20px;">
          <select id="gradeStart" style="flex:1;padding:10px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;"></select>
          <span style="color:#9ca3af;font-weight:700;">~</span>
          <select id="gradeEnd" style="flex:1;padding:10px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;"></select>
        </div>
        <div id="gradePreview" style="max-height:400px;overflow:auto;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:16px;"></div>
        <div style="display:flex;gap:10px;">
          <button class="btn-s" id="gradeCancel" style="flex:1;">닫기</button>
          <button class="btn-p" id="gradeDl" style="flex:1;">📥 이미지 다운로드</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(overlay);
  }

  // 날짜 옵션 (첫 수업일 제외, 오늘까지만)
  const today=todayKST();
  const gradeDates=G.lessons.filter((l,i)=>i>0&&l.날짜<=today);
  const opts=gradeDates.map(l=>`<option value="${l.날짜}">${shortD(l.날짜)}</option>`).join('');
  $$('gradeStart').innerHTML=opts;
  $$('gradeEnd').innerHTML=opts;
  if(gradeDates.length)$$('gradeEnd').value=gradeDates[gradeDates.length-1].날짜;

  const renderTable=()=>{
    const s=$$('gradeStart').value,e=$$('gradeEnd').value;
    const dates=G.lessons.filter(l=>l.날짜>=s&&l.날짜<=e).map(l=>l.날짜);
    if(!dates.length){$$('gradePreview').innerHTML='<div style="padding:20px;text-align:center;color:#9ca3af;">날짜 범위를 확인하세요</div>';return;}
    _renderGradeTable(dates,$$('gradePreview'));
  };
  $$('gradeStart').onchange=renderTable;
  $$('gradeEnd').onchange=renderTable;
  renderTable();

  overlay.style.display='flex';
  document.body.classList.add('modal-open');
  const close=()=>{overlay.style.display='none';document.body.classList.remove('modal-open');};
  $$('gradeClose').onclick=close;
  $$('gradeCancel').onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close();};
  $$('gradeDl').onclick=async()=>{
    const s=$$('gradeStart').value,e=$$('gradeEnd').value;
    const dates=G.lessons.filter(l=>l.날짜>=s&&l.날짜<=e).map(l=>l.날짜);
    if(!dates.length)return;
    await _downloadGradeImage(dates);
  };
}

function _renderGradeTable(dates,container){
  const rateColor=v=>v>=75?'#166534':v>=30?'#92400e':'#991b1b';
  const rateBg=v=>v>=75?'#dcfce7':v>=30?'#fef3c7':'#fee2e2';
  let html=`<table style="width:100%;border-collapse:collapse;font-size:12px;font-family:Pretendard,sans-serif;">
    <thead><tr style="background:#f8f9fa;">
      <th style="padding:10px 12px;text-align:left;font-weight:800;color:#374151;border-bottom:2px solid #e5e7eb;white-space:nowrap;position:sticky;left:0;background:#f8f9fa;">학생</th>`;
  dates.forEach(d=>html+=`<th style="padding:10px 8px;text-align:center;font-weight:700;color:#6b7280;border-bottom:2px solid #e5e7eb;white-space:nowrap;">${shortD(d)}</th>`);
  html+=`<th style="padding:10px 12px;text-align:center;font-weight:800;color:#374151;border-bottom:2px solid #e5e7eb;white-space:nowrap;">평균</th></tr></thead><tbody>`;

  G.students.forEach((name,si)=>{
    const bg=si%2===0?'#fff':'#f9fafb';
    html+=`<tr style="background:${bg};">
      <td style="padding:8px 12px;font-weight:700;color:#222;border-bottom:1px solid #f0f0f0;white-space:nowrap;">${esc(name)}</td>`;
    let rateSum=0,rateCount=0;
    dates.forEach(d=>{
      const att=G.attend[name]?.[d];
      if(att===-1){
        html+=`<td style="padding:6px 6px;text-align:center;border-bottom:1px solid #f0f0f0;color:#d1d5db;font-size:11px;">-</td>`;
        return;
      }
      const rate=G.rates[name]?.[d];
      if(rate!=null&&rate>=0){
        rateSum+=rate;rateCount++;
        html+=`<td style="padding:6px 6px;text-align:center;border-bottom:1px solid #f0f0f0;">
          <div style="display:inline-block;padding:2px 8px;border-radius:6px;font-weight:700;color:${rateColor(rate)};background:${rateBg(rate)};font-size:12px;">${rate}%</div>
        </td>`;
      }else{
        html+=`<td style="padding:6px 6px;text-align:center;border-bottom:1px solid #f0f0f0;color:#d1d5db;font-size:11px;">결석</td>`;
      }
    });
    const avg=rateCount>0?Math.round(rateSum/rateCount):null;
    if(avg!=null){
      html+=`<td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f0f0f0;font-weight:800;color:${rateColor(avg)};">${avg}%</td>`;
    }else{
      html+=`<td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f0f0f0;color:#d1d5db;">-</td>`;
    }
    html+=`</tr>`;
  });
  html+=`</tbody></table>`;
  container.innerHTML=html;
}

async function _downloadGradeImage(dates){
  const wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;left:-9999px;top:0;';
  document.body.appendChild(wrap);

  const W=Math.max(600,120+dates.length*80);
  const container=document.createElement('div');
  container.style.cssText=`width:${W}px;background:#fff;padding:24px;box-sizing:border-box;font-family:Pretendard,sans-serif;`;
  container.innerHTML=`<div style="text-align:center;margin-bottom:16px;">
    <div style="font-size:18px;font-weight:800;color:#111;">숙제 이행률 요약표</div>
    <div style="font-size:12px;color:#888;margin-top:4px;">${shortD(dates[0])} ~ ${shortD(dates[dates.length-1])}</div>
  </div><div id="_gradeTableCapture"></div>
  <div style="text-align:center;font-size:10px;color:#bbb;padding-top:12px;">Generated by 학습리포트</div>`;
  wrap.appendChild(container);
  _renderGradeTable(dates,container.querySelector('#_gradeTableCapture'));

  const canvas=await html2canvas(container,{scale:2,useCORS:true,backgroundColor:'#fff',
    width:W,scrollX:0,scrollY:0,windowWidth:W});
  document.body.removeChild(wrap);

  canvas.toBlob(blob=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`이행률요약_전체_${dates[0]}_${dates[dates.length-1]}.png`;
    a.click();URL.revokeObjectURL(a.href);
  },'image/png');
}

// ─── 기능3: 수업 일지 이미지 ───
// ─── 수업 일지 출결 현황 HTML ───
function _buildJournalAttendHtml(date){
  const today=todayKST();
  const present=[],late=[],absent=[];
  G.students.forEach(n=>{
    const v=G.attend[n]?.[date];
    if(v===-1)return; // 특수(제외)
    if(v===2)present.push(n);
    else if(v===1)late.push(n);
    else if(v===0)absent.push(n);
    else{
      // 공란: 과거면 결석, 미래면 미정
      if(date<=today)absent.push(n);
    }
  });
  if(!present.length&&!late.length&&!absent.length)return'';
  const pair=(arr,icon,color)=>{
    let h='';
    for(let i=0;i<arr.length;i+=2){
      h+=`<div style="display:flex;gap:8px;">`;
      h+=`<div style="flex:1;font-size:13px;line-height:1.8;color:${color};"><span style="font-weight:700;">${icon}</span> ${esc(arr[i])}</div>`;
      if(arr[i+1])h+=`<div style="flex:1;font-size:13px;line-height:1.8;color:${color};"><span style="font-weight:700;">${icon}</span> ${esc(arr[i+1])}</div>`;
      h+=`</div>`;
    }
    return h;
  };
  let html=`<div style="margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0;">
    <div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:8px;">출결 현황</div>`;
  html+=pair(present,'출석✓','#16a34a');
  html+=pair(late,'지각△','#ca8a04');
  html+=pair(absent,'결석/','#dc2626');
  html+=`</div>`;
  return html;
}

function dlClassJournal(){
  if(!G.lessons.length){alert('수업 데이터가 필요합니다.');return;}
  // 날짜 선택 모달
  let overlay=$$('journalModalOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='journalModalOverlay';
    overlay.className='lm-overlay';
    overlay.innerHTML=`<div class="lm-modal" style="max-width:380px;">
      <div class="lm-header"><h3>📝 수업 일지</h3><button class="lm-close" id="journalClose">✕</button></div>
      <div style="padding:20px 24px;">
        <div style="font-size:13px;font-weight:700;color:#4e5968;margin-bottom:10px;">날짜 선택</div>
        <select id="journalDate" style="width:100%;padding:10px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;margin-bottom:16px;"></select>
        <div id="journalPreview" style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:16px;"></div>
        <button class="btn-p" id="journalDl" style="width:100%;">📥 이미지 다운로드</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
  }

  const opts=G.lessons.map(l=>`<option value="${l.날짜}"${l.날짜===G.selDate?' selected':''}>${fmtKo(l.날짜)}</option>`).join('');
  $$('journalDate').innerHTML=opts;

  const renderPreview=()=>{
    const date=$$('journalDate').value;
    const les=G.lessons.find(l=>l.날짜===date);
    if(!les){$$('journalPreview').innerHTML='';return;}
    const hwKeys=getLessonHwKeys(les);
    const hws=hwKeys.map(k=>les[k]||'').filter(x=>x);
    $$('journalPreview').innerHTML=`
      <div style="font-size:16px;font-weight:800;color:#111;margin-bottom:10px;">${fmtKo(date)}</div>
      <div style="font-size:14px;color:#333;line-height:1.8;">
        <div><span style="font-weight:700;color:#3182f6;">교재</span> ${esc(les.교재||'-')}</div>
        <div><span style="font-weight:700;color:#3182f6;">단원</span> ${esc(les.단원||'-')}</div>
        <div><span style="font-weight:700;color:#3182f6;">상세</span> ${esc(les.상세진도||'-')}</div>
      </div>
      ${hws.length?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0;">
        <div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:6px;">과제</div>
        ${hws.map((h,i)=>`<div style="font-size:13px;color:#333;line-height:1.7;">${i+1}. ${esc(h)}</div>`).join('')}
      </div>`:''}
      ${G.students.length?_buildJournalAttendHtml(date):''}`;
  };
  $$('journalDate').onchange=renderPreview;
  renderPreview();

  overlay.style.display='flex';
  document.body.classList.add('modal-open');
  const close=()=>{overlay.style.display='none';document.body.classList.remove('modal-open');};
  $$('journalClose').onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close();};
  $$('journalDl').onclick=()=>_downloadJournalImage($$('journalDate').value);
}

async function _downloadJournalImage(date){
  const les=G.lessons.find(l=>l.날짜===date);
  if(!les)return;
  const hwKeys=getLessonHwKeys(les);
  const hws=hwKeys.map(k=>les[k]||'').filter(x=>x);

  const wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;left:-9999px;top:0;';
  document.body.appendChild(wrap);

  const W=600;
  const container=document.createElement('div');
  container.style.cssText=`width:${W}px;background:#fff;padding:36px 40px;box-sizing:border-box;font-family:Pretendard,sans-serif;`;
  container.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #111;">
      <div style="font-size:22px;">📝</div>
      <div>
        <div style="font-size:20px;font-weight:800;color:#111;">수업 일지</div>
        <div style="font-size:13px;color:#888;margin-top:2px;">${fmtKo(date)}</div>
      </div>
    </div>
    <div style="font-size:15px;color:#222;line-height:2.0;">
      <div style="display:flex;gap:12px;"><span style="font-weight:800;color:#3182f6;min-width:50px;">교재</span><span>${esc(les.교재||'-')}</span></div>
      <div style="display:flex;gap:12px;"><span style="font-weight:800;color:#3182f6;min-width:50px;">단원</span><span>${esc(les.단원||'-')}</span></div>
      <div style="display:flex;gap:12px;"><span style="font-weight:800;color:#3182f6;min-width:50px;">상세</span><span>${esc(les.상세진도||'-')}</span></div>
    </div>
    ${hws.length?`<div style="margin-top:20px;padding-top:16px;border-top:1.5px solid #e5e7eb;">
      <div style="font-size:13px;font-weight:800;color:#374151;margin-bottom:10px;">📌 과제</div>
      ${hws.map((h,i)=>`<div style="padding:8px 14px;background:#f8f9fa;border-radius:8px;margin-bottom:6px;font-size:14px;color:#333;">
        <span style="font-weight:700;color:#6b7280;margin-right:8px;">${i+1}.</span>${esc(h)}
      </div>`).join('')}
    </div>`:''}
    ${G.students.length?_buildJournalAttendImageHtml(date):''}
    <div style="text-align:center;font-size:10px;color:#bbb;padding-top:16px;">Generated by 학습리포트</div>`;
  wrap.appendChild(container);

  const canvas=await html2canvas(container,{scale:2,useCORS:true,backgroundColor:'#fff',
    width:W,scrollX:0,scrollY:0,windowWidth:W});
  document.body.removeChild(wrap);

  canvas.toBlob(blob=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`수업일지_${date}.png`;
    a.click();URL.revokeObjectURL(a.href);
  },'image/png');
}

function _buildJournalAttendImageHtml(date){
  const today=todayKST();
  const present=[],late=[],absent=[];
  G.students.forEach(n=>{
    const v=G.attend[n]?.[date];
    if(v===-1)return;
    if(v===2)present.push(n);
    else if(v===1)late.push(n);
    else if(v===0)absent.push(n);
    else{if(date<=today)absent.push(n);}
  });
  if(!present.length&&!late.length&&!absent.length)return'';
  const bg=c=>c==='#16a34a'?'#f0fdf4':c==='#ca8a04'?'#fefce8':'#fef2f2';
  const pairImg=(arr,icon,color)=>{
    let h='';
    for(let i=0;i<arr.length;i+=2){
      h+=`<div style="display:flex;gap:6px;margin-bottom:4px;">`;
      h+=`<div style="flex:1;padding:6px 14px;background:${bg(color)};border-radius:8px;font-size:14px;color:${color};display:flex;align-items:center;gap:8px;">
        <span style="font-weight:800;">${icon}</span><span style="color:#333;">${esc(arr[i])}</span></div>`;
      if(arr[i+1])h+=`<div style="flex:1;padding:6px 14px;background:${bg(color)};border-radius:8px;font-size:14px;color:${color};display:flex;align-items:center;gap:8px;">
        <span style="font-weight:800;">${icon}</span><span style="color:#333;">${esc(arr[i+1])}</span></div>`;
      else h+=`<div style="flex:1;"></div>`;
      h+=`</div>`;
    }
    return h;
  };
  let html=`<div style="margin-top:20px;padding-top:16px;border-top:1.5px solid #e5e7eb;">
    <div style="font-size:13px;font-weight:800;color:#374151;margin-bottom:10px;">📋 출결 현황</div>`;
  html+=pairImg(present,'출석 ✓','#16a34a');
  html+=pairImg(late,'지각 △','#ca8a04');
  html+=pairImg(absent,'결석 /','#dc2626');
  html+=`</div>`;
  return html;
}

// ─── 이행률 표 임시 삭제 (저장 안 됨) ───
let _stuRptRemoved=new Set();
let _stuRptRerender=null;
function _stuRptRemoveItem(key){
  _stuRptRemoved.add(key);
  if(_stuRptRerender)_stuRptRerender();
}

// ─── 학생별 리포트 요약 ───
function dlStudentReport(preselect){
  if(!G.lessons.length||!G.students.length){alert('수업 및 학생 데이터가 필요합니다.');return;}
  if(G.selStudent)saveTabData();

  let overlay=$$('stuRptOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='stuRptOverlay';
    overlay.className='lm-overlay';
    overlay.innerHTML=`<div class="lm-modal" id="stuRptModal" style="max-width:520px;max-height:85vh;display:flex;flex-direction:column;transition:max-width .25s ease;">
      <div class="lm-header"><h3>📊 숙제 이행률 요약표 (학생별)</h3><button class="lm-close" id="stuRptClose">✕</button></div>
      <div style="padding:16px 24px 0;display:flex;flex-direction:column;gap:10px;flex-shrink:0;">
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="stuRptStudent" style="flex:1;padding:10px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;font-weight:700;"></select>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="stuRptStart" style="flex:1;padding:10px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;"></select>
          <span style="color:#9ca3af;font-weight:700;">~</span>
          <select id="stuRptEnd" style="flex:1;padding:10px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;"></select>
        </div>
      </div>
      <div style="flex:1;display:flex;min-height:0;overflow:hidden;">
        <div id="stuRptPreview" style="flex:1;overflow-y:auto;padding:12px 20px;min-height:0;"></div>
        <div id="stuRptWing" style="width:0;overflow:hidden;transition:width .25s ease;border-left:0 solid #e5e7eb;flex-shrink:0;">
          <div id="stuRptWingContent" style="width:260px;padding:14px;overflow-y:auto;height:100%;box-sizing:border-box;"></div>
        </div>
      </div>
      <div style="padding:12px 24px 16px;display:flex;gap:10px;flex-shrink:0;">
        <button class="btn-s" id="stuRptCancel" style="flex:1;">닫기</button>
        <button class="btn-p" id="stuRptDl" style="flex:1;">💾 저장하기</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
  }

  // 학생 옵션
  $$('stuRptStudent').innerHTML=G.students.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  const initStudent=preselect||G.selStudent;
  if(initStudent)$$('stuRptStudent').value=initStudent;
  // 날짜 옵션 (첫 수업일 제외, 오늘까지만)
  const stuToday=todayKST();
  const stuDates=G.lessons.filter((l,i)=>i>0&&l.날짜<=stuToday);
  const dateOpts=stuDates.map(l=>`<option value="${l.날짜}">${shortD(l.날짜)}</option>`).join('');
  $$('stuRptStart').innerHTML=dateOpts;
  $$('stuRptEnd').innerHTML=dateOpts;
  if(stuDates.length)$$('stuRptEnd').value=stuDates[stuDates.length-1].날짜;

  let wingOpen=false;
  const render=()=>{
    _renderStudentReport($$('stuRptStudent').value,$$('stuRptStart').value,$$('stuRptEnd').value,$$('stuRptPreview'),{interactive:true,removedSet:_stuRptRemoved});
    if(wingOpen)_renderWingPanel();
    // 요약 카드 영역에 미완료 버튼 삽입
    setTimeout(()=>{
      const summaryDiv=$$('stuRptPreview')?.querySelector('[data-summary]');
      if(summaryDiv){
        let wingBtn=summaryDiv.querySelector('.stu-rpt-wing-toggle');
        if(!wingBtn){
          wingBtn=document.createElement('button');
          wingBtn.className='stu-rpt-wing-toggle';
          wingBtn.style.cssText='position:absolute;top:8px;right:8px;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;border:1px solid #fca5a5;background:#fef2f2;color:#991b1b;cursor:pointer;transition:.15s;font-family:inherit;';
          wingBtn.textContent=wingOpen?'✕ 닫기':'📋 미완료 모아보기';
          wingBtn.onclick=toggleWing;
          summaryDiv.style.position='relative';
          summaryDiv.appendChild(wingBtn);
        }
      }
    },0);
  };
  const _renderWingPanel=()=>{
    const student=$$('stuRptStudent').value;
    const s=$$('stuRptStart').value,e=$$('stuRptEnd').value;
    const dates=G.lessons.filter(l=>l.날짜>=s&&l.날짜<=e).map(l=>l.날짜).filter(d=>G.attend[student]?.[d]!==-1);
    // 미완료 수집 (resolvedMap과 동일 로직)
    const rMap=new Map();
    dates.forEach(d=>{const rec=G.hwRec[`${student}||${d}`];(rec?.items||[]).forEach(it=>{
      if(isCarryForDate(it.fromDate,d)&&it.ref&&!isNone(it.status)){const pv=rMap.get(it.ref);if(pv==null||it.status>pv)rMap.set(it.ref,it.status);}
    });});
    const inc=[];
    dates.forEach(d=>{const rec=G.hwRec[`${student}||${d}`];const les=G.lessons.find(l=>l.날짜===d);
      (rec?.items||[]).forEach(it=>{
        if(isCarryForDate(it.fromDate,d)||isNone(it.status))return;
        if(it.status===1){const r=rMap.get(it.ref);if(!(r!=null&&r>=1))inc.push({text:it.text,status:1,date:d,lesson:les});}
        else if(it.status===0){const r=rMap.get(it.ref);if(r===2||r===1){}else inc.push({text:it.text,status:0,date:d,lesson:les});}
      });
    });
    const wc=$$('stuRptWingContent');
    if(!inc.length){wc.innerHTML='<div style="text-align:center;color:#22c55e;font-size:13px;font-weight:700;padding:40px 0;">✓ 미완료 과제 없음</div>';return;}
    const stL={0:'미완료',1:'부분완료'};const stC={0:'#991b1b',1:'#92400e'};const stB={0:'#fee2e2',1:'#fef3c7'};
    let h=`<div style="font-size:13px;font-weight:800;color:#991b1b;margin-bottom:10px;">미완료 과제 <span style="padding:1px 7px;border-radius:8px;font-size:11px;background:#ef4444;color:#fff;">${inc.length}</span></div>`;
    let ld='';
    inc.forEach(it=>{
      if(it.date!==ld){h+=`<div style="font-size:9px;font-weight:700;color:#9ca3af;margin-top:${ld?'8':'0'}px;padding:2px 0;">${shortD(it.date)}</div>`;ld=it.date;}
      h+=`<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:5px;background:${stB[it.status]};margin-bottom:3px;">
        <span style="font-size:10px;font-weight:700;color:${stC[it.status]};flex-shrink:0;">${stL[it.status]}</span>
        <span style="font-size:11px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(it.text)}</span>
      </div>`;
    });
    wc.innerHTML=h;
  };
  const toggleWing=()=>{
    wingOpen=!wingOpen;
    const wing=$$('stuRptWing');const modal=$$('stuRptModal');
    if(wingOpen){_renderWingPanel();wing.style.width='260px';wing.style.borderLeftWidth='1.5px';modal.style.maxWidth='800px';}
    else{wing.style.width='0';wing.style.borderLeftWidth='0';modal.style.maxWidth='520px';}
    // 요약 카드 내 버튼 텍스트 갱신
    const wb=$$('stuRptPreview')?.querySelector('.stu-rpt-wing-toggle');
    if(wb)wb.textContent=wingOpen?'✕ 닫기':'📋 미완료 모아보기';
  };
  _stuRptRerender=render;
  $$('stuRptStudent').onchange=()=>{_stuRptRemoved.clear();render();};
  $$('stuRptStart').onchange=render;
  $$('stuRptEnd').onchange=render;
  render();

  overlay.style.display='flex';
  document.body.classList.add('modal-open');
  const close=()=>{overlay.style.display='none';document.body.classList.remove('modal-open');wingOpen=false;_stuRptRemoved.clear();_stuRptRerender=null;$$('stuRptWing').style.width='0';$$('stuRptWing').style.borderLeftWidth='0';$$('stuRptModal').style.maxWidth='520px';};
  $$('stuRptClose').onclick=close;
  $$('stuRptCancel').onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close();};
  $$('stuRptDl').onclick=()=>{
    _closePdfMenu();
    const student=$$('stuRptStudent').value;
    const s=$$('stuRptStart').value,e=$$('stuRptEnd').value;
    const dates=G.lessons.filter(l=>l.날짜>=s&&l.날짜<=e).map(l=>l.날짜)
      .filter(d=>G.attend[student]?.[d]!==-1);
    if(!dates.length)return;
    // 저장 옵션 메뉴
    const menu=document.createElement('div');
    menu.className='pdf-attach-menu';menu.id='pdfAttachMenu';
    menu.style.cssText='position:fixed;z-index:9999;';
    // 현재 제거된 항목 스냅샷 저장
    window._stuRptRemovedSnap=new Set(_stuRptRemoved);
    menu.innerHTML=`
      <button onclick="_closePdfMenu();_downloadStudentReportPdf('${esc(student)}',[${dates.map(d=>`'${d}'`).join(',')}],window._stuRptRemovedSnap);">
        <span style="font-size:16px;">📥</span> PDF로 다운로드
      </button>
      <div class="pam-sep"></div>
      <button onclick="_closePdfMenu();_attachStudentReportToView('${esc(student)}',[${dates.map(d=>`'${d}'`).join(',')}],{removedSet:window._stuRptRemovedSnap});">
        <span style="font-size:16px;">📌</span> 리포트에 첨부하기
      </button>`;
    document.body.appendChild(menu);
    const rect=$$('stuRptDl').getBoundingClientRect();
    menu.style.left=rect.left+'px';
    menu.style.bottom=(window.innerHeight-rect.top+6)+'px';
    setTimeout(()=>document.addEventListener('click',_closePdfMenuOnClick,{once:true}),0);
  };
}

function _renderStudentReport(student,startDate,endDate,container,opts){
  opts=opts||{};
  const removedSet=opts.removedSet;
  const interactive=opts.interactive;
  const dates=G.lessons.filter(l=>l.날짜>=startDate&&l.날짜<=endDate).map(l=>l.날짜)
    .filter(d=>G.attend[student]?.[d]!==-1); // 출결 -1(특수) 제외
  if(!dates.length){container.innerHTML='<div style="padding:20px;text-align:center;color:#9ca3af;">날짜 범위를 확인하세요</div>';return;}

  const stLabel={2:'완료',1:'부분완료',0:'미완료',-1:'미제출'};
  const stColor={2:'#166534',1:'#92400e',0:'#991b1b',-1:'#6b7280'};
  const stBg={2:'#dcfce7',1:'#fef3c7',0:'#fee2e2',-1:'#f3f4f6'};
  const rateColor=v=>v>=75?'#166534':v>=30?'#92400e':'#991b1b';
  const rateBg=v=>v>=75?'#dcfce7':v>=30?'#fef3c7':'#fee2e2';

  // 통계 계산
  let rateSum=0,rateCount=0,totalHw=0,doneHw=0,partialHw=0,missHw=0,unsubmittedHw=0;
  // 이월에서 해결된 ref → 최종 상태 매핑 수집
  const resolvedMap=new Map();
  dates.forEach(d=>{
    const key=`${student}||${d}`;
    const rec=G.hwRec[key];
    (rec?.items||[]).forEach(it=>{
      if(isCarryForDate(it.fromDate,d)&&it.ref&&!isNone(it.status)){
        const prev=resolvedMap.get(it.ref);
        if(prev==null||it.status>prev)resolvedMap.set(it.ref,it.status);
      }
    });
  });
  // 완료한 과제 수: 한 번에 완료(2) + 한 번에 부분완료(1) + 이월 통해 부분완료 이상
  let completedHw=0;
  const incompleteItems=[]; // 미완료 과제 수집
  dates.forEach(d=>{
    const rate=G.rates[student]?.[d];
    if(rate!=null&&!isNaN(rate)){rateSum+=rate;rateCount++;}
    const key=`${student}||${d}`;
    const rec=G.hwRec[key];
    const items=rec?.items||[];
    const lesson=G.lessons.find(l=>l.날짜===d);
    items.forEach((it,origIdx)=>{
      if(isCarryForDate(it.fromDate,d))return;
      if(removedSet&&removedSet.has(`${student}||${d}||${origIdx}`))return;
      totalHw++;
      if(isNone(it.status)){unsubmittedHw++;incompleteItems.push({text:it.text,status:-1,date:d,lesson});return;}
      if(it.status===2){doneHw++;completedHw++;}
      else if(it.status===1){
        partialHw++;
        const resolved=resolvedMap.get(it.ref);
        if(resolved!=null&&resolved>=1)completedHw++;
        else incompleteItems.push({text:it.text,status:1,date:d,lesson});
      }
      else if(it.status===0){
        const resolved=resolvedMap.get(it.ref);
        if(resolved===2){doneHw++;completedHw++;}
        else if(resolved===1){partialHw++;completedHw++;}
        else{missHw++;incompleteItems.push({text:it.text,status:0,date:d,lesson});}
      }
    });
  });
  const avgRate=rateCount>0?Math.round(rateSum/rateCount):null;

  const cmp=opts.compact;
  const fs=cmp?{title:'11px',num:'14px',label:'8px',sub:'9px',pad:'8px 10px',gap:'5px',mb:'8px'}
    :{title:'15px',num:'20px',label:'10px',sub:'11px',pad:'16px',gap:'8px',mb:'14px'};

  // 요약 카드
  let html=`<div data-summary style="background:#f8f9fa;border-radius:10px;padding:${fs.pad};margin-bottom:${fs.mb};">
    <div style="font-size:${fs.title};font-weight:800;color:#111;margin-bottom:8px;">${esc(student)} 종합 요약</div>
    <div style="display:flex;gap:${fs.gap};flex-wrap:wrap;">
      <div style="flex:1;min-width:80px;background:#fff;border-radius:6px;padding:6px 8px;border:1px solid #e5e7eb;text-align:center;">
        <div style="font-size:${fs.label};color:#888;margin-bottom:2px;">평균 이행률</div>
        <div style="font-size:${fs.num};font-weight:800;color:${avgRate!=null?rateColor(avgRate):'#d1d5db'};">${avgRate!=null?avgRate+'%':'-'}</div>
      </div>
      <div style="flex:1;min-width:80px;background:#fff;border-radius:6px;padding:6px 8px;border:1px solid #e5e7eb;text-align:center;">
        <div style="font-size:${fs.label};color:#888;margin-bottom:2px;">수업 횟수</div>
        <div style="font-size:${fs.num};font-weight:800;color:#111;">${rateCount}<span style="font-size:${fs.sub};color:#999;">/${dates.length}회</span></div>
      </div>
      <div style="flex:1;min-width:80px;background:#fff;border-radius:6px;padding:6px 8px;border:1px solid #e5e7eb;text-align:center;">
        <div style="font-size:${fs.label};color:#888;margin-bottom:2px;">완료한 과제</div>
        <div style="font-size:${fs.num};font-weight:800;color:${totalHw?rateColor(Math.round(completedHw/totalHw*100)):'#d1d5db'};">${completedHw}<span style="font-size:${fs.sub};color:#999;">/${totalHw}개</span></div>
      </div>
    </div>
    ${totalHw?`<div style="display:flex;gap:10px;margin-top:6px;font-size:${fs.sub};">
      <span style="color:#166534;">완료 ${doneHw}</span>
      <span style="color:#92400e;">부분완료 ${partialHw}</span>
      <span style="color:#991b1b;">미완료 ${missHw}</span>
      ${unsubmittedHw?`<span style="color:#6b7280;">미제출 ${unsubmittedHw}</span>`:''}
    </div>`:''}
  </div>`;

  // 날짜별 상세
  const stIcons={2:'✓',1:'△',0:'✗',-1:'—'};
  if(cmp){
    // ── 컴팩트 테이블 모드 (PDF용, 한 페이지 맞춤) ──
    html+=`<table style="width:100%;border-collapse:collapse;font-size:9px;font-family:Pretendard,sans-serif;">
      <thead><tr style="background:#f1f3f5;border-bottom:1.5px solid #d1d5db;">
        <th style="padding:3px 6px;text-align:left;font-weight:700;color:#555;white-space:nowrap;">날짜</th>
        <th style="padding:3px 6px;text-align:center;font-weight:700;color:#555;white-space:nowrap;">이행률</th>
        <th style="padding:3px 6px;text-align:left;font-weight:700;color:#555;">과제 현황</th>
      </tr></thead><tbody>`;
    dates.forEach((d,di)=>{
      const rate=G.rates[student]?.[d];
      const key=`${student}||${d}`;
      const rec=G.hwRec[key];
      const allDateItems=rec?.items||[];
      const itemsWithIdx=allDateItems.map((it,i)=>({...it,_oi:i})).filter(it=>!isCarryForDate(it.fromDate,d));
      const items=removedSet?itemsWithIdx.filter(it=>!removedSet.has(`${student}||${d}||${it._oi}`)):itemsWithIdx;
      const hasRate=rate!=null&&!isNaN(rate);
      const bg=di%2===0?'#fff':'#f9fafb';
      const visible=items.filter(it=>{const st=isNone(it.status)?-1:it.status;return stLabel[st]!=null;});
      const hwParts=visible.map(it=>{
        const st=isNone(it.status)?-1:it.status;
        return`<span style="color:${stColor[st]};white-space:nowrap;">${stIcons[st]}${esc(it.text)}</span>`;
      }).join('&nbsp; ');
      html+=`<tr style="background:${bg};border-bottom:1px solid #eee;">
        <td style="padding:3px 6px;white-space:nowrap;font-weight:600;color:#333;">${shortD(d)}</td>
        <td style="padding:3px 6px;text-align:center;">${hasRate?`<span style="padding:1px 5px;border-radius:4px;font-weight:700;font-size:9px;color:${rateColor(rate)};background:${rateBg(rate)};">${rate}%</span>`:`<span style="color:#dc2626;font-size:8px;">결석</span>`}</td>
        <td style="padding:3px 6px;font-size:9px;line-height:1.5;">${hwParts||'<span style="color:#d1d5db;">-</span>'}</td>
      </tr>`;
    });
    html+=`</tbody></table>`;
  }else{
    // ── 카드 모드 (미리보기용) ──
    dates.forEach(d=>{
      const rate=G.rates[student]?.[d];
      const key=`${student}||${d}`;
      const rec=G.hwRec[key];
      const lesson=G.lessons.find(l=>l.날짜===d);
      const allDateItems=rec?.items||[];
      const itemsWithIdx=allDateItems.map((it,i)=>({...it,_oi:i})).filter(it=>!isCarryForDate(it.fromDate,d));
      const items=removedSet?itemsWithIdx.filter(it=>!removedSet.has(`${student}||${d}||${it._oi}`)):itemsWithIdx;
      const hasRate=rate!=null&&!isNaN(rate);
      const isAbsent=!hasRate;

      html+=`<div style="border:1px solid #d1d5db;border-radius:8px;margin-bottom:10px;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:${isAbsent?'#fef2f2':'#f0f1f3'};border-bottom:1px solid #d1d5db;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:13px;font-weight:800;color:#222;">${fmtKo(d)}</span>
            ${lesson?`<span style="font-size:11px;color:#888;">${esc(lesson.교재||'')} ${esc(lesson.단원||'')}</span>`:''}
          </div>
          ${isAbsent?`<span style="font-size:11px;font-weight:700;color:#dc2626;">결석</span>`
            :`<span style="padding:1px 6px;border-radius:5px;font-size:12px;font-weight:700;color:${rateColor(rate)};background:${rateBg(rate)};">${rate}%</span>`}
        </div>`;

      if(!isAbsent){
        const visible=items.filter(it=>{const st=isNone(it.status)?-1:it.status;return stLabel[st]!=null;});
        if(visible.length){
          html+=`<div style="padding:8px 12px;display:flex;flex-direction:column;gap:2px;">`;
          visible.forEach(it=>{
            const st=isNone(it.status)?-1:it.status;
            const showDel=interactive&&st!==2;
            html+=`<div style="display:flex;align-items:center;gap:6px;padding:2px 6px;border-radius:4px;background:#fff;">
              <span style="flex:1;font-size:12px;color:${st===-1?'#9ca3af':'#333'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(it.text)}</span>
              <span style="padding:0px 5px;border-radius:3px;font-size:10px;font-weight:700;color:${stColor[st]};background:${stBg[st]};flex-shrink:0;">${stLabel[st]}</span>
              ${showDel?`<button onclick="_stuRptRemoveItem('${student}||${d}||${it._oi}')" style="width:18px;height:18px;border-radius:50%;border:1px solid #fca5a5;background:#fef2f2;color:#ef4444;font-size:13px;font-weight:700;cursor:pointer;padding:0;line-height:16px;flex-shrink:0;" title="이 과제 제외">−</button>`:''}
            </div>`;
          });
          html+=`</div>`;
        }else{
          html+=`<div style="padding:8px 12px;font-size:12px;color:#9ca3af;">과제 없음</div>`;
        }
        // 이월과제 비고
        const carryStDesc={2:'완료',1:'일부 완료',0:'미완료'};
        const allCarries=(rec?.items||[]).filter(it=>isCarryForDate(it.fromDate,d)&&it.ref&&!isNone(it.status));
        const changedCarries=allCarries.filter(it=>{
          const orig=_getOriginalRefStatus(student,it.ref);
          return orig!=null&&it.status!==orig;
        });
        const cSeen=new Map();
        changedCarries.forEach(it=>{cSeen.set(it.ref,it);});
        const uniqueCarries=[...cSeen.values()];
        if(uniqueCarries.length){
          html+=`<div style="padding:6px 12px 8px;border-top:1px dashed #d1d5db;">`;
          uniqueCarries.forEach(it=>{
            const cd=refToCheckDate(it.ref);
            const fd=cd?`${shortD(cd)} 출제`:'이전 수업';
            const isDone=it.status===2;
            const cColor=isDone?'#166534':it.status===1?'#92400e':'#991b1b';
            const cBg=isDone?'#f0fdf4':it.status===1?'#fffbeb':'#fef2f2';
            html+=`<div style="display:flex;align-items:center;gap:4px;padding:2px 6px;border-radius:4px;background:${cBg};margin-bottom:2px;">
              <span style="font-size:10px;font-weight:700;color:#d97706;flex-shrink:0;">이월</span>
              <span style="flex:1;font-size:11px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(it.text)} <span style="color:#999;font-size:10px;">(${fd})</span></span>
              <span style="font-size:10px;font-weight:700;color:${cColor};flex-shrink:0;">${carryStDesc[it.status]}</span>
            </div>`;
          });
          html+=`</div>`;
        }
      }
      html+=`</div>`;
    });
  }

  container.innerHTML=html;
}

// + 버튼에서 이행률 요약표 바로 첨부
async function _attachSummaryForCurrent(){
  const student=G.selStudent;
  if(!student){alert('학생을 선택해주세요.');return;}
  const todayStr=todayKST();
  const dates=G.lessons.filter((l,i)=>i>0&&l.날짜<=todayStr).map(l=>l.날짜)
    .filter(d=>G.attend[student]?.[d]!==-1);
  if(!dates.length){alert('해당 학생의 수업 데이터가 없습니다.');return;}
  await _attachStudentReportToView(student,dates,{btn:null,closeModal:false});
}

// 요약표를 현재 학생 PDF로 첨부
async function _attachStudentReportToView(student,dates,opts){
  // opts.btn: 진행 표시용 버튼 (없으면 상태바 사용), opts.closeModal: 모달 닫기 여부
  const btn=opts?.btn||$$('stuRptDl');
  const origText=btn?btn.textContent:'';
  if(btn){btn.textContent='⏳ 첨부 중...';btn.disabled=true;}
  else setBar('wait','⏳ 요약표 생성 중...');
  try{
    const W=400;
    const wrap=document.createElement('div');
    wrap.style.cssText='position:fixed;left:-9999px;top:0;';
    document.body.appendChild(wrap);
    const container=document.createElement('div');
    container.style.cssText=`width:${W}px;background:#fff;padding:20px 24px;box-sizing:border-box;font-family:Pretendard,sans-serif;`;
    container.innerHTML=`<div style="text-align:center;margin-bottom:6px;">
      <div style="font-size:14px;font-weight:800;color:#111;">숙제 이행률 요약표</div>
      <div style="font-size:10px;color:#888;margin-top:2px;">${shortD(dates[0])} ~ ${shortD(dates[dates.length-1])}</div>
    </div><div id="_stuRptAttach"></div>`;
    wrap.appendChild(container);
    _renderStudentReport(student,dates[0],dates[dates.length-1],container.querySelector('#_stuRptAttach'),{compact:true,removedSet:opts?.removedSet});
    const canvas=await html2canvas(container,{scale:2,useCORS:true,backgroundColor:'#fff',width:W,scrollX:0,scrollY:0,windowWidth:W});
    document.body.removeChild(wrap);
    // A4 캔버스 생성 (리포트카드와 동일 비율)
    const a4w=794*2.5,a4h=1123*2.5;
    const cv=document.createElement('canvas');cv.width=a4w;cv.height=a4h;
    const ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,a4w,a4h);
    const scale=Math.min((a4w*0.9)/canvas.width,(a4h*0.85)/canvas.height);
    const dw=canvas.width*scale,dh=canvas.height*scale;
    ctx.drawImage(canvas,(a4w-dw)/2,(a4h-dh)/2*0.4,dw,dh);
    const pngUrl=cv.toDataURL('image/png');
    const pngBytes=dataUrlToBytes(pngUrl);
    // 기존 PDF 교체
    G.studentPdfs[student]=[{bytes:pngBytes,name:'이행률요약표.png',canvases:[cv],pageCount:1,isPng:true}];
    _syncGlobalPdf();G.currentSpread=0;renderSpread();renderTabs();_savePdfData();
    // 모달 닫기 (모달에서 호출된 경우만)
    if(opts?.closeModal!==false){
      const overlay=$$('stuRptOverlay');
      if(overlay&&overlay.style.display!=='none'){overlay.style.display='none';document.body.classList.remove('modal-open');}
    }
    if(!btn)setBar('ok','✅ 요약표 첨부 완료');
  }catch(e){
    if(btn)alert('첨부 오류: '+e.message);
    else setBar('err','❌ 요약표 첨부 실패: '+e.message);
    console.error(e);
  }
  if(btn){btn.textContent=origText;btn.disabled=false;}
}

async function _downloadStudentReportPdf(student,dates,removedSet){
  const btn=$$('stuRptDl');
  const origText=btn.textContent;btn.textContent='⏳ 생성 중...';btn.disabled=true;
  try{
    const W=400;
    const wrap=document.createElement('div');
    wrap.style.cssText='position:fixed;left:-9999px;top:0;';
    document.body.appendChild(wrap);

    const container=document.createElement('div');
    container.style.cssText=`width:${W}px;background:#fff;padding:20px 24px;box-sizing:border-box;font-family:Pretendard,sans-serif;`;
    container.innerHTML=`<div style="text-align:center;margin-bottom:6px;">
      <div style="font-size:14px;font-weight:800;color:#111;">숙제 이행률 요약표</div>
      <div style="font-size:10px;color:#888;margin-top:2px;">${shortD(dates[0])} ~ ${shortD(dates[dates.length-1])}</div>
    </div><div id="_stuRptCapture"></div>
    <div style="text-align:center;font-size:8px;color:#ccc;padding-top:8px;">Generated by 학습리포트</div>`;
    wrap.appendChild(container);
    _renderStudentReport(student,dates[0],dates[dates.length-1],container.querySelector('#_stuRptCapture'),{compact:true,removedSet:removedSet});

    const canvas=await html2canvas(container,{scale:2,useCORS:true,backgroundColor:'#fff',
      width:W,scrollX:0,scrollY:0,windowWidth:W});
    document.body.removeChild(wrap);

    // A4 PDF (세로) — 한 페이지에 맞춤, 넘치면 분할
    const{PDFDocument}=PDFLib;
    const pdfDoc=await PDFDocument.create();
    const pW=595.28,pH=841.89,margin=30;
    const contentW=pW-margin*2;
    const scale=contentW/canvas.width;
    const contentH=pH-margin*2;
    const pageImgH=contentH/scale;

    const totalPages=Math.ceil(canvas.height/pageImgH);
    for(let p=0;p<totalPages;p++){
      const srcY=p*pageImgH;
      const srcH=Math.min(pageImgH,canvas.height-srcY);
      const sliceCv=document.createElement('canvas');
      sliceCv.width=canvas.width;sliceCv.height=srcH;
      sliceCv.getContext('2d').drawImage(canvas,0,srcY,canvas.width,srcH,0,0,canvas.width,srcH);
      const pngBytes=dataUrlToBytes(sliceCv.toDataURL('image/png'));
      const pngImg=await pdfDoc.embedPng(pngBytes);
      const dw=contentW,dh=srcH*scale;
      const page=pdfDoc.addPage([pW,pH]);
      page.drawImage(pngImg,{x:margin,y:pH-margin-dh,width:dw,height:dh});
    }

    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([await pdfDoc.save()],{type:'application/pdf'}));
    a.download=`이행률요약_${student}_${dates[0]}_${dates[dates.length-1]}.pdf`;
    a.click();URL.revokeObjectURL(a.href);
  }catch(e){alert('PDF 오류: '+e.message);console.error(e);}
  btn.textContent=origText;btn.disabled=false;
}

// ─── 업데이트 내역 모달 ───
async function showUpdateModal(){
  let overlay=$$('updateModalOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='updateModalOverlay';
    overlay.className='lm-overlay';
    overlay.innerHTML=`<div class="lm-modal" style="max-width:520px;max-height:80vh;">
      <div class="lm-header"><h3>🔄 업데이트 내역</h3><button class="lm-close" id="updateClose">✕</button></div>
      <div id="updateBody" style="padding:20px 24px;overflow-y:auto;max-height:60vh;font-family:Pretendard,sans-serif;"></div>
    </div>`;
    document.body.appendChild(overlay);
  }
  overlay.style.display='flex';
  document.body.classList.add('modal-open');
  const close=()=>{overlay.style.display='none';document.body.classList.remove('modal-open');};
  $$('updateClose').onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close();};
  const body=$$('updateBody');
  body.innerHTML='<div style="text-align:center;color:#9ca3af;padding:20px;">로딩 중...</div>';
  try{
    const res=await fetch('updates.md?t='+Date.now());
    const text=await res.text();
    const html=text.split('\n').map(line=>{
      if(line.startsWith('# '))return`<div style="font-size:18px;font-weight:800;color:#111;margin-bottom:16px;">${esc(line.slice(2))}</div>`;
      if(line.startsWith('## '))return`<div style="font-size:14px;font-weight:700;color:#3182f6;margin-top:16px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">${esc(line.slice(3))}</div>`;
      if(line.startsWith('- '))return`<div style="font-size:13px;color:#333;padding:2px 0 2px 12px;line-height:1.6;">• ${esc(line.slice(2))}</div>`;
      return'';
    }).join('');
    body.innerHTML=html;
  }catch(e){
    body.innerHTML='<div style="text-align:center;color:#dc2626;padding:20px;">업데이트 내역을 불러올 수 없습니다.</div>';
  }
}
