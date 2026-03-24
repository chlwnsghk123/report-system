// ─── 엑셀 로드 ───
function triggerLoad(){$$('excelInput').click();}

async function loadExcel(input){
  const file=input.files[0];if(!file)return;
  setBar('wait','⏳ 파싱 중...');
  try{
    const buf=await file.arrayBuffer();
    parseWB(XLSX.read(buf,{type:'array',cellDates:false,raw:false}));
    G.excelFileName=file.name;G.tabData={};
    await saveAppDataNow();showGroups();markSaved();
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

// 엑셀 상태 → 내부 숫자 (2=완료,1=부분완료,0=미완료,-1=없음)
function stFromExcel(v){
  if(v===2||v==='○'||v==='2'||v==='완료')return 2;
  if(v===1||v==='△'||v==='1'||v==='부분완료')return 1;
  if(v===0||v==='X'||v==='x'||v==='✗'||v==='×'||v==='✕'||v==='0'||v==='미완료')return 0;
  return -1;
}

// 내부 숫자 → 엑셀 문자열
function stToExcel(v){
  if(v===2||v==='2'||v==='완료')return'2';
  if(v===1||v==='1'||v==='부분완료')return'1';
  if(v===0||v==='0'||v==='미완료')return'0';
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
      const hasId=hdr[0]==='ID';
      const s=hasId?1:0; // ID열 오프셋
      const hasTeacher=hdr.includes('강사명');
      const off=s+(hasTeacher?2:1); // 교재 열 시작 오프셋
      rows.slice(1).forEach(r=>{
        const d=toDS(r[s]);if(!d)return;
        const id=hasId?String(r[0]||'').trim():genLessonId();
        const lesson={id,날짜:d,전체문제수:5,
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

  G.students=[];G.scores={};G.corrects={};G.wrong={};G.hwRec={};G.rates={};G.memos={};G.attend={};G.mascotChoices={};

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
      // 과제 열 범위 (이행률 다음, 과제1~N → 추가과제1~M → 비고)
      const hwStartCol=4;
      let hwEndCol=hdr.length,extraStartCol=-1,extraEndCol=-1;
      for(let ci=hwStartCol;ci<hdr.length;ci++){
        if(hdr[ci].startsWith('추가과제')){if(extraStartCol<0)extraStartCol=ci;extraEndCol=ci+1;continue;}
        if(hdr[ci]==='비고'){if(hwEndCol===hdr.length)hwEndCol=ci;break;}
        if(!hdr[ci].startsWith('과제')&&extraStartCol<0){hwEndCol=ci;continue;}
      }
      if(extraStartCol>=0&&hwEndCol>extraStartCol)hwEndCol=extraStartCol;
      rows.slice(1).forEach(r=>{
        const name=String(r[0]||'').trim();if(!name)return;
        if(!G.students.includes(name))G.students.push(name);
        // B열: 출결 (-1=특수, 0/공란=결석, 1=지각, 2=출석)
        const attendVal=String(r[1]||'').trim();
        if(attendVal!==''){
          const av=parseInt(attendVal);
          if(!isNaN(av)){G.attend[name]=G.attend[name]||{};G.attend[name][date]=av;}
        }
        if(r[2]!==''&&r[2]!=null){G.wrong[name]=G.wrong[name]||{};G.wrong[name][date]=String(r[2]).trim();}
        const rate=normalizeRate(r[3]);
        if(rate!=null){G.rates[name]=G.rates[name]||{};G.rates[name][date]=rate;}
        const key=`${name}||${date}`;
        const rec={이행률:rate};
        for(let ci=hwStartCol;ci<hwEndCol;ci++){
          rec[`과제${ci-hwStartCol+1}_상태`]=stFromExcel(String(r[ci]||'').trim());
        }
        // 추가과제 열 파싱 → extraHw (이번 주차 추가 과제)
        if(extraStartCol>=0){
          rec.extraHw=rec.extraHw||[];
          for(let ci=extraStartCol;ci<extraEndCol;ci++){
            const val=String(r[ci]||'').trim();if(!val)continue;
            const pipePos=val.lastIndexOf('|');
            const text=pipePos>0?val.slice(0,pipePos).trim():val;
            rec.extraHw.push({text});
          }
        }
        G.hwRec[key]=rec;
        // 비고 열에서 사용자 메모 추출 (자동요약 | 메모 형식)
        const bigoIdx=hdr.indexOf('비고');
        if(bigoIdx>=0){
          const bigoVal=String(r[bigoIdx]||'').trim();
          if(bigoVal){
            const pipePos=bigoVal.indexOf(' | ');
            if(pipePos>=0){const userPart=bigoVal.slice(pipePos+3).trim();if(userPart)G.memos[key]=userPart;}
            else if(!bigoVal.startsWith('(전'))G.memos[key]=bigoVal; // 자동요약 아닌 순수 메모
          }
        }
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
          과제1_상태:stFromExcel(String(r[3]||'').trim()),과제2_상태:stFromExcel(String(r[5]||'').trim()),
          과제3_상태:stFromExcel(String(r[7]||'').trim()),과제4_상태:stFromExcel(String(r[9]||'').trim())};
        if(!isNaN(rate)&&rate!==null){G.rates[name]=G.rates[name]||{};G.rates[name][d]=rate;}
      });
    });
  }

  // ─── 이월과제 시트 파싱 ───
  const wsCarry=wb.Sheets['이월과제'];
  if(wsCarry){
    const cRows=XLSX.utils.sheet_to_json(wsCarry,{header:1,defval:'',raw:false});
    // 헤더로 신/구 형식 판별: 신형식=[학생,확인날짜,참조,상태], 구형식=[학생,확인날짜,과제내용,참조/원본날짜,상태]
    const cHdr=(cRows[0]||[]).map(h=>String(h||'').trim());
    const isNewFmt=!cHdr.includes('과제내용');
    cRows.slice(1).forEach(r=>{
      const col0=String(r[0]||'').trim();
      if(!col0||col0.startsWith('▼'))return;
      const name=col0;
      const checkDate=toDS(r[1]);
      let text='',ref='',fromDate='',status;
      if(isNewFmt){
        // 신형식: [학생, 확인날짜, 참조, 상태]
        ref=String(r[2]||'').trim();
        status=stFromExcel(String(r[3]||'').trim());
        if(!name||!checkDate||!ref)return;
      }else{
        // 구형식: [학생, 확인날짜, 과제내용, 참조/원본날짜, 상태]
        text=String(r[2]||'').trim();
        const refOrDate=String(r[3]||'').trim();
        status=stFromExcel(String(r[4]||'').trim());
        if(!name||!checkDate||!text)return;
        const isDate=/^\d{4}-\d{2}-\d{2}$/.test(refOrDate);
        ref=isDate?'':refOrDate;
        fromDate=isDate?refOrDate:'';
      }
      const key=`${name}||${checkDate}`;
      const rec=G.hwRec[key]=G.hwRec[key]||{이행률:null};
      rec.items=rec.items||[];
      rec.items.push({text,status,type:'carry',ref,fromDate});
    });
  }

  // ─── ref → 과제 텍스트 해석 헬퍼 ───
  function _resolveRefText(ref,studentName){
    if(!ref)return'';
    const dashIdx=ref.lastIndexOf('-');
    if(dashIdx<0)return'';
    const lessonId=ref.slice(0,dashIdx);
    const hwKey=ref.slice(dashIdx+1);
    const srcLesson=G.lessons.find(l=>l.id===lessonId);
    if(!srcLesson)return'';
    if(hwKey.startsWith('추가과제')){
      const ei=parseInt(hwKey.replace('추가과제',''))-1;
      const srcRec=G.hwRec[`${studentName}||${srcLesson.날짜}`];
      return srcRec?.extraHw?.[ei]?.text||'';
    }
    return srcLesson[hwKey]||'';
  }

  // ─── hwRec items 배열 재구성 (base + carry 병합) ───
  G.lessons.forEach((les,idx)=>{
    if(idx===0)return;
    const date=les.날짜;
    const prevLesson=G.lessons[idx-1];
    const prevHwKeys=getLessonHwKeys(prevLesson);
    G.students.forEach(name=>{
      const key=`${name}||${date}`;
      // rec이 없으면 생성 (items 항상 보장)
      let rec=G.hwRec[key];
      if(!rec){rec={이행률:null};G.hwRec[key]=rec;}
      const baseItems=prevHwKeys.map((k,i)=>{
        const text=prevLesson[k]||'';
        const status=stFromExcel(rec[`과제${i+1}_상태`]??'');
        const ref=`${prevLesson.id}-${k}`;
        return{text,status,type:'base',ref,fromDate:prevLesson.날짜};
      }).filter(it=>it.text);
      // 이전 날짜의 학생별 추가과제도 base로 포함
      const prevDateKey=`${name}||${prevLesson.날짜}`;
      const prevRec=G.hwRec[prevDateKey];
      if(prevRec?.extraHw){
        const extraBaseStart=baseItems.length;
        prevRec.extraHw.forEach((ex,ei)=>{
          const status=stFromExcel(rec[`과제${extraBaseStart+ei+1}_상태`]??'');
          const ref=`${prevLesson.id}-추가과제${ei+1}`;
          baseItems.push({text:ex.text,status,type:'base',ref,fromDate:prevLesson.날짜});
        });
      }
      const carryItems=(rec.items||[]).filter(it=>it.type==='carry');
      // carry 텍스트가 없으면 ref에서 해석
      carryItems.forEach(it=>{
        if(!it.text&&it.ref){
          it.text=_resolveRefText(it.ref,name);
          // ref에서 fromDate도 채움
          if(!it.fromDate&&it.ref){
            const di=it.ref.lastIndexOf('-');
            if(di>0){const lid=it.ref.slice(0,di);const sl=G.lessons.find(l=>l.id===lid);if(sl)it.fromDate=sl.날짜;}
          }
        }
      });
      rec.items=[...baseItems,...carryItems];
    });
  });

  // ─── 설정 시트 파싱 ───
  const wsCfg=wb.Sheets['설정'];
  if(wsCfg){
    const cfgRows=XLSX.utils.sheet_to_json(wsCfg,{header:1,defval:'',raw:false});
    let section='';
    cfgRows.forEach(r=>{
      const col0=String(r[0]||'').trim();
      if(col0.startsWith('▼')){section=col0;return;}
      if(section==='▼ 스티커'){
        const name=col0;
        const tier=String(r[1]||'').trim();
        const idx=parseInt(r[2]);
        if(name&&tier&&!isNaN(idx)){G.mascotChoices[name]=G.mascotChoices[name]||{};G.mascotChoices[name][tier]=idx;}
      }
      if(section==='▼ 마지막저장'&&col0==='lastSaved'){
        G.lastSaved=String(r[1]||'').trim();
      }
    });
  }
  updateLastSavedDisplay();
}

function updateLastSavedDisplay(){
  const el=$$('rLastSaved');if(!el)return;
  el.textContent=G.lastSaved?`마지막 저장: ${G.lastSaved}`:'';
}

// ─── 엑셀 저장 ───
async function saveToExcel(){
  const btn=$$('btnSave');btn.disabled=true;btn.textContent='저장 중...';
  try{
  saveTabData();
  // 학생 데이터 → hwRec 동기화
  G.students.forEach(n=>{
    const td=G.tabData[n];if(!td||!G.selDate)return;
    if(td.wrongInput){G.wrong[n]=G.wrong[n]||{};G.wrong[n][G.selDate]=td.wrongInput;}
    else if(G.wrong[n]?.[G.selDate]!=null){delete G.wrong[n][G.selDate];}
    const key=`${n}||${G.selDate}`;
    const ex=G.hwRec[key]||{이행률:null};
    if(td.rateManual!=null){ex.이행률=td.rateManual;G.rates[n]=G.rates[n]||{};G.rates[n][G.selDate]=td.rateManual;}
    else if(G.rates[n]?.[G.selDate]!=null){ex.이행률=G.rates[n][G.selDate];}
    else{ex.이행률=null;}
    // items 배열 동기화
    const hs=td.hwStatus||[];
    const items=td.hwItems||[];
    const types=td.hwItemTypes||items.map(()=>({type:'base'}));
    if(items.length){
      ex.items=items.map((text,i)=>({
        text,status:hs[i]??-1,
        type:types[i]?.type||'base',
        fromDate:types[i]?.fromDate||''
      }));
    }
    // 레거시 필드
    const baseCount=types.filter(t=>!t.type||t.type==='base').length;
    for(let i=0;i<baseCount;i++)ex[`과제${i+1}_상태`]=hs[i]??ex[`과제${i+1}_상태`]??-1;
    // 이번 주차 추가 과제 동기화
    if(td.extraHw)ex.extraHw=td.extraHw.map(it=>({...it}));
    G.hwRec[key]=ex;
  });
  await saveAppDataNow();
  const wb=XLSX.utils.book_new();

  // ─── 수업정보 시트 (ID열 + 동적 과제 열) ───
  const maxHw=Math.max(4,...G.lessons.map(l=>getLessonHwKeys(l).length));
  const hwHeaders=Array.from({length:maxHw},(_,i)=>`과제${i+1}`);
  const ws1=XLSX.utils.aoa_to_sheet([
    ['ID','날짜','교재','단원','상세진도',...hwHeaders],
    ...G.lessons.map(l=>{
      if(!l.id)l.id=genLessonId();
      const vals=Array.from({length:maxHw},(_,i)=>l[`과제${i+1}`]||'');
      return[l.id,l.날짜,l.교재,l.단원,l.상세진도,...vals];
    })
  ]);
  // ID열·날짜열 문자열 강제
  G.lessons.forEach((_,i)=>{
    [0,1].forEach(c=>{const cell=ws1[XLSX.utils.encode_cell({r:i+1,c})];if(cell)cell.t='s';});
  });
  XLSX.utils.book_append_sheet(wb,ws1,'수업정보');

  // ─── 날짜별 시트 (동적 과제 열 + 비고) ───
  G.lessons.forEach((les,lesIdx)=>{
    const date=les.날짜,total=les.전체문제수||5;
    const prevLesson=lesIdx>0?G.lessons[lesIdx-1]:null;
    const baseHwCount=prevLesson?getLessonHwKeys(prevLesson).length:4;
    const hwCount=Math.max(4,baseHwCount);
    const hwHdrs=Array.from({length:hwCount},(_,i)=>`과제${i+1}`);
    // 추가과제 최대 개수 파악 (extraHw: 이번 주차 추가 과제)
    const maxExtra=Math.max(0,...G.students.map(n=>{
      const rec=G.hwRec[`${n}||${date}`];
      return(rec?.extraHw||[]).length;
    }));
    const extraHdrs=Array.from({length:maxExtra},(_,i)=>`추가과제${i+1}`);
    const aoa=[
      ['이름','출결','오답','과제이행률',...hwHdrs,...extraHdrs,'비고'],
      ...G.students.map(n=>{
        const key=`${n}||${date}`,rec=G.hwRec[key];
        let rate=rec?.이행률!=null?rec.이행률:G.rates[n]?.[date]??null;
        // 출결 값 (이행률 있는데 결석이면 → 출석으로 보정)
        let att=G.attend[n]?.[date];
        if(rate!=null&&!isNaN(rate)&&rate!==-1&&(att===0||att==null)){
          att=2;G.attend[n]=G.attend[n]||{};G.attend[n][date]=2;
        }
        const attVal=att!=null?att:'';
        const hwVals=Array.from({length:hwCount},(_,i)=>
          stToExcel(rec?.[`과제${i+1}_상태`]??-1));
        // 추가과제: 이번 주차 추가 과제 텍스트
        const extras=rec?.extraHw||[];
        const extraVals=Array.from({length:maxExtra},(_,i)=>{
          const ex=extras[i];if(!ex)return'';
          return ex.text;
        });
        // 비고: 상태가 변한 이월과제만 자동 요약 + 중복 제거
        const stDesc={2:'완료',1:'일부 완료',0:'미완료'};
        const carries=(rec?.items||[]).filter(it=>it.type==='carry'&&!isNone(it.status));
        const changed=carries.filter(it=>{
          const ps=_getPrevCarryStatus(n,date,it);
          return ps==null||it.status!==ps;
        });
        const seen=new Map();
        changed.forEach(it=>{const k=`${it.text}||${it.fromDate}`;seen.set(k,it);});
        const autoText=[...seen.values()].map(it=>{
          const fd=it.fromDate?`${shortD(it.fromDate)} 출제`:'이전';
          return`[이월] ${it.text} (${fd}) → ${stDesc[it.status]||'확인 전'}`;
        }).join(', ');
        const userMemo=G.memos[`${n}||${date}`]||'';
        const bigo=[autoText,userMemo].filter(x=>x).join(' | ');
        return[n,attVal,G.wrong[n]?.[date]||'',rate!=null?rate:'',...hwVals,...extraVals,bigo];
      })
    ];
    const wsD=XLSX.utils.aoa_to_sheet(aoa,{skipHeader:false});
    const range=XLSX.utils.decode_range(wsD['!ref']||'A1');
    for(let R=range.s.r;R<=range.e.r;R++){
      for(let C=range.s.c;C<=range.e.c;C++){
        const addr=XLSX.utils.encode_cell({r:R,c:C});
        const cell=wsD[addr];if(!cell)continue;
        if(C>=4&&C<4+hwCount+maxExtra){cell.t='s';cell.v=String(cell.v===undefined?'':cell.v);continue;}
        if(cell.v===0&&cell.t==='n'&&C!==3){cell.v='';cell.t='s';}
      }
    }
    XLSX.utils.book_append_sheet(wb,wsD,date);
  });

  // ─── 이월과제 시트 (▼ 날짜별 블록, ref 기반 — 과제내용 없음) ───
  const carryAoa=[['학생','확인날짜','참조','상태']];
  let lastCarryDate='';
  G.lessons.forEach(les=>{
    const date=les.날짜;
    G.students.forEach(n=>{
      const key=`${n}||${date}`;
      const rec=G.hwRec[key];
      if(!rec?.items)return;
      const carryItems=rec.items.filter(it=>it.type==='carry');
      if(!carryItems.length)return;
      if(date!==lastCarryDate){
        carryAoa.push([`▼ ${fmtKo(date)}`,'','','']);
        lastCarryDate=date;
      }
      carryItems.forEach(it=>{
        carryAoa.push([n,date,it.ref||'',stToExcel(it.status)]);
      });
    });
  });
  if(carryAoa.length>1){
    const wsC=XLSX.utils.aoa_to_sheet(carryAoa);
    const cRange=XLSX.utils.decode_range(wsC['!ref']||'A1');
    for(let R=1;R<=cRange.e.r;R++){
      [2,3].forEach(C=>{
        const addr=XLSX.utils.encode_cell({r:R,c:C});
        const cell=wsC[addr];
        if(cell){cell.t='s';cell.v=String(cell.v===undefined?'':cell.v);}
      });
    }
    XLSX.utils.book_append_sheet(wb,wsC,'이월과제');
  }

  // ─── 설정 시트 (스티커 등 잡다한 설정) ───
  const cfgAoa=[['키','값1','값2']];
  const mascotEntries=Object.entries(G.mascotChoices);
  if(mascotEntries.length){
    cfgAoa.push(['▼ 스티커','','']);
    mascotEntries.forEach(([name,tiers])=>{
      Object.entries(tiers).forEach(([tier,idx])=>{
        cfgAoa.push([name,tier,String(idx)]);
      });
    });
  }
  // 마지막 저장 시각
  G.lastSaved=nowKSTStr();
  cfgAoa.push(['▼ 마지막저장','','']);
  cfgAoa.push(['lastSaved',G.lastSaved,'']);

  const wsCfg=XLSX.utils.aoa_to_sheet(cfgAoa);
  XLSX.utils.book_append_sheet(wb,wsCfg,'설정');

  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:'application/octet-stream'}));
  a.download=G.excelFileName;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  updateLastSavedDisplay();
  markSaved();
  btn.disabled=false;btn.textContent='💾 저장';
  setBar('ok',`✅ ${G.excelFileName} 저장 완료`);
  }catch(e){
    console.error('저장 오류:',e);
    btn.disabled=false;btn.textContent='💾 저장';
    setBar('err','❌ 저장 실패: '+e.message);
  }
}

// ─── 템플릿 생성 ───
function createTemplate(){
  if(!confirm('6월까지 주 1회 수업 날짜가 포함된 새 엑셀 템플릿을 생성합니다.\n계속하시겠습니까?'))return;
  const students=G.students.length?G.students:['학생1','학생2','학생3'];
  const dates=[];
  const now=nowKST();
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
      ['이름','출결','오답','과제이행률','과제1','과제2','과제3','과제4','비고'],
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
