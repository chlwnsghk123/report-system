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

// ─── 전체 과제 요약 PDF ───
async function dlSummaryPdf(){
  if(!G.selDate||!G.students.length){alert('날짜와 학생 데이터가 필요합니다.');return;}
  const btn=document.querySelector('#tbMenu .tb-btn');
  const origText=btn.textContent;btn.textContent='⏳ 생성 중...';btn.disabled=true;
  try{
    saveTabData();
    const date=G.selDate;
    const prevLesson=getPrevL();
    const curLesson=getCurL();
    // 요약 HTML 컨테이너 생성
    const wrap=document.createElement('div');
    wrap.style.cssText='position:fixed;left:-9999px;top:0;';
    document.body.appendChild(wrap);

    const pages=[];
    for(const name of G.students){
      const key=`${name}||${date}`;
      const rec=G.hwRec[key];
      const rate=G.rates[name]?.[date];
      // 과제 항목 가져오기
      let items=rec?.items||[];
      if(!items.length&&prevLesson){
        // items가 없으면 레거시에서 구성
        const hwKeys=getLessonHwKeys(prevLesson);
        items=hwKeys.map((k,i)=>{
          const text=prevLesson[k]||'';
          const status=rec?.[`과제${i+1}_상태`]||'';
          return{text,status,type:'base',fromDate:''};
        }).filter(it=>it.text);
      }

      const cardH=674; // A4 높이의 약 60% (1123 * 0.6)
      const card=document.createElement('div');
      card.style.cssText=`width:794px;height:${cardH}px;background:#fff;padding:50px 50px;box-sizing:border-box;font-family:Pretendard,sans-serif;display:flex;flex-direction:column;`;
      // 상단: 학생명 + 날짜
      const header=`
        <div style="border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;">
          <div style="font-size:28px;font-weight:800;color:#000;">${esc(name)} <span style="font-size:16px;font-weight:400;color:#555;">학생</span></div>
          <div style="font-size:14px;color:#555;font-weight:500;">${fmtKo(date)}</div>
        </div>`;
      // 이행률 (공란이면 숨김)
      const hasRate=rate!=null&&!isNaN(rate);
      const rateColor=hasRate?(rate>=75?'#1b7340':rate>=30?'#b45309':'#dc2626'):'';
      const rateSection=hasRate?`
        <div style="margin-bottom:24px;display:flex;align-items:center;gap:14px;">
          <div style="font-size:15px;font-weight:700;color:#333;">숙제 이행률</div>
          <div style="font-size:40px;font-weight:900;color:${rateColor};line-height:1;">${rate}%</div>
        </div>`:'';
      // 과제 목록
      const stLabel={'완료':'✓ 완료','부분완료':'◑ 부분완료','미완료':'✗ 미완료'};
      const stColor={'완료':'#166534','부분완료':'#92400e','미완료':'#991b1b'};
      const stBg={'완료':'#dcfce7','부분완료':'#fef3c7','미완료':'#fee2e2'};
      let hwHtml='';
      if(items.length){
        hwHtml=items.map((it,i)=>{
          const label=stLabel[it.status]||'— 없음';
          const color=stColor[it.status]||'#6b7280';
          const bg=stBg[it.status]||'#f3f4f6';
          const carryMark=it.type==='carry'?`<span style="font-size:11px;font-weight:700;color:#6b7280;margin-right:4px;">(이월)</span>`:'';
          return`<div style="display:flex;align-items:center;padding:14px 18px;border-radius:10px;background:#f8f9fa;border:1px solid #e5e7eb;gap:12px;">
            <div style="width:28px;height:28px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#374151;flex-shrink:0;">${i+1}</div>
            <div style="flex:1;font-size:15px;color:#222;font-weight:500;">${carryMark}${esc(it.text)}</div>
            <div style="padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700;color:${color};background:${bg};flex-shrink:0;">${label}</div>
          </div>`;
        }).join('');
      }else{
        hwHtml='<div style="padding:20px;color:#9ca3af;font-size:14px;text-align:center;">과제 데이터 없음</div>';
      }
      const hwSection=`
        <div>
          <div style="font-size:16px;font-weight:700;color:#333;margin-bottom:14px;">저번 주차 과제</div>
          <div style="display:flex;flex-direction:column;gap:8px;">${hwHtml}</div>
        </div>`;

      card.innerHTML=header+rateSection+hwSection;
      wrap.appendChild(card);
      pages.push(card);
    }

    // html2canvas로 각 페이지 캡처 후 PDF 생성
    const pageW=794,pageH=674;
    const pdfW=595.28,pdfH=pdfW*(pageH/pageW); // 비율 유지
    const{PDFDocument}=PDFLib;
    const outDoc=await PDFDocument.create();
    for(const page of pages){
      const canvas=await html2canvas(page,{scale:2,useCORS:true,backgroundColor:'#fff',
        width:pageW,height:pageH,scrollX:0,scrollY:0,windowWidth:pageW,windowHeight:pageH});
      const pngBytes=dataUrlToBytes(canvas.toDataURL('image/png'));
      const pngImg=await outDoc.embedPng(pngBytes);
      const pdfPage=outDoc.addPage([pdfW,pdfH]);
      pdfPage.drawImage(pngImg,{x:0,y:0,width:pdfW,height:pdfH});
    }
    document.body.removeChild(wrap);
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([await outDoc.save()],{type:'application/pdf'}));
    a.download=`과제요약_${G.selDate}.pdf`;
    a.click();URL.revokeObjectURL(a.href);
  }catch(e){alert('요약 PDF 오류: '+e.message);console.error(e);}
  btn.textContent=origText;btn.disabled=false;
}

function dataUrlToBytes(u){
  const b=atob(u.split(',')[1]);const a=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;
}
