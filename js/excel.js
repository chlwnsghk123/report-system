// ─── 엑셀 로드 ───
function triggerLoad(){$$('excelInput').click();}

async function loadExcel(input){
  const file=input.files[0];if(!file)return;
  setBar('wait','⏳ 파싱 중...');
  try{
    const buf=await file.arrayBuffer();
    parseWB(XLSX.read(buf,{type:'array',cellDates:false,raw:false}));
    G.excelFileName=file.name;G.tabData={};
    await saveAppData();showGroups();
    setBar('ok',`✅ ${file.name}`);
  }catch(e){setBar('err','❌ 파싱 실패: '+e.message);console.error(e);}
  input.value='';
}

// 날짜값 → YYYY-MM-DD
function toDS(v){
  if(!v&&v!==0)return'';
  const s=String(v).trim();
  if(/^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(s))return s.replace(/\//g,'-').slice(0,10);
  if(/^\d{5}$/.test(s)){const d=XLSX.SSF.parse_date_code(+s);return`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}
  return s;
}

// 이행률 정규화: "%"문자열·소수·정수 → 0~100 정수
function normalizeRate(v){
  if(v==null||v==='')return null;
  const s=String(v).trim();
  if(s==='')return null;
  if(s.endsWith('%'))return parseFloat(s);
  const n=parseFloat(s);
  if(isNaN(n))return null;
  if(n>0&&n<1)return Math.round(n*100);
  return n;
}

// 엑셀 상태 → 내부 한글 (하위호환: 기호+숫자 모두 지원)
function stFromExcel(v){
  if(v==='○'||v==='2')return'완료';
  if(v==='△'||v==='1')return'부분완료';
  if(v==='X'||v==='x'||v==='✗'||v==='×'||v==='✕'||v==='0')return'미완료';
  return v;
}

// 내부 한글 → 엑셀 숫자 문자열
function stToExcel(v){
  if(v==='완료')return'2';
  if(v==='부분완료')return'1';
  if(v==='미완료')return'0';
  return'';
}

// 워크북 파싱 → G 채움
function parseWB(wb){
  G.lessons=[];
  const ws1=wb.Sheets['수업정보'];
  if(ws1){
    const rows=XLSX.utils.sheet_to_json(ws1,{header:1,defval:'',raw:false});
    if(rows.length>0){
      const hdr=rows[0].map(h=>String(h||'').trim());
      const hasTeacher=hdr.includes('강사명');
      const off=hasTeacher?2:1; // 교재 열 시작 오프셋
      rows.slice(1).forEach(r=>{
        const d=toDS(r[0]);if(!d)return;
        const lesson={날짜:d,전체문제수:5,
          교재:String(r[off]||'').trim(),
          단원:String(r[off+1]||'').trim(),
          상세진도:String(r[off+2]||'').trim()};
        // 동적 과제 열 읽기
        const hwStart=off+3;
        for(let ci=hwStart;ci<hdr.length;ci++){
          if(!hdr[ci].startsWith('과제'))break;
          lesson[`과제${ci-hwStart+1}`]=String(r[ci]||'').trim();
        }
        if(!('과제1' in lesson))lesson.과제1='';
        G.lessons.push(lesson);
      });
      G.lessons.sort((a,b)=>a.날짜.localeCompare(b.날짜));
    }
  }

  G.students=[];G.scores={};G.corrects={};G.wrong={};G.hwRec={};G.rates={};

  const hasDateSheets=wb.SheetNames.some(n=>/^\d{4}-\d{2}-\d{2}$/.test(n));

  if(hasDateSheets){
    const firstDate=wb.SheetNames.find(n=>/^\d{4}-\d{2}-\d{2}$/.test(n));
    if(firstDate){
      XLSX.utils.sheet_to_json(wb.Sheets[firstDate],{header:1,defval:'',raw:false}).slice(1).forEach(r=>{
        const name=String(r[0]||'').trim();if(name&&!G.students.includes(name))G.students.push(name);
      });
    }
    wb.SheetNames.forEach(sheetName=>{
      if(!/^\d{4}-\d{2}-\d{2}$/.test(sheetName))return;
      const ws=wb.Sheets[sheetName];if(!ws)return;
      const date=sheetName;
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
      const hdr=rows.length?rows[0].map(h=>String(h||'').trim()):[];
      // 과제 열 범위 (이행률 다음 ~ 비고 전)
      const hwStartCol=4;
      let hwEndCol=hdr.length;
      for(let ci=hwStartCol;ci<hdr.length;ci++){
        if(hdr[ci]==='비고'){hwEndCol=ci;break;}
        if(!hdr[ci].startsWith('과제')){hwEndCol=ci;break;}
      }
      rows.slice(1).forEach(r=>{
        const name=String(r[0]||'').trim();if(!name)return;
        if(!G.students.includes(name))G.students.push(name);
        const scoreStr=String(r[1]||'').trim();
        if(scoreStr){
          const parts=scoreStr.split('/');
          if(parts.length===2){
            const correct=parseInt(parts[0]);
            if(!isNaN(correct)){G.corrects[name]=G.corrects[name]||{};G.corrects[name][date]=correct;}
            const total=parseInt(parts[1]);
            if(!isNaN(total)&&total>0){const les=G.lessons.find(l=>l.날짜===date);if(les)les.전체문제수=total;}
          }
        }
        if(r[2]!==''&&r[2]!=null){G.wrong[name]=G.wrong[name]||{};G.wrong[name][date]=String(r[2]).trim();}
        const rate=normalizeRate(r[3]);
        if(rate!=null){G.rates[name]=G.rates[name]||{};G.rates[name][date]=rate;}
        const key=`${name}||${date}`;
        const rec={이행률:rate};
        for(let ci=hwStartCol;ci<hwEndCol;ci++){
          rec[`과제${ci-hwStartCol+1}_상태`]=String(r[ci]||'').trim();
        }
        G.hwRec[key]=rec;
      });
    });
  }else{
    // 구 형식: 성적 시트 + 학생별 시트 (하위 호환)
    const ws2=wb.Sheets['성적'];
    if(ws2){
      const rows=XLSX.utils.sheet_to_json(ws2,{header:1,defval:'',raw:false});
      if(rows.length){
        const hdr=rows[0].map(h=>String(h||'').trim());
        const ccCols=[],wcCols=[];
        hdr.forEach((h,i)=>{
          if(i===0||h===''||h.startsWith('▼'))return;
          if(h.endsWith('_맞힌'))ccCols.push([i,h.slice(0,-3)]);
          else if(h.endsWith('_오답'))wcCols.push([i,h.slice(0,-3)]);
        });
        rows.slice(1).forEach(r=>{
          const n=String(r[0]||'').trim();if(!n)return;
          if(n==='[전체문제수]'){
            ccCols.forEach(([ci,d])=>{const v=parseInt(r[ci]);if(!isNaN(v)&&v>0){const les=G.lessons.find(l=>l.날짜===d);if(les)les.전체문제수=v;}});
            return;
          }
          if(!G.students.includes(n))G.students.push(n);
          G.corrects[n]=G.corrects[n]||{};G.wrong[n]=G.wrong[n]||{};
          ccCols.forEach(([ci,d])=>{const v=parseInt(r[ci]);if(!isNaN(v)&&r[ci]!=='')G.corrects[n][d]=v;});
          wcCols.forEach(([ci,d])=>{if(r[ci]!==''&&r[ci]!=null)G.wrong[n][d]=String(r[ci]).trim();});
        });
      }
    }
    G.students.forEach(name=>{
      const ws=wb.Sheets[name];if(!ws)return;
      XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false}).slice(1).forEach(r=>{
        const d=toDS(r[0]);if(!d)return;
        const rate=normalizeRate(r[1]);
        const key=`${name}||${d}`;
        G.hwRec[key]={이행률:rate,
          과제1_상태:String(r[3]||'').trim(),과제2_상태:String(r[5]||'').trim(),
          과제3_상태:String(r[7]||'').trim(),과제4_상태:String(r[9]||'').trim()};
        if(!isNaN(rate)&&rate!==null){G.rates[name]=G.rates[name]||{};G.rates[name][d]=rate;}
      });
    });
  }

  // ─── 이월과제 시트 파싱 ───
  const wsCarry=wb.Sheets['이월과제'];
  if(wsCarry){
    const cRows=XLSX.utils.sheet_to_json(wsCarry,{header:1,defval:'',raw:false});
    cRows.slice(1).forEach(r=>{
      const col0=String(r[0]||'').trim();
      if(!col0||col0.startsWith('▼'))return;
      const name=col0;
      const checkDate=toDS(r[1]);
      const text=String(r[2]||'').trim();
      const fromDate=toDS(r[3]);
      const status=stFromExcel(String(r[4]||'').trim());
      if(!name||!checkDate||!text)return;
      const key=`${name}||${checkDate}`;
      const rec=G.hwRec[key]=G.hwRec[key]||{이행률:null};
      rec.items=rec.items||[];
      rec.items.push({text,status,type:'carry',fromDate});
    });
  }

  // ─── hwRec items 배열 재구성 (base + carry 병합) ───
  G.lessons.forEach((les,idx)=>{
    if(idx===0)return;
    const date=les.날짜;
    const prevLesson=G.lessons[idx-1];
    const prevHwKeys=getLessonHwKeys(prevLesson);
    G.students.forEach(name=>{
      const key=`${name}||${date}`;
      const rec=G.hwRec[key];
      if(!rec)return;
      const baseItems=prevHwKeys.map((k,i)=>{
        const text=prevLesson[k]||'';
        const status=stFromExcel(rec[`과제${i+1}_상태`]||'');
        return{text,status,type:'base',fromDate:''};
      }).filter(it=>it.text);
      const carryItems=(rec.items||[]).filter(it=>it.type==='carry');
      rec.items=[...baseItems,...carryItems];
    });
  });
}

// ─── 엑셀 저장 ───
async function saveToExcel(){
  const btn=$$('btnSave');btn.disabled=true;btn.textContent='저장 중...';
  try{
  saveTabData();
  // 학생 데이터 → hwRec 동기화
  G.students.forEach(n=>{
    const td=G.tabData[n];if(!td||!G.selDate)return;
    if(td.scoreCalc!=null){G.scores[n]=G.scores[n]||{};G.scores[n][G.selDate]=td.scoreCalc;}
    if(td.correctInput!==''){G.corrects[n]=G.corrects[n]||{};G.corrects[n][G.selDate]=parseInt(td.correctInput)||0;}
    if(td.wrongInput){G.wrong[n]=G.wrong[n]||{};G.wrong[n][G.selDate]=td.wrongInput;}
    const key=`${n}||${G.selDate}`;
    const ex=G.hwRec[key]||{이행률:null};
    if(td.rateManual!=null){ex.이행률=td.rateManual;G.rates[n]=G.rates[n]||{};G.rates[n][G.selDate]=td.rateManual;}
    // items 배열 동기화
    const hs=td.hwStatus||[];
    const items=td.hwItems||[];
    const types=td.hwItemTypes||items.map(()=>({type:'base'}));
    if(items.length){
      ex.items=items.map((text,i)=>({
        text,status:hs[i]||'',
        type:types[i]?.type||'base',
        fromDate:types[i]?.fromDate||''
      }));
    }
    // 레거시 필드
    const baseCount=types.filter(t=>!t.type||t.type==='base').length;
    for(let i=0;i<baseCount;i++)ex[`과제${i+1}_상태`]=hs[i]||ex[`과제${i+1}_상태`]||'';
    G.hwRec[key]=ex;
  });
  await saveAppData();
  const wb=XLSX.utils.book_new();

  // ─── 수업정보 시트 (동적 과제 열) ───
  const maxHw=Math.max(4,...G.lessons.map(l=>getLessonHwKeys(l).length));
  const hwHeaders=Array.from({length:maxHw},(_,i)=>`과제${i+1}`);
  const ws1=XLSX.utils.aoa_to_sheet([
    ['날짜','교재','단원','상세진도',...hwHeaders],
    ...G.lessons.map(l=>{
      const vals=Array.from({length:maxHw},(_,i)=>l[`과제${i+1}`]||'');
      return[l.날짜,l.교재,l.단원,l.상세진도,...vals];
    })
  ]);
  G.lessons.forEach((_,i)=>{const c=ws1[XLSX.utils.encode_cell({r:i+1,c:0})];if(c)c.t='s';});
  XLSX.utils.book_append_sheet(wb,ws1,'수업정보');

  // ─── 날짜별 시트 (동적 과제 열 + 비고) ───
  G.lessons.forEach((les,lesIdx)=>{
    const date=les.날짜,total=les.전체문제수||5;
    const prevLesson=lesIdx>0?G.lessons[lesIdx-1]:null;
    const baseHwCount=prevLesson?getLessonHwKeys(prevLesson).length:4;
    const hwCount=Math.max(4,baseHwCount);
    const hwHdrs=Array.from({length:hwCount},(_,i)=>`과제${i+1}`);
    const aoa=[
      ['이름','성적','오답','과제이행률',...hwHdrs,'비고'],
      ...G.students.map(n=>{
        const correct=G.corrects[n]?.[date];
        const scoreStr=correct!==undefined?`${correct}/${total}`:'';
        const key=`${n}||${date}`,rec=G.hwRec[key];
        const rate=rec?.이행률;
        const hwVals=Array.from({length:hwCount},(_,i)=>
          stToExcel(rec?.[`과제${i+1}_상태`]||''));
        // 비고: 캐리오버 요약
        const carryItems=(rec?.items||[]).filter(it=>it.type==='carry');
        const stLabel={'완료':'완','부분완료':'부분','미완료':'미'};
        const bigo=carryItems.map(it=>{
          const fd=it.fromDate?shortD(it.fromDate):'';
          const sl=stLabel[it.status]||'';
          return`(전${fd?'·'+fd:''})${it.text}${sl?'→'+sl:''}`;
        }).join(', ');
        return[n,scoreStr,G.wrong[n]?.[date]||'',rate!=null?rate:'',...hwVals,bigo];
      })
    ];
    const wsD=XLSX.utils.aoa_to_sheet(aoa,{skipHeader:false});
    const range=XLSX.utils.decode_range(wsD['!ref']||'A1');
    for(let R=range.s.r;R<=range.e.r;R++){
      for(let C=range.s.c;C<=range.e.c;C++){
        const addr=XLSX.utils.encode_cell({r:R,c:C});
        const cell=wsD[addr];if(!cell)continue;
        if(C>=4&&C<4+hwCount){cell.t='s';cell.v=String(cell.v===undefined?'':cell.v);continue;}
        if(cell.v===0&&cell.t==='n'){cell.v='';cell.t='s';}
      }
    }
    XLSX.utils.book_append_sheet(wb,wsD,date);
  });

  // ─── 이월과제 시트 (▼ 날짜별 블록 구분) ───
  const carryAoa=[['학생','확인날짜','과제내용','원본날짜','상태']];
  let lastCarryDate='';
  G.lessons.forEach(les=>{
    const date=les.날짜;
    let dateHasItems=false;
    G.students.forEach(n=>{
      const key=`${n}||${date}`;
      const rec=G.hwRec[key];
      if(!rec?.items)return;
      const carryItems=rec.items.filter(it=>it.type==='carry');
      if(!carryItems.length)return;
      if(date!==lastCarryDate){
        carryAoa.push([`▼ ${fmtKo(date)}`,'','','','']);
        lastCarryDate=date;
        dateHasItems=true;
      }
      carryItems.forEach(it=>{
        carryAoa.push([n,date,it.text,it.fromDate,stToExcel(it.status)]);
      });
    });
  });
  if(carryAoa.length>1){
    const wsC=XLSX.utils.aoa_to_sheet(carryAoa);
    const cRange=XLSX.utils.decode_range(wsC['!ref']||'A1');
    for(let R=1;R<=cRange.e.r;R++){
      const addr=XLSX.utils.encode_cell({r:R,c:4});
      const cell=wsC[addr];
      if(cell){cell.t='s';cell.v=String(cell.v===undefined?'':cell.v);}
    }
    XLSX.utils.book_append_sheet(wb,wsC,'이월과제');
  }

  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:'application/octet-stream'}));
  a.download=G.excelFileName;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  $$('lastSaved').style.display='';
  $$('lastSaved').textContent=`✅ ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} 저장됨`;
  btn.disabled=false;btn.textContent='💾 파일 저장';
  setBar('ok',`✅ ${G.excelFileName} 저장 완료`);
  }catch(e){
    console.error('저장 오류:',e);
    btn.disabled=false;btn.textContent='💾 파일 저장';
    setBar('err','❌ 저장 실패: '+e.message);
  }
}

// ─── 템플릿 생성 ───
function createTemplate(){
  if(!confirm('6월까지 주 1회 수업 날짜가 포함된 새 엑셀 템플릿을 생성합니다.\n계속하시겠습니까?'))return;
  const students=G.students.length?G.students:['학생1','학생2','학생3'];
  const dates=[];
  const now=new Date();
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const endY=now.getMonth()<6?now.getFullYear():now.getFullYear()+1;
  const end=new Date(endY,5,30);
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+7)){
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    dates.push(`${y}-${m}-${day}`);
  }
  const wb=XLSX.utils.book_new();
  const ws1=XLSX.utils.aoa_to_sheet([
    ['날짜','교재','단원','상세진도','과제1','과제2','과제3','과제4'],
    ...dates.map(d=>[d,'','','','','','',''])
  ]);
  dates.forEach((_,i)=>{const c=ws1[XLSX.utils.encode_cell({r:i+1,c:0})];if(c)c.t='s';});
  XLSX.utils.book_append_sheet(wb,ws1,'수업정보');
  dates.forEach(date=>{
    const wsD=XLSX.utils.aoa_to_sheet([
      ['이름','성적','오답','과제이행률','과제1','과제2','과제3','과제4','비고'],
      ...students.map(n=>[n,'','','','','','','',''])
    ]);
    XLSX.utils.book_append_sheet(wb,wsD,date);
  });
  const fname='학습리포트_템플릿.xlsx';
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:'application/octet-stream'}));
  a.download=fname;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  setBar('ok','✅ 템플릿 생성 완료! 파일을 불러와 사용하세요.');
}
