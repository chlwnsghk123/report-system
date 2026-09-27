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
    // 첫 페이지 캔버스만 사용 (세션 한정 — 새로고침하면 사라지며 IndexedDB에 저장하지 않음)
    if(totalPages>1){
      alert(`이 PDF는 ${totalPages}페이지입니다. 첫 페이지만 첨부됩니다.`);
    }
    return{name:file.name,canvases:[cv],pageCount:1};
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

// 하위 호환: 전역 pdfCanvases를 현재 학생 기준으로 동기화
function _syncGlobalPdf(){
  G.pdfCanvases=G.selStudent?_getStudentPdfCanvases(G.selStudent):[];
}

async function handlePdfInput(input){
  const file=input.files[0];if(!file)return;
  const pdfData=await _processPdfFile(file);
  if(!pdfData){input.value='';return;}
  if(_pdfAttachTarget==='_all_'){
    G.students.forEach(s=>{
      G.studentPdfs[s]=[];  // 전체 교체
      _addPdfToStudent(s,{
        name:pdfData.name,pageCount:pdfData.pageCount,
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
  renderSpread();renderTabs();
  setBar('ok',`✅ ${G.excelFileName}`);
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

function removeAllStudentPdfs(student){
  if(!confirm(`${student} 학생의 모든 PDF를 삭제하시겠습니까?`))return;
  delete G.studentPdfs[student];
  _syncGlobalPdf();
  renderSpread();renderTabs();
}

function renderSpread(){
  _syncGlobalPdf();
  const rc=$$('reportCard'),lc=$$('leftPdfCanvas'),rs=$$('rightSlot'),rpc=$$('rightPdfCanvas');
  // 기존 X 버튼 제거
  document.querySelectorAll('.pdf-page-del').forEach(el=>el.remove());
  // 항상 리포트 표시 (왼쪽)
  rc.style.display='';lc.style.display='none';$$('leftLabel').textContent='리포트';
  // 오른쪽: 첨부 PDF 1장 표시
  const hasPdf=G.pdfCanvases.length>0;
  if(hasPdf){
    rs.style.display='';
    drawPdfPrev(rpc,G.pdfCanvases[0]);
    $$('rightLabel').textContent='시험자료';
    _addPdfDelBtn(rs,G.selStudent);
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
  btn.onclick=()=>removeAllStudentPdfs(studentName); // 원래 이름을 클로저로 전달 (이스케이프·디코딩 불필요)
  slot.appendChild(btn);
}
function drawPdfPrev(tgt,src){
  tgt.width=src.width;tgt.height=src.height;
  tgt.style.width='794px';tgt.style.height='1123px';
  tgt.style.transformOrigin='top center';
  tgt.getContext('2d').drawImage(src,0,0);
}

// ─── 공용 헬퍼 (다운로드·캡처·PDF 페이지) ───
// Blob 다운로드 — 클릭 직후 revoke하면 다운로드가 취소될 수 있어 지연 해제
function _downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function _canvasToBlob(cv,type,quality){
  return new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error('이미지 변환 실패')),type,quality));
}
// 캔버스 → JPG Blob (w를 주면 그 폭으로 리사이즈, 배경 흰색)
function _canvasToJpgBlob(cv,w){
  let src=cv;
  if(w&&cv.width!==w){
    src=document.createElement('canvas');src.width=w;src.height=Math.round(cv.height*w/cv.width);
    const ctx=src.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,src.width,src.height);
    ctx.imageSmoothingQuality='high';ctx.drawImage(cv,0,0,src.width,src.height);
  }
  return _canvasToBlob(src,'image/jpeg',0.92);
}
// 파일명에 쓸 수 없는 문자 치환
function _safeName(s){return String(s||'').replace(/[\\/:*?"<>|]/g,'_').trim()||'학생';}
// 리포트카드(#reportCard)를 화면 배율과 무관하게 원본 A4 크기로 캡처
async function _captureReportCard(scale=2){
  document.querySelectorAll('[contenteditable]').forEach(e=>e.blur());
  const rc=$$('reportCard');
  return html2canvas(rc,{scale,useCORS:true,backgroundColor:'#fff',
    onclone:doc=>{const c=doc.getElementById('reportCard');c.style.transform='none';c.style.margin='0';
      const sr=doc.getElementById('spreadRow');if(sr){sr.style.transform='none';sr.style.marginBottom='';}
      doc.querySelectorAll('[contenteditable]').forEach(e=>e.style.outline='none');},
    width:rc.offsetWidth,height:rc.offsetHeight,scrollX:0,scrollY:0,windowWidth:rc.offsetWidth,windowHeight:rc.offsetHeight});
}
// 요소(또는 HTML 문자열)를 화면 밖에 붙여 캡처 — 실패해도 임시 요소는 반드시 제거
async function _captureOffscreen(elOrHtml,width){
  const wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;left:-9999px;top:0;';
  let el=elOrHtml;
  if(typeof elOrHtml==='string'){wrap.innerHTML=elOrHtml;el=wrap.firstElementChild;}
  else wrap.appendChild(elOrHtml);
  document.body.appendChild(wrap);
  try{
    return await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#fff',width,windowWidth:width,scrollX:0,scrollY:0});
  }finally{wrap.remove();}
}
// 리포트 PDF 페이지 추가 — 첨부 없음: 세로 A4 1쪽(리포트가 꽉 차게) / 첨부 있음: 가로 A4에 2장씩 나란히
async function _addReportPages(outDoc,reportCanvas,attachCanvases){
  const A4S=595.28,A4L=841.89;
  const embed=cv=>outDoc.embedJpg(dataUrlToBytes(cv.toDataURL('image/jpeg',0.92)));
  const fit=(page,img,x,y,w,h)=>{const s=Math.min(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;
    page.drawImage(img,{x:x+(w-dw)/2,y:y+(h-dh)/2,width:dw,height:dh});};
  const att=attachCanvases||[];
  if(!att.length){
    const m=18,page=outDoc.addPage([A4S,A4L]);
    fit(page,await embed(reportCanvas),m,m,A4S-m*2,A4L-m*2);
    return;
  }
  const margin=20,gap=12,slotW=(A4L-margin*2-gap)/2,slotH=A4S-margin*2;
  const all=[reportCanvas,...att];
  for(let i=0;i<all.length;i+=2){
    const page=outDoc.addPage([A4L,A4S]);
    for(let s=0;s<2&&all[i+s];s++)fit(page,await embed(all[i+s]),margin+s*(slotW+gap),margin,slotW,slotH);
  }
}

// ─── PDF 저장 ───
async function dlPdf(){
  const btn=$$('btnPdf');const origPdfText=btn?btn.textContent:'';
  if(btn){btn.textContent='⏳ 생성 중...';btn.disabled=true;}
  try{
    const reportCanvas=await _captureReportCard();
    const outDoc=await PDFLib.PDFDocument.create();
    await _addReportPages(outDoc,reportCanvas,_getStudentPdfCanvases(G.selStudent));
    _downloadBlob(new Blob([await outDoc.save()],{type:'application/pdf'}),`${G.selStudent||'학생'}_${G.selDate||'report'}_리포트.pdf`);
  }catch(e){alert('PDF 오류: '+e.message);console.error(e);}
  if(btn){btn.textContent=origPdfText;btn.disabled=false;}
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

function dataUrlToBytes(u){
  const b=atob(u.split(',')[1]);const a=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;
}

// ─── 학생별 리포트 연속 캡처 (일괄 PDF·카톡 이미지 공용) ───
// 학생을 차례로 전환하며 리포트카드를 캡처 — 끝나면(오류가 나도) 원래 학생·미리보기를 복원
async function _eachStudentCapture(names,label,scale,onCapture){
  saveTabData();
  const btn=document.querySelector('#tbMenu .tb-btn');const origText=btn?btn.textContent:'';
  if(btn){btn.textContent='⏳ 생성 중...';btn.disabled=true;}
  const preview=$$('previewArea');const origStudent=G.selStudent;
  preview.style.opacity='0'; // 미리보기 깜빡임 방지
  try{
    for(let i=0;i<names.length;i++){
      setBar('wait',`⏳ ${label} 생성 중 (${i+1}/${names.length})`);
      G.selStudent=names[i];
      autoFillAll();
      await new Promise(r=>setTimeout(r,150)); // DOM 렌더 대기
      await onCapture(names[i],await _captureReportCard(scale));
    }
  }finally{
    G.selStudent=origStudent;
    try{autoFillAll();}catch(e){console.error(e);}
    preview.style.opacity='';
    if(btn){btn.textContent=origText;btn.disabled=false;}
  }
}

// ─── 일괄 PDF (날짜 선택 모달은 ui.js openBatchPdfModal) ───
async function _doBatchPdf(){
  const date=G.selDate;
  const eligible=G.students.filter(n=>isReportEligible(n,date));
  if(!date||!eligible.length){alert('해당 날짜에 리포트를 만들 학생이 없습니다. (전원 결석)');return;}
  if(!confirmMissingInputs(date))return;
  try{
    const outDoc=await PDFLib.PDFDocument.create();
    await _eachStudentCapture(eligible,'PDF',2,(name,cv)=>_addReportPages(outDoc,cv,_getStudentPdfCanvases(name)));
    setBar('wait','⏳ PDF 파일 만드는 중...');
    _downloadBlob(new Blob([await outDoc.save()],{type:'application/pdf'}),`일괄리포트_${date}.pdf`);
    setBar('ok',`✅ 일괄 PDF ${eligible.length}명 생성 완료`);
  }catch(e){setBar('err','❌ 일괄 PDF 실패: '+e.message);alert('일괄 PDF 오류: '+e.message);console.error(e);}
}

// ─── 카톡 전송용 리포트 이미지 (폭 1080px JPG) ───
const KAKAO_W=1080;
function _mmdd(date){return String(date||'').slice(5).replace('-','');}
// 현재 학생 리포트카드 → JPG 저장 (첨부 시험자료가 있으면 함께 저장)
async function dlReportImage(){
  if(!G.selStudent){alert('학생을 선택해주세요.');return;}
  const base=`${_safeName(G.selStudent)}_${_mmdd(G.selDate)}`;
  try{
    setBar('wait','⏳ 이미지 생성 중...');
    const cv=await _captureReportCard(KAKAO_W/794);
    _downloadBlob(await _canvasToJpgBlob(cv,KAKAO_W),`${base}.jpg`);
    const att=_getStudentPdfCanvases(G.selStudent);
    for(let i=0;i<att.length;i++){
      await new Promise(r=>setTimeout(r,400)); // 연속 다운로드 간격
      _downloadBlob(await _canvasToJpgBlob(att[i],KAKAO_W),`${base}_시험자료${att.length>1?'_'+(i+1):''}.jpg`);
    }
    setBar('ok','✅ 리포트 이미지 저장 완료');
  }catch(e){setBar('err','❌ 이미지 저장 실패: '+e.message);alert('이미지 저장 오류: '+e.message);console.error(e);}
}
// 선택 날짜의 리포트 대상(결석 제외) 전원 → 학생별 JPG를 ZIP 하나로 저장
async function dlKakaoZip(){
  if(typeof JSZip==='undefined'){alert('압축(ZIP) 기능을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.');return;}
  const date=G.selDate;
  if(!date||!G.students.length){alert('날짜와 학생 데이터가 필요합니다.');return;}
  const eligible=G.students.filter(n=>isReportEligible(n,date));
  if(!eligible.length){alert('해당 날짜에 리포트를 만들 학생이 없습니다. (전원 결석)');return;}
  if(!confirmMissingInputs(date))return;
  try{
    const zip=new JSZip(),mmdd=_mmdd(date);
    await _eachStudentCapture(eligible,'이미지',KAKAO_W/794,async(name,cv)=>{
      const base=`${_safeName(name)}_${mmdd}`;
      zip.file(`${base}.jpg`,await _canvasToJpgBlob(cv,KAKAO_W));
      const att=_getStudentPdfCanvases(name);
      for(let i=0;i<att.length;i++)zip.file(`${base}_시험자료${att.length>1?'_'+(i+1):''}.jpg`,await _canvasToJpgBlob(att[i],KAKAO_W));
    });
    setBar('wait','⏳ 압축 파일 만드는 중...');
    _downloadBlob(await zip.generateAsync({type:'blob'}),`리포트이미지_${date}.zip`);
    setBar('ok',`✅ 리포트 이미지 ${eligible.length}명 저장 완료`);
  }catch(e){setBar('err','❌ 이미지 생성 실패: '+e.message);alert('이미지 생성 오류: '+e.message);console.error(e);}
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
      const rate=G.rates[name]?.[d];
      if(isAbsent(name,d)){
        // 실제로 결석을 선택한 경우 — 이행률보다 우선하여 '결석' 표시 (평균 집계 제외)
        html+=`<td style="padding:6px 6px;text-align:center;border-bottom:1px solid #f0f0f0;color:#dc2626;font-size:11px;">결석</td>`;
      }else if(rate!=null&&rate>=0){
        rateSum+=rate;rateCount++;
        html+=`<td style="padding:6px 6px;text-align:center;border-bottom:1px solid #f0f0f0;">
          <div style="display:inline-block;padding:2px 8px;border-radius:6px;font-weight:700;color:${rateFg(rate)};background:${rateBg(rate)};font-size:12px;">${rate}%</div>
        </td>`;
      }else{
        html+=`<td style="padding:6px 6px;text-align:center;border-bottom:1px solid #f0f0f0;color:#d1d5db;font-size:11px;">-</td>`;
      }
    });
    const avg=rateCount>0?Math.round(rateSum/rateCount):null;
    if(avg!=null){
      html+=`<td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f0f0f0;font-weight:800;color:${rateFg(avg)};">${avg}%</td>`;
    }else{
      html+=`<td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f0f0f0;color:#d1d5db;">-</td>`;
    }
    html+=`</tr>`;
  });
  html+=`</tbody></table>`;
  container.innerHTML=html;
}

async function _downloadGradeImage(dates){
  try{
    const W=Math.max(600,120+dates.length*80);
    const container=document.createElement('div');
    container.style.cssText=`width:${W}px;background:#fff;padding:24px;box-sizing:border-box;font-family:Pretendard,sans-serif;`;
    container.innerHTML=`<div style="text-align:center;margin-bottom:16px;">
      <div style="font-size:18px;font-weight:800;color:#111;">숙제 이행률 요약표</div>
      <div style="font-size:12px;color:#888;margin-top:4px;">${shortD(dates[0])} ~ ${shortD(dates[dates.length-1])}</div>
    </div><div id="_gradeTableCapture"></div>
    <div style="text-align:center;font-size:10px;color:#bbb;padding-top:12px;">Generated by 학습리포트</div>`;
    _renderGradeTable(dates,container.querySelector('#_gradeTableCapture'));
    const canvas=await _captureOffscreen(container,W);
    _downloadBlob(await _canvasToBlob(canvas,'image/png'),`이행률요약_전체_${dates[0]}_${dates[dates.length-1]}.png`);
  }catch(e){alert('요약표 이미지 오류: '+e.message);console.error(e);}
}

// ─── 기능: 수업 일지표 (이행률 + 학생별 코멘트, A4 세로 멀티페이지 PDF) ───
// 집계 기간: 선택 날짜 포함 직전 최대 6회차
function _journalReportDates(date){
  return G.lessons.filter(l=>l.날짜<=date).map(l=>l.날짜).slice(-6);
}

// 입력 모달 (날짜 + 다음 수업 계획 + 학생별 코멘트, 날짜별 저장)
function dlJournalReport(){
  if(!G.lessons.length||!G.students.length){alert('수업·학생 데이터가 필요합니다.');return;}
  let overlay=$$('jrModalOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='jrModalOverlay';overlay.className='lm-overlay';
    overlay.innerHTML=`<div class="lm-modal" style="max-width:540px;">
      <div class="lm-header"><h3>📓 수업 일지표</h3><button class="lm-close" id="jrClose">✕</button></div>
      <div style="padding:18px 22px;max-height:74vh;overflow:auto;">
        <div style="font-size:13px;font-weight:700;color:#4e5968;margin-bottom:8px;">날짜</div>
        <select id="jrDate" style="width:100%;padding:10px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;"></select>
        <div id="jrRange" style="font-size:12px;color:#8a8f99;margin:8px 2px 16px;"></div>
        <div style="font-size:13px;font-weight:700;color:#4e5968;margin-bottom:8px;">오늘 진도 <span style="font-weight:500;color:#9aa0a8;">(기본값: 수업 정보, 수정 가능)</span></div>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <input id="jrBook" placeholder="교재" style="flex:1;min-width:0;padding:9px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;box-sizing:border-box;">
          <input id="jrChap" placeholder="단원" style="flex:1;min-width:0;padding:9px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;box-sizing:border-box;">
        </div>
        <textarea id="jrDetail" rows="2" placeholder="상세 진도" style="width:100%;padding:9px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;box-sizing:border-box;resize:vertical;margin-bottom:14px;"></textarea>
        <div style="font-size:13px;font-weight:700;color:#4e5968;margin-bottom:8px;">과제 <span style="font-weight:500;color:#9aa0a8;">(한 줄에 하나)</span></div>
        <textarea id="jrHw" rows="3" placeholder="과제를 한 줄에 하나씩 입력" style="width:100%;padding:9px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;box-sizing:border-box;resize:vertical;margin-bottom:14px;"></textarea>
        <div style="font-size:13px;font-weight:700;color:#4e5968;margin-bottom:8px;">다음 수업 계획</div>
        <textarea id="jrPlan" rows="2" placeholder="예) 경우의 수 — 순열·조합 마무리" style="width:100%;padding:10px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:14px;box-sizing:border-box;resize:vertical;"></textarea>
        <div style="font-size:13px;font-weight:700;color:#4e5968;margin:16px 0 8px;">학생별 코멘트 <span style="font-weight:500;color:#9aa0a8;">(출석 학생, 날짜별 저장)</span></div>
        <div id="jrNotes"></div>
        <button class="btn-p" id="jrDl" style="width:100%;margin-top:18px;">📥 PDF 다운로드</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
  }
  const sel=$$('jrDate');
  sel.innerHTML=G.lessons.map(l=>`<option value="${l.날짜}"${l.날짜===G.selDate?' selected':''}>${fmtKo(l.날짜)}</option>`).join('');
  const cur=sel.value||G.selDate||G.lessons[G.lessons.length-1].날짜;
  sel.value=cur;overlay.dataset.curDate=cur;
  _renderJournalInputs(cur);
  sel.onchange=()=>{const old=overlay.dataset.curDate;if(old)_saveJournalInputs(old);overlay.dataset.curDate=sel.value;_renderJournalInputs(sel.value);};
  overlay.style.display='flex';document.body.classList.add('modal-open');
  const close=()=>{_saveJournalInputs(overlay.dataset.curDate);overlay.style.display='none';document.body.classList.remove('modal-open');};
  $$('jrClose').onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close();};
  $$('jrDl').onclick=async()=>{const d=overlay.dataset.curDate;_saveJournalInputs(d);await _renderJournalPdf(d);};
}

// 다음 수업 계획 기본값: 다음 수업의 '단원 — 상세진도' (직접 입력하면 그 값 사용)
function _defaultJournalPlan(date){
  const i=G.lessons.findIndex(l=>l.날짜===date);
  const nx=i>=0?G.lessons[i+1]:null;if(!nx)return'';
  const detail=String(nx.상세진도||'').split('\n').map(s=>s.trim()).filter(Boolean).join(' / ');
  return[nx.단원,detail].filter(Boolean).join(' — ');
}
function _renderJournalInputs(date){
  const overlay=$$('jrModalOverlay');if(!overlay)return;
  const dts=_journalReportDates(date);
  $$('jrRange').textContent=dts.length?`이행률 집계 ${shortD(dts[0])} ~ ${shortD(dts[dts.length-1])} (최근 ${dts.length}회차)`:'';
  // 오늘 진도·과제: 저장된 편집값 우선, 없으면 수업 정보(레슨) 기본값
  const info=G.journalInfo[date]||{};
  const les=G.lessons.find(l=>l.날짜===date);
  const defHws=les?getLessonHwKeys(les).map(k=>les[k]||'').filter(x=>x):[];
  $$('jrBook').value=info.book!=null?info.book:(les?.교재||'');
  $$('jrChap').value=info.chapter!=null?info.chapter:(les?.단원||'');
  $$('jrDetail').value=info.detail!=null?info.detail:(les?.상세진도||'');
  $$('jrHw').value=info.hwText!=null?info.hwText:defHws.join('\n');
  $$('jrPlan').value=G.journalPlan[date]||_defaultJournalPlan(date);
  // 코멘트 대상: 결석 학생 포함 전원 (결석자도 코멘트 작성 가능)
  const eligible=[...G.students];
  overlay._jrStudents=eligible;
  const box=$$('jrNotes');
  if(!eligible.length){box.innerHTML='<div style="font-size:13px;color:#9aa0a8;padding:6px 2px;">코멘트 대상 학생이 없습니다.</div>';return;}
  box.innerHTML=eligible.map((n,i)=>`
    <div style="margin-bottom:12px;">
      <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:5px;">${esc(n)}</div>
      <textarea id="jrNote_${i}" rows="2" placeholder="코멘트 입력" style="width:100%;padding:9px 12px;border:1px solid #e5e8eb;border-radius:10px;font-family:inherit;font-size:13px;box-sizing:border-box;resize:vertical;">${esc(G.journalNote[`${n}||${date}`]||'')}</textarea>
    </div>`).join('');
}

function _saveJournalInputs(date){
  if(!date)return;
  const overlay=$$('jrModalOverlay');if(!overlay)return;
  // 오늘 진도·과제 편집값 저장 (날짜별) — 수업 정보(기본값)와 "다른" 항목만 저장.
  // 기본값까지 저장하면 이후 수업 진도 설정에서 고친 내용이 일지표에 반영되지 않음.
  // 실제로 바뀐 경우에만 저장(미저장 표시) — 열었다 닫기만 하면 그대로
  const snap=()=>JSON.stringify([G.journalInfo[date]||null,G.journalPlan[date]||null,G.students.map(n=>G.journalNote[`${n}||${date}`]||'')]);
  const before=snap();
  const les=G.lessons.find(l=>l.날짜===date);
  const normLines=v=>String(v||'').replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean).join('\n');
  const def={book:(les?.교재||'').trim(),chapter:(les?.단원||'').trim(),detail:normLines(les?.상세진도),
    hwText:les?getLessonHwKeys(les).map(k=>(les[k]||'').trim()).filter(Boolean).join('\n'):''};
  const cur={book:($$('jrBook')?.value||'').trim(),chapter:($$('jrChap')?.value||'').trim(),
    detail:normLines($$('jrDetail')?.value),hwText:normLines($$('jrHw')?.value)};
  const info={};
  Object.keys(cur).forEach(k=>{if(cur[k]!==def[k])info[k]=cur[k];});
  if(Object.keys(info).length)G.journalInfo[date]=info;else delete G.journalInfo[date];
  // 기본값(다음 수업 진도)과 같으면 저장하지 않음 — 수업 진도를 고치면 따라가도록
  const plan=($$('jrPlan')?.value||'').trim();
  if(plan&&plan!==_defaultJournalPlan(date))G.journalPlan[date]=plan;else delete G.journalPlan[date];
  (overlay._jrStudents||[]).forEach((n,i)=>{
    const el=$$(`jrNote_${i}`);if(!el)return;
    const v=el.value.trim(),k=`${n}||${date}`;
    if(v)G.journalNote[k]=v;else delete G.journalNote[k];
  });
  if(snap()!==before){
    saveAppData();
    if(G.selDate===date){renderCommentPanel();updateCommentSection();fitReportCard();} // 선생님 한마디와 같은 데이터
  }
}

// 페이지 HTML 배열 생성 (각 항목 = A4 한 쪽)
function _buildJournalReportPages(date){
  const les=G.lessons.find(l=>l.날짜===date);
  const dates=_journalReportDates(date);
  const first=dates[0]||date,last=dates[dates.length-1]||date;
  // 색·등급 기준은 domain.js(RATE_TIER·rateFg·rateBg)와 동일 — 결석한 회차는 기간 평균에서 제외
  const avgRate=n=>{const rs=dates.filter(d=>!isAbsent(n,d)).map(d=>G.rates[n]?.[d]).filter(v=>v!=null&&!isNaN(v)&&v>=0);return rs.length?Math.round(rs.reduce((a,b)=>a+b,0)/rs.length):null;};
  // 보고 날짜 출결 분류 — 실제 선택한 값만 기준 (출석·지각 / 결석 / 미체크)
  const attended=[],absent=[],unchecked=[];
  G.students.forEach(n=>{const c=attendCategory(n,date);if(c==='present'||c==='late')attended.push(n);else if(c==='absent')absent.push(n);else unchecked.push(n);});
  const lateCnt=attended.filter(n=>attendCategory(n,date)==='late').length;
  const nameList=arr=>arr.length?arr.map(n=>esc(n)+(attendCategory(n,date)==='late'?'<span style="color:#ca8a04;font-weight:700;">(지각)</span>':'')).join('&nbsp; '):'-';
  const secLabel=(t,sub)=>`<div style="display:flex;align-items:center;gap:8px;margin:0 0 14px;"><span style="width:5px;height:18px;background:#16a34a;border-radius:3px;"></span><span style="font-size:17px;font-weight:800;color:#111;">${t}</span>${sub?`<span style="font-size:12px;color:#9aa0a8;font-weight:600;">${sub}</span>`:''}</div>`;

  // 1쪽: 헤더 + 수업정보 + 출결 + 이행률표
  // 오늘 진도·과제: 저장된 편집값 우선, 없으면 레슨 기본값
  const info=G.journalInfo[date]||{};
  const book=info.book!=null?info.book:(les?.교재||'');
  const chapter=info.chapter!=null?info.chapter:(les?.단원||'');
  const detail=info.detail!=null?info.detail:(les?.상세진도||'');
  const hws=info.hwText!=null
    ? info.hwText.split('\n').map(s=>s.trim()).filter(Boolean)
    : (les?getLessonHwKeys(les).map(k=>les[k]||'').filter(x=>x):[]);
  const headerHtml=`
    <div style="margin-bottom:8px;font-size:12px;font-weight:800;letter-spacing:3px;color:#16a34a;">LEARNING REPORT</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="font-size:32px;font-weight:800;color:#111;">수업 일지 &amp; 숙제 이행률</div>
      <div style="text-align:right;">
        <div style="font-size:16px;font-weight:800;color:#111;">${fmtKo(date)}</div>
        <div style="font-size:12px;color:#8a8f99;margin-top:2px;">이행률 집계 ${shortD(first)} ~ ${shortD(last)}</div>
      </div>
    </div>
    <div style="height:5px;background:linear-gradient(90deg,#16a34a 0 22%,#e6e9ec 22% 100%);border-radius:3px;margin:14px 0 26px;"></div>`;
  const infoHtml=`${secLabel('수업 정보')}
    <div style="display:flex;gap:16px;margin-bottom:26px;">
      <div style="flex:1;border:1px solid #e7e9ec;border-radius:14px;padding:18px 20px;">
        <div style="font-size:12px;color:#9aa0a8;font-weight:700;margin-bottom:10px;">오늘 진도</div>
        ${[['교재',book],['단원',chapter],['상세',detail]].map(([k,v],i)=>`
          <div style="display:flex;gap:14px;padding:7px 0;${i<2?'border-bottom:1px dashed #eef0f2;':''}">
            <span style="font-size:13px;color:#aab0b8;min-width:34px;">${k}</span>
            <span style="font-size:15px;font-weight:700;color:#222;white-space:pre-line;">${esc(v||'-')}</span>
          </div>`).join('')}
      </div>
      <div style="flex:1;border:1px solid #e7e9ec;border-radius:14px;padding:18px 20px;background:#fafbfc;">
        <div style="font-size:12px;color:#9aa0a8;font-weight:700;margin-bottom:10px;">다음 수업까지 과제</div>
        ${hws.length?hws.map((h,i)=>`
          <div style="display:flex;gap:12px;align-items:center;padding:7px 0;${i<hws.length-1?'border-bottom:1px dashed #eef0f2;':''}">
            <span style="width:22px;height:22px;border-radius:7px;background:#dcfce7;color:#16a34a;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</span>
            <span style="font-size:15px;font-weight:700;color:#222;">${esc(h)}</span>
          </div>`).join(''):'<div style="font-size:14px;color:#c0c4cb;padding:7px 0;">등록된 과제 없음</div>'}
      </div>
    </div>`;
  const attHtml=`${secLabel('출결 현황','총 '+G.students.length+'명')}
    <div style="display:flex;gap:16px;margin-bottom:${unchecked.length?10:26}px;">
      <div style="flex:1;background:#f3fbf5;border:1px solid #cdeed6;border-radius:14px;padding:16px 20px;display:flex;gap:16px;align-items:flex-start;">
        <div style="font-size:30px;font-weight:800;color:#16a34a;line-height:1;">${attended.length}</div>
        <div><div style="font-size:13px;font-weight:800;color:#16a34a;margin-bottom:4px;">출석${lateCnt?` <span style="font-weight:700;color:#ca8a04;">(지각 ${lateCnt}명 포함)</span>`:''}</div><div style="font-size:13px;color:#445;line-height:1.6;">${nameList(attended)}</div></div>
      </div>
      <div style="flex:1;background:#fef4f4;border:1px solid #f6d4d4;border-radius:14px;padding:16px 20px;display:flex;gap:16px;align-items:flex-start;">
        <div style="font-size:30px;font-weight:800;color:#dc2626;line-height:1;">${absent.length}</div>
        <div><div style="font-size:13px;font-weight:800;color:#dc2626;margin-bottom:4px;">결석</div><div style="font-size:13px;color:#445;line-height:1.6;">${nameList(absent)}</div></div>
      </div>
    </div>${unchecked.length?`
    <div style="font-size:12px;color:#9aa0a8;margin:0 2px 26px;">출결 미체크: ${unchecked.map(esc).join(', ')}</div>`:''}`;
  const cellWrap=inner=>`<td style="padding:9px 6px;text-align:center;border-top:1px solid #f0f2f4;">${inner}</td>`;
  const cell=(n,d)=>{
    if(isAbsent(n,d))return cellWrap('<span style="display:inline-block;padding:3px 10px;border-radius:11px;background:#f1f3f5;color:#9aa0a8;font-size:12px;font-weight:700;">결석</span>');
    const r=G.rates[n]?.[d];
    if(r!=null&&!isNaN(r))return cellWrap(`<span style="display:inline-block;padding:3px 10px;border-radius:11px;background:${rateBg(r)};color:${rateFg(r)};font-size:12px;font-weight:800;">${r}%</span>`);
    return cellWrap('<span style="color:#cfd3d9;font-size:12px;">-</span>');
  };
  const rows=G.students.map((n,si)=>{
    const avg=avgRate(n);
    return `<tr style="background:${si%2?'#fafbfc':'#fff'};">
      <td style="padding:11px 14px;font-weight:800;color:#222;font-size:14px;white-space:nowrap;border-top:1px solid #f0f2f4;">${esc(n)}</td>
      ${dates.map(d=>cell(n,d)).join('')}
      <td style="padding:11px 14px;text-align:right;border-top:1px solid #f0f2f4;min-width:96px;">
        ${avg!=null?`<div style="font-size:18px;font-weight:800;color:${rateFg(avg)};line-height:1.1;">${avg}%</div><div style="height:5px;background:#eef0f2;border-radius:3px;margin-top:5px;overflow:hidden;"><div style="width:${avg}%;height:100%;background:${rateFg(avg)};"></div></div>`:'<div style="font-size:16px;color:#cfd3d9;line-height:1.1;">—</div><div style="font-size:10px;color:#c0c4cb;margin-top:3px;">데이터 없음</div>'}
      </td>
    </tr>`;
  }).join('');
  const rateHtml=`${secLabel('숙제 이행률',shortD(first)+' ~ '+shortD(last))}
    <div style="border:1px solid #e7e9ec;border-radius:14px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f7f8fa;">
          <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:800;color:#8a909a;">학생</th>
          ${dates.map(d=>`<th style="padding:12px 6px;text-align:center;font-size:12px;font-weight:700;color:#9aa0a8;white-space:nowrap;">${shortD(d)}</th>`).join('')}
          <th style="padding:12px 14px;text-align:right;font-size:12px;font-weight:800;color:#8a909a;">기간 평균</th>
        </tr></thead><tbody>${rows}</tbody>
      </table>
    </div>
    <div style="display:flex;gap:18px;margin-top:14px;font-size:12px;color:#7a808a;">
      ${[['high',`${RATE_TIER.high}% 이상`],['mid',`${RATE_TIER.mid}-${RATE_TIER.high-1}%`],['low',`${RATE_TIER.mid}% 미만`]].map(([k,t])=>`<span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${RATE_STYLE[k].fg};margin-right:5px;"></span>${RATE_STYLE[k].label} · ${t}</span>`).join('')}
      <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#cdd2d8;margin-right:5px;"></span>결석</span>
    </div>`;
  // 반 전체 미니테스트 오답 집계 (결석 제외, 한 학생의 같은 번호는 1번만) — 많이 틀린 순 상위 8개
  const wrongCnt=new Map();
  G.students.forEach(n=>{if(isAbsent(n,date))return;new Set(parseWrongList(G.wrong?.[n]?.[date])).forEach(q=>wrongCnt.set(q,(wrongCnt.get(q)||0)+1));});
  const topWrong=[...wrongCnt].sort((a,b)=>b[1]-a[1]||(parseFloat(a[0])-parseFloat(b[0]))||a[0].localeCompare(b[0])).slice(0,8);
  const mt=G.miniTest?.[date]||{};
  const mtSub=[String(mt.range||'').trim(),Number(mt.total)>0?Math.round(Number(mt.total))+'문항':''].filter(Boolean).map(esc).join(' · ');
  const wrongHtml=topWrong.length?`<div style="margin-top:22px;">${secLabel('미니테스트 오답 집계',mtSub)}
    <div style="display:flex;flex-wrap:wrap;gap:6px;">${topWrong.map(([q,c])=>`<span style="padding:5px 10px;border-radius:9px;background:#fef4f4;border:1px solid #f6d4d4;font-size:13px;font-weight:800;color:#991b1b;">${esc(q)}번 <span style="font-weight:700;color:#7a808a;">${c}명</span></span>`).join('')}${wrongCnt.size>8?`<span style="padding:6px 4px;font-size:13px;color:#9aa0a8;">외 ${wrongCnt.size-8}문항</span>`:''}</div>
  </div>`:'';

  // 코멘트 카드
  const catMap={present:['출석','#16a34a','#dcfce7'],late:['지각','#ca8a04','#fef9c3'],absent:['결석','#dc2626','#fee2e2'],none:['미체크','#9aa0a8','#f1f3f5']};
  const badge=n=>{const[t,c,b]=catMap[attendCategory(n,date)]||catMap.none;return `<span style="padding:3px 12px;border-radius:9px;background:${b};color:${c};font-size:12px;font-weight:800;">${t}</span>`;};
  // 그날 숙제 검사 결과 (이번 회차 과제 / 이월 과제, 상태 있는 것만) — 결석이면 생략
  const stChip={2:['✓','#166534','#dcfce7'],1:['△','#92400e','#fef3c7'],0:['✗','#991b1b','#fee2e2']};
  const hwCheck=n=>{
    if(isAbsent(n,date))return null;
    const items=(G.hwRec[`${n}||${date}`]?.items||[]).filter(it=>it.text&&stChip[it.status]);
    const cur=items.filter(it=>!isCarryForDate(it.fromDate,date));
    const seen=new Set();
    const carry=items.filter(it=>{if(!isCarryForDate(it.fromDate,date))return false;const k=it.ref||it.text;if(seen.has(k))return false;seen.add(k);return true;});
    return(cur.length||carry.length)?{cur,carry}:null;
  };
  const chip=(it,carry)=>{let[ic,c,b]=stChip[it.status];const optSkip=it.status===0&&isOptionalHw(it.text);if(optSkip){ic='–';c='#6b7280';b='#f1f3f5';}return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:8px;background:${b};color:${c};font-size:12px;font-weight:700;">${carry?'<span style="font-size:10px;font-weight:800;color:#b45309;">이월</span>':''}${ic} ${esc(it.text)}${optSkip?' 안 함':''}</span>`;};
  // 미니테스트: "3/5 (60%) · 다시 볼 문제 3·4번" (문항 수가 없으면 오답 번호만)
  const miniText=r=>[
    r.total!=null?`<b style="color:#111;">${r.correct}/${r.total}</b> (${r.perfect?'만점':r.pct+'%'})`:(r.correct!=null?`<b style="color:#111;">${r.correct}개 맞힘</b>`:''),
    r.wrong.length?`다시 볼 문제 <b style="color:#991b1b;">${r.wrong.map(t=>esc(/^\d+$/.test(t)?t+'번':t)).join(' · ')}</b>`:''
  ].filter(Boolean).join(' · ');
  const rowLabel=t=>`<span style="font-size:12px;font-weight:800;color:#8a909a;margin-right:4px;">${t}</span>`;
  const commentCard=n=>{
    const avg=avgRate(n),note=G.journalNote[`${n}||${date}`]||'';
    const hc=hwCheck(n),mr=miniResult(n,date);
    const hasBody=!!(hc||mr||note); // 본문이 없으면(결석 등) 제목 아래 구분선 생략
    return `<div style="border:1px solid #e7e9ec;border-radius:14px;padding:18px 22px;margin-bottom:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;${hasBody?'border-bottom:1px solid #f0f2f4;padding-bottom:12px;margin-bottom:12px;':''}">
        <div style="display:flex;align-items:center;gap:9px;"><span style="width:5px;height:18px;background:#16a34a;border-radius:3px;"></span><span style="font-size:17px;font-weight:800;color:#111;">${esc(n)}</span></div>
        <div style="display:flex;align-items:center;gap:8px;">${badge(n)}<span style="padding:3px 12px;border-radius:9px;background:${avg!=null?rateBg(avg):'#f1f3f5'};color:${avg!=null?rateFg(avg):'#9aa0a8'};font-size:12px;font-weight:800;">기간평균 ${avg!=null?avg+'%':'—'}</span></div>
      </div>
      ${hc?`<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:10px;">${rowLabel('숙제 검사')}${hc.cur.map(it=>chip(it,false)).join('')}${hc.carry.map(it=>chip(it,true)).join('')}</div>`:''}
      ${mr?`<div style="font-size:13px;color:#445;margin-bottom:10px;">${rowLabel('미니테스트')} ${miniText(mr)}</div>`:''}
      ${note?`<div style="font-size:14px;color:#333;line-height:1.7;white-space:pre-line;min-height:22px;">${esc(note)}</div>`:''}
    </div>`;
  };
  // 카드 예상 높이(px) — 쪽 나눔용 (카드 본문 폭 약 640px, 한글 1em·영숫자 0.58em으로 줄 수 추정)
  const textW=(s,fs)=>[...String(s)].reduce((w,ch)=>w+(ch.charCodeAt(0)>0x2e80?fs:fs*0.58),0);
  const estCard=n=>{
    const note=G.journalNote[`${n}||${date}`]||'';
    const noteLines=note?note.split('\n').reduce((s,l)=>s+Math.max(1,Math.ceil(textW(l,14)/640)),0):1;
    const hc=hwCheck(n);
    const hwRows=hc?Math.ceil((64+hc.cur.reduce((w,it)=>w+46+textW(it.text,12),0)+hc.carry.reduce((w,it)=>w+72+textW(it.text,12),0))/640):0;
    return 94+noteLines*24+(hc?10+hwRows*26:0)+(miniResult(n,date)?30:0);
  };
  const planText=G.journalPlan[date]||_defaultJournalPlan(date);
  const planHtml=`<div style="background:#f3fbf5;border:1px solid #cdeed6;border-radius:14px;padding:18px 22px;margin-top:6px;">
    <div style="display:flex;align-items:center;gap:9px;margin-bottom:10px;"><span style="width:5px;height:18px;background:#16a34a;border-radius:3px;"></span><span style="font-size:16px;font-weight:800;color:#111;">다음 수업 계획</span></div>
    <div style="font-size:15px;font-weight:700;color:#1a7d3a;line-height:1.6;white-space:pre-line;">${planText?'→  '+esc(planText):'<span style="color:#9bbfa6;font-weight:500;">미입력</span>'}</div>
  </div>`;

  // 페이지 조립
  const inners=[headerHtml+infoHtml+attHtml+rateHtml+wrongHtml];
  // 코멘트 대상: 결석 학생 포함 전원 — 카드 예상 높이로 쪽 나눔
  const commentTargets=[...G.students];
  const BUDGET=990,PLAN_H=110; // 한 쪽에 들어가는 카드 높이 합(px), 다음 수업 계획 상자 높이
  const chunks=[[]];let used=0;
  commentTargets.forEach(n=>{const h=estCard(n);if(chunks[chunks.length-1].length&&used+h>BUDGET){chunks.push([]);used=0;}chunks[chunks.length-1].push(n);used+=h;});
  const planAlone=chunks[chunks.length-1].length>0&&used+PLAN_H>BUDGET; // 마지막 쪽에 계획이 안 들어가면 다음 쪽으로
  chunks.forEach((grp,ci)=>{
    let inner=secLabel('학생별 코멘트',commentTargets.length+'명');
    inner+=grp.length?grp.map(commentCard).join(''):'<div style="font-size:13px;color:#9aa0a8;padding:6px 2px 18px;">코멘트 대상 학생이 없습니다.</div>';
    if(ci===chunks.length-1&&!planAlone)inner+=planHtml;
    inners.push(inner);
  });
  if(planAlone)inners.push(planHtml);
  const total=inners.length;
  const gen=todayKST().replace(/-/g,'.');
  return inners.map((inner,i)=>`<div style="width:794px;min-height:1052px;background:#fff;padding:48px 52px 64px;box-sizing:border-box;position:relative;font-family:Pretendard,'Apple SD Gothic Neo',sans-serif;color:#111;">
    ${inner}
    <div style="position:absolute;left:52px;right:52px;bottom:26px;display:flex;justify-content:space-between;font-size:11px;color:#b0b4bb;border-top:1px solid #eef0f2;padding-top:10px;">
      <span>학습 리포트 · 생성일 ${gen}</span><span>페이지 ${i+1} / ${total}</span>
    </div>
  </div>`);
}

async function _renderJournalPdf(date){
  const btn=$$('jrDl');const orig=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='⏳ 생성 중...';}
  try{
    const pages=_buildJournalReportPages(date);
    const outDoc=await PDFLib.PDFDocument.create();
    const PW=595.28,PH=841.89,margin=24;
    for(const html of pages){
      const cv=await _captureOffscreen(html,794);
      const png=await outDoc.embedPng(dataUrlToBytes(cv.toDataURL('image/png')));
      const page=outDoc.addPage([PW,PH]);
      const maxW=PW-margin*2,maxH=PH-margin*2;
      const sc=Math.min(maxW/png.width,maxH/png.height);
      const dw=png.width*sc,dh=png.height*sc;
      page.drawImage(png,{x:(PW-dw)/2,y:PH-margin-dh,width:dw,height:dh});
    }
    _downloadBlob(new Blob([await outDoc.save()],{type:'application/pdf'}),`수업일지표_${date}.pdf`);
  }catch(e){alert('수업 일지표 생성 오류: '+e.message);console.error(e);}
  if(btn){btn.disabled=false;btn.textContent=orig;}
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
    const dates=G.lessons.filter(l=>l.날짜>=s&&l.날짜<=e).map(l=>l.날짜);
    $$('stuRptWingContent').innerHTML=_incompleteHtml(_collectIncomplete(student,dates,_stuRptRemoved),false);
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
    const dates=G.lessons.filter(l=>l.날짜>=s&&l.날짜<=e).map(l=>l.날짜);
    if(!dates.length)return;
    // 저장 옵션 메뉴 — 학생 이름은 HTML 문자열에 넣지 않고 클로저로 전달
    const snap=new Set(_stuRptRemoved); // 현재 제외한 항목 스냅샷
    const menu=document.createElement('div');
    menu.className='pdf-attach-menu';menu.id='pdfAttachMenu';
    menu.style.cssText='position:fixed;z-index:9999;';
    menu.innerHTML=`
      <button data-act="pdf"><span style="font-size:16px;">📥</span> PDF로 다운로드</button>
      <div class="pam-sep"></div>
      <button data-act="attach"><span style="font-size:16px;">📌</span> 리포트에 첨부하기</button>`;
    menu.querySelector('[data-act="pdf"]').addEventListener('click',()=>{_closePdfMenu();_downloadStudentReportPdf(student,dates,snap);});
    menu.querySelector('[data-act="attach"]').addEventListener('click',()=>{_closePdfMenu();_attachStudentReportToView(student,dates,{removedSet:snap});});
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
  const dates=G.lessons.filter(l=>l.날짜>=startDate&&l.날짜<=endDate).map(l=>l.날짜);
  if(!dates.length){container.innerHTML='<div style="padding:20px;text-align:center;color:#9ca3af;">날짜 범위를 확인하세요</div>';return;}

  const stLabel={2:'완료',1:'부분완료',0:'미완료'};
  const stColor={2:'#166534',1:'#92400e',0:'#991b1b'};
  const stBg={2:'#dcfce7',1:'#fef3c7',0:'#fee2e2'};

  // 통계 계산 — 상태가 지정된 과제만 집계('없음'·이월·(선택) 과제 제외 — 이행률 규칙과 동일), 결석한 회차는 평균에서 제외
  let rateSum=0,rateCount=0,totalHw=0,doneHw=0,partialHw=0,missHw=0;
  dates.forEach(d=>{
    const rate=G.rates[student]?.[d];
    if(rate!=null&&!isNaN(rate)&&rate>=0&&!isAbsent(student,d)){rateSum+=rate;rateCount++;}
    (G.hwRec[`${student}||${d}`]?.items||[]).forEach((it,origIdx)=>{
      if(isCarryForDate(it.fromDate,d)||isNone(it.status)||isOptionalHw(it.text))return;
      if(removedSet&&removedSet.has(`${student}||${d}||${origIdx}`))return;
      totalHw++;
      if(it.status===2)doneHw++;else if(it.status===1)partialHw++;else if(it.status===0)missHw++;
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
        <div style="font-size:${fs.num};font-weight:800;color:${avgRate!=null?rateFg(avgRate):'#d1d5db'};">${avgRate!=null?avgRate+'%':'-'}</div>
      </div>
      <div style="flex:1;min-width:80px;background:#fff;border-radius:6px;padding:6px 8px;border:1px solid #e5e7eb;text-align:center;">
        <div style="font-size:${fs.label};color:#888;margin-bottom:2px;">기록 회차</div>
        <div style="font-size:${fs.num};font-weight:800;color:#111;">${rateCount}<span style="font-size:${fs.sub};color:#999;">/${dates.length}회</span></div>
      </div>
      <div style="flex:1;min-width:80px;background:#fff;border-radius:6px;padding:6px 8px;border:1px solid #e5e7eb;text-align:center;">
        <div style="font-size:${fs.label};color:#888;margin-bottom:2px;">완료한 과제</div>
        <div style="font-size:${fs.num};font-weight:800;color:${totalHw?rateFg(Math.round(doneHw/totalHw*100)):'#d1d5db'};">${doneHw}<span style="font-size:${fs.sub};color:#999;">/${totalHw}개</span></div>
      </div>
    </div>
    ${totalHw?`<div style="display:flex;gap:10px;margin-top:6px;font-size:${fs.sub};">
      <span style="color:#166534;">완료 ${doneHw}</span>
      <span style="color:#92400e;">부분완료 ${partialHw}</span>
      <span style="color:#991b1b;">미완료 ${missHw}</span>
    </div>`:''}
  </div>`;

  // 날짜별 상세
  const stIcons={2:'✓',1:'△',0:'✗'};
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
      const absent=isAbsent(student,d); // 실제 선택한 출결만 기준
      const bg=di%2===0?'#fff':'#f9fafb';
      const visible=items.filter(it=>!isNone(it.status));
      const hwParts=visible.map(it=>{
        const st=it.status;
        if(st===0&&isOptionalHw(it.text))return`<span style="color:#9ca3af;white-space:nowrap;">–${esc(it.text)} 안 함</span>`;
        return`<span style="color:${stColor[st]};white-space:nowrap;">${stIcons[st]}${esc(it.text)}</span>`;
      }).join('&nbsp; ');
      html+=`<tr style="background:${bg};border-bottom:1px solid #eee;">
        <td style="padding:3px 6px;white-space:nowrap;font-weight:600;color:#333;">${shortD(d)}</td>
        <td style="padding:3px 6px;text-align:center;">${absent?`<span style="color:#dc2626;font-size:8px;">결석</span>`:hasRate?`<span style="padding:1px 5px;border-radius:4px;font-weight:700;font-size:9px;color:${rateFg(rate)};background:${rateBg(rate)};">${rate}%</span>`:`<span style="color:#d1d5db;font-size:8px;">-</span>`}</td>
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
      const absent=isAbsent(student,d); // 실제 선택한 출결만 기준

      html+=`<div style="border:1px solid #d1d5db;border-radius:8px;margin-bottom:10px;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:${absent?'#fef2f2':'#f0f1f3'};border-bottom:1px solid #d1d5db;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:13px;font-weight:800;color:#222;">${fmtKo(d)}</span>
            ${lesson?`<span style="font-size:11px;color:#888;">${esc(lesson.교재||'')} ${esc(lesson.단원||'')}</span>`:''}
          </div>
          ${absent?`<span style="font-size:11px;font-weight:700;color:#dc2626;">결석</span>`
            :hasRate?`<span style="padding:1px 6px;border-radius:5px;font-size:12px;font-weight:700;color:${rateFg(rate)};background:${rateBg(rate)};">${rate}%</span>`
            :`<span style="font-size:11px;font-weight:700;color:#9ca3af;">-</span>`}
        </div>`;

      if(!absent){
        const visible=items.filter(it=>!isNone(it.status));
        if(visible.length){
          html+=`<div style="padding:8px 12px;display:flex;flex-direction:column;gap:2px;">`;
          visible.forEach(it=>{
            const st=it.status;
            const showDel=interactive&&st!==2;
            html+=`<div style="display:flex;align-items:center;gap:6px;padding:2px 6px;border-radius:4px;background:#fff;">
              <span style="flex:1;font-size:12px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(it.text)}</span>
              <span style="padding:0px 5px;border-radius:3px;font-size:10px;font-weight:700;color:${st===0&&isOptionalHw(it.text)?'#6b7280':stColor[st]};background:${st===0&&isOptionalHw(it.text)?'#f1f3f5':stBg[st]};flex-shrink:0;">${st===0&&isOptionalHw(it.text)?'안 함':stLabel[st]}</span>
              ${showDel?`<button data-rm-date="${d}" data-rm-idx="${it._oi}" style="width:18px;height:18px;border-radius:50%;border:1px solid #fca5a5;background:#fef2f2;color:#ef4444;font-size:13px;font-weight:700;cursor:pointer;padding:0;line-height:16px;flex-shrink:0;" title="이 과제 제외">−</button>`:''}
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
  // 과제 제외(−) 버튼 — 이름을 HTML 문자열에 넣지 않고 클로저로 전달
  if(interactive)container.querySelectorAll('button[data-rm-idx]').forEach(b=>b.addEventListener('click',()=>_stuRptRemoveItem(`${student}||${b.dataset.rmDate}||${b.dataset.rmIdx}`)));
}

// + 버튼에서 이행률 요약표 바로 첨부
async function _attachSummaryForCurrent(){
  const student=G.selStudent;
  if(!student){alert('학생을 선택해주세요.');return;}
  const todayStr=todayKST();
  const dates=G.lessons.filter((l,i)=>i>0&&l.날짜<=todayStr).map(l=>l.날짜);
  if(!dates.length){alert('해당 학생의 수업 데이터가 없습니다.');return;}
  await _attachStudentReportToView(student,dates,{btn:null,closeModal:false});
}

// ─── 미완료 과제 모아보기 (날개 패널·요약표 PDF·첨부 공용) ───
// 이월·'없음'·제외(removedSet) 항목을 뺀 미완료/부분완료 과제 목록
function _collectIncomplete(student,dates,removedSet){
  const inc=[];
  dates.forEach(d=>{
    (G.hwRec[`${student}||${d}`]?.items||[]).forEach((it,i)=>{
      if(isCarryForDate(it.fromDate,d)||isNone(it.status)||isOptionalHw(it.text))return; // (선택) 과제는 미완료로 모으지 않음
      if(removedSet&&removedSet.has(`${student}||${d}||${i}`))return;
      if(it.status===0||it.status===1)inc.push({text:it.text,status:it.status,date:d});
    });
  });
  return inc;
}
// boxed=true: 요약표 PDF·첨부용(테두리 상자, 긴 과제명 줄바꿈) / false: 모달 날개 패널용
function _incompleteHtml(inc,boxed){
  if(!inc.length)return boxed?'':'<div style="text-align:center;color:#22c55e;font-size:13px;font-weight:700;padding:40px 0;">✓ 미완료 과제 없음</div>';
  const stL={0:'미완료',1:'부분완료'},stC={0:'#991b1b',1:'#92400e'},stB={0:'#fee2e2',1:'#fef3c7'};
  let h=boxed?'<div style="margin-top:10px;border:1.5px solid #fca5a5;border-radius:8px;padding:10px 12px;background:#fff;">':'';
  h+=`<div style="font-size:${boxed?12:13}px;font-weight:800;color:#991b1b;margin-bottom:${boxed?6:10}px;">미완료 과제 <span style="padding:1px 7px;border-radius:8px;font-size:${boxed?10:11}px;background:#ef4444;color:#fff;">${inc.length}</span></div>`;
  let ld='';
  inc.forEach(it=>{
    if(it.date!==ld){h+=`<div style="font-size:9px;font-weight:700;color:#9ca3af;margin-top:${ld?(boxed?6:8):0}px;padding:${boxed?1:2}px 0;">${shortD(it.date)}</div>`;ld=it.date;}
    h+=`<div style="display:flex;align-items:center;gap:6px;padding:${boxed?3:4}px 8px;border-radius:5px;background:${stB[it.status]};margin-bottom:${boxed?2:3}px;">
      <span style="font-size:10px;font-weight:700;color:${stC[it.status]};flex-shrink:0;">${stL[it.status]}</span>
      <span style="font-size:11px;color:#333;${boxed?'':'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'}">${esc(it.text)}</span>
    </div>`;
  });
  return h+(boxed?'</div>':'');
}
// 요약표 캡처용 요소 (제목 + 날짜별 카드 + 미완료 과제, 폭 460px)
function _buildStudentReportEl(student,dates,removedSet,withFooter){
  const el=document.createElement('div');
  el.style.cssText='width:460px;background:#fff;padding:16px 20px;box-sizing:border-box;font-family:Pretendard,sans-serif;';
  el.innerHTML=`<div style="text-align:center;margin-bottom:8px;">
      <div style="font-size:15px;font-weight:800;color:#111;">숙제 이행률 요약표</div>
      <div style="font-size:10px;color:#888;margin-top:2px;">${shortD(dates[0])} ~ ${shortD(dates[dates.length-1])}</div>
    </div><div></div>`;
  const body=el.lastElementChild;
  _renderStudentReport(student,dates[0],dates[dates.length-1],body,{removedSet}); // 미리보기와 같은 카드 모드
  body.insertAdjacentHTML('beforeend',_incompleteHtml(_collectIncomplete(student,dates,removedSet),true));
  if(withFooter)el.insertAdjacentHTML('beforeend','<div style="text-align:center;font-size:8px;color:#ccc;padding-top:6px;">Generated by 학습리포트</div>');
  return el;
}

// 요약표를 현재 학생 PDF로 첨부 (세션 한정)
async function _attachStudentReportToView(student,dates,opts){
  // opts.btn: 진행 표시용 버튼 (없으면 상태바 사용), opts.closeModal: 모달 닫기 여부
  const btn=opts?.btn||$$('stuRptDl');
  const origText=btn?btn.textContent:'';
  if(btn){btn.textContent='⏳ 첨부 중...';btn.disabled=true;}
  else setBar('wait','⏳ 요약표 생성 중...');
  try{
    const canvas=await _captureOffscreen(_buildStudentReportEl(student,dates,opts?.removedSet,false),460);
    // A4 캔버스 생성 (리포트카드와 동일 비율)
    const a4w=794*2.5,a4h=1123*2.5;
    const cv=document.createElement('canvas');cv.width=a4w;cv.height=a4h;
    const ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,a4w,a4h);
    const scale=Math.min((a4w*0.9)/canvas.width,(a4h*0.85)/canvas.height);
    const dw=canvas.width*scale,dh=canvas.height*scale;
    ctx.drawImage(canvas,(a4w-dw)/2,(a4h-dh)/2*0.4,dw,dh);
    // 기존 첨부 교체
    G.studentPdfs[student]=[{name:'이행률요약표.png',canvases:[cv],pageCount:1}];
    renderSpread();renderTabs();
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
  const origText=btn?btn.textContent:'';if(btn){btn.textContent='⏳ 생성 중...';btn.disabled=true;}
  try{
    const canvas=await _captureOffscreen(_buildStudentReportEl(student,dates,removedSet,true),460);
    // A4 PDF (세로) — 전체를 한 페이지에 맞추도록 축소
    const pdfDoc=await PDFLib.PDFDocument.create();
    const pW=595.28,pH=841.89,margin=30;
    const scale=Math.min((pW-margin*2)/canvas.width,(pH-margin*2)/canvas.height,1);
    const dw=canvas.width*scale,dh=canvas.height*scale;
    const pngImg=await pdfDoc.embedPng(dataUrlToBytes(canvas.toDataURL('image/png')));
    const page=pdfDoc.addPage([pW,pH]);
    page.drawImage(pngImg,{x:margin,y:pH-margin-dh,width:dw,height:dh});
    _downloadBlob(new Blob([await pdfDoc.save()],{type:'application/pdf'}),`이행률요약_${student}_${dates[0]}_${dates[dates.length-1]}.pdf`);
  }catch(e){alert('PDF 오류: '+e.message);console.error(e);}
  if(btn){btn.textContent=origText;btn.disabled=false;}
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
