// ─── PDF 첨부 뷰어 ───
async function loadAttachPdf(input){
  const file=input.files[0];if(!file)return;
  setBar('wait','⏳ PDF 렌더링 중...');
  try{
    const buf=await file.arrayBuffer();G.attachedPdfBytes=new Uint8Array(buf);
    const pdfDoc=await pdfjsLib.getDocument({data:buf.slice(0)}).promise;
    G.pdfPageCount=pdfDoc.numPages;G.pdfCanvases=[];
    for(let i=1;i<=G.pdfPageCount;i++){
      const page=await pdfDoc.getPage(i);const vp=page.getViewport({scale:2.5});
      const cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;
      await page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
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
  if(G.pdfPageCount>0&&ri<total){rs.style.display='';const pi=ri-1;if(pi<G.pdfCanvases.length){drawPdfPrev(rpc,G.pdfCanvases[pi]);$$('rightLabel').textContent=`시험자료 ${pi+1}p`;}}
  else rs.style.display='none';
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
function dataUrlToBytes(u){
  const b=atob(u.split(',')[1]);const a=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;
}
