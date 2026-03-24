// ─── PDF 첨부 뷰어 ───
async function loadAttachPdf(input){
  const file=input.files[0];if(!file)return;
  setBar('wait','⏳ PDF 렌더링 중...');
  try{
    const buf=await file.arrayBuffer();G.attachedPdfBytes=new Uint8Array(buf);
    const pdfDoc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
    G.pdfPageCount=pdfDoc.numPages;G.pdfCanvases=[];
    for(let i=1;i<=G.pdfPageCount;i++){
      // 1. 원본 렌더
      const page=await pdfDoc.getPage(i);const vp=page.getViewport({scale:2.5});
      const raw=document.createElement('canvas');raw.width=vp.width;raw.height=vp.height;
      await page.render({canvasContext:raw.getContext('2d'),viewport:vp}).promise;
      const W=raw.width,H=raw.height;
      // 2. 상5% 하6% 잘라내기 (머리말/꼬리말 제거)
      const cT=Math.round(H*0.05),cB=Math.round(H*0.06),cropH=H-cT-cB;
      // 3. 원본과 동일한 A4 흰색 캔버스 생성
      const cv=document.createElement('canvas');cv.width=W;cv.height=H;
      const ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);
      // 4. 잘라낸 내용을 정중앙에서 6% 아래로 배치 (위아래 남는 공간은 흰색 유지)
      const destY=Math.round((H-cropH)/2+H*0.04);
      ctx.drawImage(raw,0,cT,W,cropH,0,destY,W,cropH);
      G.pdfCanvases.push(cv);
    }
    G.currentSpread=0;renderSpread();
    $$('attachLabel').textContent=`${file.name} (${G.pdfPageCount}p)`;
    $$('btnAttach').classList.add('has');
    setBar('ok',`✅ ${G.excelFileName}`);
  }catch(e){setBar('err','❌ PDF 로드 실패: '+e.message);console.error(e);}
  input.value='';
}
function renderSpread(){
  const total=1+G.pdfPageCount,spreads=Math.ceil(total/2);
  const nav=$$('pageNav');nav.style.display=G.pdfPageCount>0?'flex':'none';
  $$('pageInfo').textContent=`${G.currentSpread+1} / ${spreads}`;
  $$('btnPrev').disabled=G.currentSpread===0;
  $$('btnNext').disabled=G.currentSpread>=spreads-1;
  const li=G.currentSpread*2,ri=li+1;
  const rc=$$('reportCard'),lc=$$('leftPdfCanvas'),rs=$$('rightSlot'),rpc=$$('rightPdfCanvas');
  if(li===0){rc.style.display='';lc.style.display='none';$$('leftLabel').textContent='리포트';}
  else{rc.style.display='none';const pi=li-1;if(pi<G.pdfCanvases.length){drawPdfPrev(lc,G.pdfCanvases[pi]);lc.style.display='block';$$('leftLabel').textContent=`시험자료 ${pi+1}p`;}}
  const isDual=G.pdfPageCount>0&&ri<total;
  if(isDual){rs.style.display='';const pi=ri-1;if(pi<G.pdfCanvases.length){drawPdfPrev(rpc,G.pdfCanvases[pi]);$$('rightLabel').textContent=`시험자료 ${pi+1}p`;}}
  else rs.style.display='none';
  $$('spreadRow').classList.toggle('dual',isDual);
  setTimeout(updateScale,60);
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
  const btn=$$('btnPdf');btn.textContent='⏳ 생성 중...';btn.disabled=true;
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
  btn.textContent='📄 PDF 저장';btn.disabled=false;
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
    const stLabel={2:'✓ 완료',1:'△ 부분완료',0:'✗ 미완료'};
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
        items=hwKeys.map((k,i)=>({text:prevLesson[k]||'',status:rec?.[`과제${i+1}_상태`]||'',type:'base',fromDate:''})).filter(it=>it.text);
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
      canvases.push({name,canvas:cv});
    }

    // PDF 생성 (세로 A4, 학생당 1페이지)
    const{PDFDocument}=PDFLib;
    const outDoc=await PDFDocument.create();
    const PW=595.28,PH=841.89,margin=20;
    const slotW=PW-margin*2,slotH=PH-margin*2;

    for(const{canvas}of canvases){
      const page=outDoc.addPage([PW,PH]);
      const pngBytes=dataUrlToBytes(canvas.toDataURL('image/png'));
      const pngImg=await outDoc.embedPng(pngBytes);
      const{width:iw,height:ih}=pngImg;
      const scale=Math.min(slotW/iw,slotH/ih);
      const dw=iw*scale,dh=ih*scale;
      page.drawImage(pngImg,{x:margin+(slotW-dw)/2,y:PH-margin-(slotH-dh)/2-dh,width:dw,height:dh});
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

// ─── 학생별 리포트 요약 ───
function dlStudentReport(){
  if(!G.lessons.length||!G.students.length){alert('수업 및 학생 데이터가 필요합니다.');return;}
  if(G.selStudent)saveTabData();

  let overlay=$$('stuRptOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='stuRptOverlay';
    overlay.className='lm-overlay';
    overlay.innerHTML=`<div class="lm-modal" style="max-width:520px;max-height:85vh;display:flex;flex-direction:column;">
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
      <div id="stuRptPreview" style="flex:1;overflow-y:auto;padding:16px 24px;min-height:0;"></div>
      <div style="padding:12px 24px 16px;display:flex;gap:10px;flex-shrink:0;">
        <button class="btn-s" id="stuRptCancel" style="flex:1;">닫기</button>
        <button class="btn-p" id="stuRptDl" style="flex:1;">📥 PDF 다운로드</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
  }

  // 학생 옵션
  $$('stuRptStudent').innerHTML=G.students.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  if(G.selStudent)$$('stuRptStudent').value=G.selStudent;
  // 날짜 옵션 (첫 수업일 제외, 오늘까지만)
  const stuToday=todayKST();
  const stuDates=G.lessons.filter((l,i)=>i>0&&l.날짜<=stuToday);
  const dateOpts=stuDates.map(l=>`<option value="${l.날짜}">${shortD(l.날짜)}</option>`).join('');
  $$('stuRptStart').innerHTML=dateOpts;
  $$('stuRptEnd').innerHTML=dateOpts;
  if(stuDates.length)$$('stuRptEnd').value=stuDates[stuDates.length-1].날짜;

  const render=()=>_renderStudentReport($$('stuRptStudent').value,$$('stuRptStart').value,$$('stuRptEnd').value,$$('stuRptPreview'));
  $$('stuRptStudent').onchange=render;
  $$('stuRptStart').onchange=render;
  $$('stuRptEnd').onchange=render;
  render();

  overlay.style.display='flex';
  document.body.classList.add('modal-open');
  const close=()=>{overlay.style.display='none';document.body.classList.remove('modal-open');};
  $$('stuRptClose').onclick=close;
  $$('stuRptCancel').onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close();};
  $$('stuRptDl').onclick=async()=>{
    const student=$$('stuRptStudent').value;
    const s=$$('stuRptStart').value,e=$$('stuRptEnd').value;
    const dates=G.lessons.filter(l=>l.날짜>=s&&l.날짜<=e).map(l=>l.날짜)
      .filter(d=>G.attend[student]?.[d]!==-1);
    if(!dates.length)return;
    await _downloadStudentReportPdf(student,dates);
  };
}

function _renderStudentReport(student,startDate,endDate,container){
  const dates=G.lessons.filter(l=>l.날짜>=startDate&&l.날짜<=endDate).map(l=>l.날짜)
    .filter(d=>G.attend[student]?.[d]!==-1); // 출결 -1(특수) 제외
  if(!dates.length){container.innerHTML='<div style="padding:20px;text-align:center;color:#9ca3af;">날짜 범위를 확인하세요</div>';return;}

  const stLabel={2:'완료',1:'부분완료',0:'미완료'};
  const stColor={2:'#166534',1:'#92400e',0:'#991b1b'};
  const stBg={2:'#dcfce7',1:'#fef3c7',0:'#fee2e2'};
  const rateColor=v=>v>=75?'#166534':v>=30?'#92400e':'#991b1b';
  const rateBg=v=>v>=75?'#dcfce7':v>=30?'#fef3c7':'#fee2e2';

  // 통계 계산
  let rateSum=0,rateCount=0,totalHw=0,doneHw=0,partialHw=0,missHw=0;
  // 이월에서 해결된 ref 수집 (status >= 1이면 해결)
  const resolvedRefs=new Set();
  dates.forEach(d=>{
    const key=`${student}||${d}`;
    const rec=G.hwRec[key];
    (rec?.items||[]).forEach(it=>{
      if(it.type==='carry'&&it.ref&&it.status>=1)resolvedRefs.add(it.ref);
    });
  });
  // 완료한 과제 수: 한 번에 완료(2) + 한 번에 부분완료(1) + 이월 통해 부분완료 이상
  let completedHw=0;
  dates.forEach(d=>{
    const rate=G.rates[student]?.[d];
    if(rate!=null&&!isNaN(rate)){rateSum+=rate;rateCount++;}
    const key=`${student}||${d}`;
    const rec=G.hwRec[key];
    const items=rec?.items||[];
    let baseIdx=0;
    items.forEach(it=>{
      if(it.type==='carry')return;
      const idx=baseIdx++;
      if(isNone(it.status))return;
      totalHw++;
      if(it.status===2){doneHw++;completedHw++;}
      else if(it.status===1){partialHw++;completedHw++;}
      else if(it.status===0){
        const ref=`${d}-${idx}`;
        if(resolvedRefs.has(ref))completedHw++; // 이월로 해결
        else missHw++;
      }
    });
  });
  const avgRate=rateCount>0?Math.round(rateSum/rateCount):null;

  // 요약 카드
  let html=`<div style="background:#f8f9fa;border-radius:12px;padding:16px;margin-bottom:14px;">
    <div style="font-size:15px;font-weight:800;color:#111;margin-bottom:10px;">${esc(student)} 종합 요약</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <div style="flex:1;min-width:100px;background:#fff;border-radius:8px;padding:10px 12px;border:1px solid #e5e7eb;text-align:center;">
        <div style="font-size:10px;color:#888;margin-bottom:4px;">평균 이행률</div>
        <div style="font-size:20px;font-weight:800;color:${avgRate!=null?rateColor(avgRate):'#d1d5db'};">${avgRate!=null?avgRate+'%':'-'}</div>
      </div>
      <div style="flex:1;min-width:100px;background:#fff;border-radius:8px;padding:10px 12px;border:1px solid #e5e7eb;text-align:center;">
        <div style="font-size:10px;color:#888;margin-bottom:4px;">수업 횟수</div>
        <div style="font-size:20px;font-weight:800;color:#111;">${rateCount}<span style="font-size:11px;color:#999;">/${dates.length}회</span></div>
      </div>
      <div style="flex:1;min-width:100px;background:#fff;border-radius:8px;padding:10px 12px;border:1px solid #e5e7eb;text-align:center;">
        <div style="font-size:10px;color:#888;margin-bottom:4px;">완료한 과제 수</div>
        <div style="font-size:20px;font-weight:800;color:${totalHw?rateColor(Math.round(completedHw/totalHw*100)):'#d1d5db'};">${completedHw}<span style="font-size:11px;color:#999;">/${totalHw}개</span></div>
      </div>
    </div>
    ${totalHw?`<div style="display:flex;gap:12px;margin-top:8px;font-size:11px;">
      <span style="color:#166534;">✓ 완료 ${doneHw}</span>
      <span style="color:#92400e;">△ 부분완료 ${partialHw}</span>
      <span style="color:#991b1b;">✗ 미완료 ${missHw}</span>
    </div>`:''}
  </div>`;

  // 날짜별 상세
  dates.forEach(d=>{
    const rate=G.rates[student]?.[d];
    const key=`${student}||${d}`;
    const rec=G.hwRec[key];
    const lesson=G.lessons.find(l=>l.날짜===d);
    const items=(rec?.items||[]).filter(it=>it.type!=='carry');
    const hasRate=rate!=null&&!isNaN(rate);
    const isAbsent=!hasRate;

    html+=`<div style="border:1.5px solid #d1d5db;border-radius:10px;margin-bottom:10px;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:${isAbsent?'#fef2f2':'#f0f1f3'};border-bottom:1.5px solid #d1d5db;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:13px;font-weight:800;color:#222;">${fmtKo(d)}</span>
          ${lesson?`<span style="font-size:11px;color:#888;">${esc(lesson.교재||'')} ${esc(lesson.단원||'')}</span>`:''}
        </div>
        ${isAbsent?`<span style="font-size:11px;font-weight:700;color:#dc2626;">결석</span>`
          :`<span style="padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;color:${rateColor(rate)};background:${rateBg(rate)};">${rate}%</span>`}
      </div>`;

    if(!isAbsent){
      const visible=items.filter(it=>!isNone(it.status)&&stLabel[it.status]!=null);
      if(visible.length){
        html+=`<div style="padding:8px 12px;display:flex;flex-direction:column;gap:4px;">`;
        visible.forEach(it=>{
          html+=`<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;background:#fff;">
            <span style="flex:1;font-size:12px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(it.text)}</span>
            <span style="padding:1px 7px;border-radius:4px;font-size:10px;font-weight:700;color:${stColor[it.status]};background:${stBg[it.status]};flex-shrink:0;">${stLabel[it.status]}</span>
          </div>`;
        });
        html+=`</div>`;
      }else{
        html+=`<div style="padding:8px 14px;font-size:11px;color:#9ca3af;">상태 지정된 과제 없음</div>`;
      }
      // 이월과제 비고 (상태가 변한 것만 + 중복 제거)
      const carryStDesc={2:'완료',1:'일부 완료',0:'미완료'};
      const allCarries=(rec?.items||[]).filter(it=>it.type==='carry'&&!isNone(it.status));
      const changedCarries=allCarries.filter(it=>{
        const ps=_getPrevCarryStatus(student,d,it);
        return ps==null||it.status!==ps;
      });
      const cSeen=new Map();
      changedCarries.forEach(it=>{const k=`${it.text}||${it.fromDate}`;cSeen.set(k,it);});
      const uniqueCarries=[...cSeen.values()];
      if(uniqueCarries.length){
        html+=`<div style="padding:6px 12px 8px;border-top:1px dashed #d1d5db;">`;
        uniqueCarries.forEach(it=>{
          const fd=it.fromDate?`${shortD(it.fromDate)} 출제`:'이전 수업';
          const isDone=it.status===2;
          const cColor=isDone?'#166534':it.status===1?'#92400e':'#991b1b';
          const cBg=isDone?'#f0fdf4':it.status===1?'#fffbeb':'#fef2f2';
          html+=`<div style="display:flex;align-items:center;gap:6px;padding:3px 8px;border-radius:5px;background:${cBg};margin-bottom:3px;">
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

  container.innerHTML=html;
}

async function _downloadStudentReportPdf(student,dates){
  const btn=$$('stuRptDl');
  const origText=btn.textContent;btn.textContent='⏳ 생성 중...';btn.disabled=true;
  try{
    const W=500;
    const wrap=document.createElement('div');
    wrap.style.cssText='position:fixed;left:-9999px;top:0;';
    document.body.appendChild(wrap);

    const container=document.createElement('div');
    container.style.cssText=`width:${W}px;background:#fff;padding:28px 32px;box-sizing:border-box;font-family:Pretendard,sans-serif;`;
    container.innerHTML=`<div style="text-align:center;margin-bottom:8px;">
      <div style="font-size:18px;font-weight:800;color:#111;">숙제 이행률 요약표</div>
      <div style="font-size:12px;color:#888;margin-top:4px;">${shortD(dates[0])} ~ ${shortD(dates[dates.length-1])}</div>
    </div><div id="_stuRptCapture"></div>
    <div style="text-align:center;font-size:9px;color:#ccc;padding-top:12px;">Generated by 학습리포트</div>`;
    wrap.appendChild(container);
    _renderStudentReport(student,dates[0],dates[dates.length-1],container.querySelector('#_stuRptCapture'));

    const canvas=await html2canvas(container,{scale:2,useCORS:true,backgroundColor:'#fff',
      width:W,scrollX:0,scrollY:0,windowWidth:W});
    document.body.removeChild(wrap);

    // A4 PDF (세로) — 긴 이미지를 페이지 단위로 분할
    const{PDFDocument}=PDFLib;
    const pdfDoc=await PDFDocument.create();
    const pW=595.28,pH=841.89,margin=30;
    const contentW=pW-margin*2;
    const scale=contentW/canvas.width;
    const contentH=pH-margin*2;
    const pageImgH=contentH/scale; // 캔버스 기준 한 페이지에 들어가는 높이

    const totalPages=Math.ceil(canvas.height/pageImgH);
    for(let p=0;p<totalPages;p++){
      const srcY=p*pageImgH;
      const srcH=Math.min(pageImgH,canvas.height-srcY);
      // 페이지 단위 캔버스 잘라내기
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
