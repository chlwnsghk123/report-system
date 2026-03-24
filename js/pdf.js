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
    const stLabel={'완료':'✓ 완료','부분완료':'◑ 부분완료','미완료':'✗ 미완료'};
    const stColor={'완료':'#166534','부분완료':'#92400e','미완료':'#991b1b'};
    const stBg={'완료':'#dcfce7','부분완료':'#fef3c7','미완료':'#fee2e2'};

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
        const visible=items.filter(it=>it.status&&stLabel[it.status]);
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
      <div class="lm-header"><h3>📊 성적 요약표</h3><button class="lm-close" id="gradeClose">✕</button></div>
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

  // 날짜 옵션
  const opts=G.lessons.map(l=>`<option value="${l.날짜}">${shortD(l.날짜)}</option>`).join('');
  $$('gradeStart').innerHTML=opts;
  $$('gradeEnd').innerHTML=opts;
  $$('gradeEnd').value=G.lessons[G.lessons.length-1].날짜;

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
      const rate=G.rates[name]?.[d];
      const correct=G.corrects[name]?.[d];
      const les=G.lessons.find(l=>l.날짜===d);
      const total=les?.전체문제수||5;
      if(rate!=null&&rate>=0){
        rateSum+=rate;rateCount++;
        const scoreStr=correct!=null?`${correct}/${total}`:'';
        html+=`<td style="padding:6px 6px;text-align:center;border-bottom:1px solid #f0f0f0;">
          <div style="display:inline-block;padding:2px 8px;border-radius:6px;font-weight:700;color:${rateColor(rate)};background:${rateBg(rate)};font-size:12px;">${rate}%</div>
          ${scoreStr?`<div style="font-size:10px;color:#9ca3af;margin-top:2px;">${scoreStr}</div>`:''}
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
    <div style="font-size:18px;font-weight:800;color:#111;">성적 요약표</div>
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
    a.download=`성적요약_${dates[0]}_${dates[dates.length-1]}.png`;
    a.click();URL.revokeObjectURL(a.href);
  },'image/png');
}

// ─── 기능3: 수업 일지 이미지 ───
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
      </div>`:''}`;
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
