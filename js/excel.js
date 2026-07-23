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
    $$('sbar').onclick=triggerLoad;
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
          상세진도:String(r[off+2]||'').replace(/\r\n/g,'\n').replace(/\\n/g,'\n').trim()};
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

  G.students=[];G.scores={};G.corrects={};G.wrong={};G.hwRec={};G.rates={};G.memos={};G.attend={};G.mascotChoices={};G.hwDisabled={};G.journalNote={};G.journalPlan={};G.journalInfo={};

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
      // ─── 마이그레이션: 구 형식 추가과제 ref → 신 형식 (텍스트 기반) ───
      // "L001-추가과제2" → "L001@x@심화문제집"
      // 학생의 extraHw에서 텍스트를 찾아서 ref에 박아 넣음
      const legacy=parseHwRef(ref);
      if(legacy?.type==='extra-legacy'){
        const srcLesson=G.lessons.find(l=>l.id===legacy.lessonId);
        if(srcLesson){
          const srcRec=G.hwRec[`${name}||${srcLesson.날짜}`];
          const t=srcRec?.extraHw?.[legacy.ei]?.text;
          if(t)ref=buildExtraRef(legacy.lessonId,t);
        }
      }
      const key=`${name}||${checkDate}`;
      const rec=G.hwRec[key]=G.hwRec[key]||{이행률:null};
      rec.items=rec.items||[];
      rec.items.push({text,status,ref,fromDate});
    });
  }

  // ─── hwRec items 배열 재구성 (base + carry 병합) + 이월 전파 ───
  rebuildAllHwItems();

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
      if(section==='▼ 과제OFF'){
        // 이번 주차 과제 OFF 상태 복원 (col0="학생||날짜", col1=ref)
        const key=col0,ref=String(r[1]||'').trim();
        if(key&&ref){
          if(!(G.hwDisabled[key] instanceof Set))G.hwDisabled[key]=new Set();
          G.hwDisabled[key].add(ref);
        }
      }
      if(section==='▼ 수업일지코멘트'){
        // 수업 일지표 학생별 코멘트 복원 (col0="학생||날짜", col1=코멘트)
        const key=col0,note=String(r[1]||'');
        if(key&&note.trim())G.journalNote[key]=note;
      }
      if(section==='▼ 수업일지계획'){
        // 수업 일지표 다음 수업 계획 복원 (col0=날짜, col1=계획)
        const key=col0,plan=String(r[1]||'');
        if(key&&plan.trim())G.journalPlan[key]=plan;
      }
      if(section==='▼ 수업일지진도'){
        // 수업 일지표 오늘 진도·과제 편집값 복원 (col0=날짜, col1=필드, col2=값)
        const d=col0,field=String(r[1]||'').trim(),val=r[2]!=null?String(r[2]):'';
        const fmap={book:'book',chapter:'chapter',detail:'detail',hw:'hwText'};
        if(d&&fmap[field]){G.journalInfo[d]=G.journalInfo[d]||{};G.journalInfo[d][fmap[field]]=val;}
      }
      if(section==='▼ 마지막저장'&&col0==='lastSaved'){
        G.lastSaved=String(r[1]||'').trim();
      }
    });
  }
  updateLastSavedDisplay();
}

// ─── 모든 학생·날짜의 hwRec.items 재구성 + 이월 전파 ───
// parseWB 직후, 그리고 closeLessonModal(items 캐시 무효화) 직후에 호출.
// closeLessonModal이 rec.items를 delete하면 prev의 items도 사라져서
// computeCarryover가 빈 배열을 반환하게 되어 carry 항목이 화면에서 누락되는 문제를 방지.
function rebuildAllHwItems(){
  G.lessons.forEach((les,idx)=>{
    if(idx===0)return;
    const date=les.날짜;
    const prevLesson=G.lessons[idx-1];
    const prevHwKeys=getLessonHwKeys(prevLesson);
    G.students.forEach(name=>{
      const key=`${name}||${date}`;
      let rec=G.hwRec[key];
      if(!rec){rec={이행률:null};G.hwRec[key]=rec;}
      const baseItems=prevHwKeys.map((k,i)=>{
        const text=prevLesson[k]||'';
        const status=stFromExcel(rec[`과제${i+1}_상태`]??'');
        const ref=`${prevLesson.id}-${k}`;
        return{text,status,ref,fromDate:prevLesson.날짜};
      }).filter(it=>it.text);
      // 이전 날짜의 학생별 추가과제도 base로 포함 (신 형식 ref: 텍스트 기반)
      const prevDateKey=`${name}||${prevLesson.날짜}`;
      const prevRec=G.hwRec[prevDateKey];
      if(prevRec?.extraHw){
        const extraBaseStart=baseItems.length;
        prevRec.extraHw.forEach((ex,ei)=>{
          const status=stFromExcel(rec[`과제${extraBaseStart+ei+1}_상태`]??'');
          const ref=buildExtraRef(prevLesson.id,ex.text);
          baseItems.push({text:ex.text,status,ref,fromDate:prevLesson.날짜});
        });
      }
      const carryItems=(rec.items||[]).filter(it=>isCarryForDate(it.fromDate,date));
      // carry 텍스트가 없으면 ref에서 해석, fromDate도 ref에서 복원
      carryItems.forEach(it=>{
        if(!it.text&&it.ref){
          const r=_resolveCarryRef(it.ref,name);
          it.text=r.text;
          if(!it.fromDate)it.fromDate=r.fromDate;
        }
      });
      rec.items=[...baseItems,...carryItems];
    });
  });
  buildAllCarryover();
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
  flushPropagations();
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
    const refs=td.hwItemRefs||items.map(()=>({ref:'',fromDate:''}));
    if(items.length){
      ex.items=items.map((text,i)=>({
        text,status:hs[i]??-1,
        ref:refs[i]?.ref||'',
        fromDate:refs[i]?.fromDate||''
      }));
    }
    // 레거시 필드
    for(let i=0;i<items.length;i++)ex[`과제${i+1}_상태`]=hs[i]??ex[`과제${i+1}_상태`]??-1;
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
        // 출결은 실제로 선택한 값만 저장 (이행률로 결석↔출석을 보정하지 않음)
        const att=G.attend[n]?.[date];
        const attVal=att!=null?att:'';
        const hwVals=Array.from({length:hwCount},(_,i)=>
          stToExcel(rec?.[`과제${i+1}_상태`]??-1));
        // 추가과제: 이번 주차 추가 과제 텍스트
        const extras=rec?.extraHw||[];
        const extraVals=Array.from({length:maxExtra},(_,i)=>{
          const ex=extras[i];if(!ex)return'';
          return ex.text;
        });
        // 비고: 원본 대비 상태가 변한 이월과제만 자동 요약 + 중복 제거
        const stDesc={2:'완료',1:'일부 완료',0:'미완료'};
        const carries=(rec?.items||[]).filter(it=>isCarryForDate(it.fromDate,date)&&it.ref&&!isNone(it.status));
        const changed=carries.filter(it=>{
          const orig=_getOriginalRefStatus(n,it.ref);
          return orig!=null&&it.status!==orig;
        });
        const seen=new Map();
        changed.forEach(it=>{seen.set(it.ref,it);});
        const autoText=[...seen.values()].map(it=>{
          const cd=refToCheckDate(it.ref);
          const fd=cd?`${shortD(cd)} 출제`:'이전';
          return`[이월] ${it.text} (${fd}) → ${stDesc[it.status]||'확인 전'}`;
        }).join(', ');
        const userMemo=G.memos[`${n}||${date}`]||'';
        const bigo=[autoText,userMemo].filter(x=>x).join(' | ');
        // 결석 날짜는 이행률 % 대신 '결석' 문자열로 저장
        const rateCell=att===0?'결석':(rate!=null?rate:'');
        return[n,attVal,G.wrong[n]?.[date]||'',rateCell,...hwVals,...extraVals,bigo];
      })
    ];
    const wsD=XLSX.utils.aoa_to_sheet(aoa,{skipHeader:false});
    const range=XLSX.utils.decode_range(wsD['!ref']||'A1');
    for(let R=range.s.r;R<=range.e.r;R++){
      for(let C=range.s.c;C<=range.e.c;C++){
        const addr=XLSX.utils.encode_cell({r:R,c:C});
        const cell=wsD[addr];if(!cell)continue;
        if(C>=4&&C<4+hwCount+maxExtra){cell.t='s';cell.v=String(cell.v===undefined?'':cell.v);continue;}
        // 출결(C=1)의 0은 '결석'을 뜻하므로 공란 처리에서 제외 (저장·재로드 시 결석 유지)
        if(cell.v===0&&cell.t==='n'&&C!==3&&C!==1){cell.v='';cell.t='s';}
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
      const carryItems=rec.items.filter(it=>isCarryForDate(it.fromDate,date)&&it.ref);
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
  // 이번 주차 과제 ON/OFF 상태 (col0="학생||날짜", col1=ref)
  const offRows=[];
  Object.entries(G.hwDisabled||{}).forEach(([key,set])=>{
    if(set instanceof Set&&set.size){set.forEach(ref=>{if(ref)offRows.push([key,ref,'']);});}
  });
  if(offRows.length){
    cfgAoa.push(['▼ 과제OFF','','']);
    offRows.forEach(r=>cfgAoa.push(r));
  }
  // 수업 일지표 코멘트 (col0="학생||날짜", col1=코멘트)
  const noteRows=Object.entries(G.journalNote||{}).filter(([,v])=>String(v||'').trim());
  if(noteRows.length){
    cfgAoa.push(['▼ 수업일지코멘트','','']);
    noteRows.forEach(([k,v])=>cfgAoa.push([k,String(v),'']));
  }
  // 수업 일지표 다음 수업 계획 (col0=날짜, col1=계획)
  const planRows=Object.entries(G.journalPlan||{}).filter(([,v])=>String(v||'').trim());
  if(planRows.length){
    cfgAoa.push(['▼ 수업일지계획','','']);
    planRows.forEach(([k,v])=>cfgAoa.push([k,String(v),'']));
  }
  // 수업 일지표 오늘 진도·과제 편집값 (col0=날짜, col1=필드, col2=값)
  const infoRows=[];
  Object.entries(G.journalInfo||{}).forEach(([d,o])=>{
    if(!o)return;
    [['book',o.book],['chapter',o.chapter],['detail',o.detail],['hw',o.hwText]].forEach(([f,v])=>{
      if(v!=null&&String(v).trim())infoRows.push([d,f,String(v)]);
    });
  });
  if(infoRows.length){
    cfgAoa.push(['▼ 수업일지진도','','']);
    infoRows.forEach(r=>cfgAoa.push(r));
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

// ─── 엑셀 데이터 제거 ───
function removeExcelData(){
  // 3버튼 모달 생성
  let overlay=$$('removeExcelOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='removeExcelOverlay';overlay.className='lm-overlay';
    overlay.innerHTML=`<div class="lm-modal" style="max-width:400px;">
      <div style="padding:28px;text-align:center;">
        <div style="font-size:36px;margin-bottom:12px;">⚠️</div>
        <div style="font-size:16px;font-weight:800;color:#111;margin-bottom:6px;">데이터 제거</div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:24px;line-height:1.6;">현재 작업 중인 모든 데이터가 삭제됩니다.<br>엑셀로 저장한 후 제거하시겠습니까?</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn-p" id="removeExcelSave" style="width:100%;padding:12px;">💾 저장 후 제거</button>
          <button class="btn-s" id="removeExcelDirect" style="width:100%;padding:12px;color:#dc2626;border-color:#fca5a5;">🗑 그냥 제거</button>
          <button class="btn-s" id="removeExcelCancel" style="width:100%;padding:12px;">취소</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(overlay);
  }
  overlay.style.display='flex';document.body.classList.add('modal-open');
  const close=()=>{overlay.style.display='none';document.body.classList.remove('modal-open');};
  $$('removeExcelCancel').onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close();};
  $$('removeExcelSave').onclick=async()=>{
    close();
    await saveToExcel();
    _clearAllData();
  };
  $$('removeExcelDirect').onclick=()=>{
    if(!confirm('정말 저장하지 않고 모든 데이터를 삭제하시겠습니까?'))return;
    close();_clearAllData();
  };
}

function _clearAllData(){
  G.lessons=[];G.students=[];
  G.rates={};G.scores={};G.corrects={};
  G.wrong={};G.hwRec={};G.memos={};G.attend={};G.mascotChoices={};
  G.selDate='';G.selStudent='';
  G.hwItems=[];G.hwStatus=[];G.hwItemRefs=[];
  G.hwRateManual=null;G.extraHw=[];G.reportEdits={};
  G.hwDisabled={};G.journalNote={};G.journalPlan={};G.journalInfo={};
  G.tabData={};G.studentPdfs={};
  G.pdfCanvases=[];G.pdfPageCount=0;G.currentSpread=0;
  G.excelFileName='학습리포트_데이터.xlsx';
  G.lastSaved='';G.unsaved=false;G.pendingPropagations=[];
  // UI 초기화
  $$('btnSave').style.display='none';$$('btnSave').disabled=true;
  const pdfBtn=$$('btnPdf');if(pdfBtn)pdfBtn.style.display='none';
  $$('btnExcelRemove').style.display='none';
  const zeroBtn=$$('btnZeroStart');if(zeroBtn)zeroBtn.style.display='';
  $$('sbar').className='sbar idle';
  $$('sbar').innerHTML='📂 엑셀 파일 불러오기';
  $$('sbar').onclick=triggerLoad;
  // DB 정리
  dbSet('appData',null);dbSet('session',null);dbSet('studentPdfs',null);
  // 뷰 초기화
  closeLessonModal();
  $$('viewDate').style.display='none';
  $$('dateNavBar').style.display='none';
  $$('attendBar').style.display='none';
  const sidebar=$$('studentSidebar');if(sidebar)sidebar.style.display='none';
  const stuNav=$$('stuNavGroup');if(stuNav)stuNav.style.display='none';
  markSaved();updateLastSavedDisplay();
  setBar('idle','📂 엑셀 파일 불러오기');
}

// ─── 샘플 엑셀 생성 ───
function createSampleExcel(){
  const students=['김민수','이서윤','박지호','최예린'];
  const dates=['2026-03-11','2026-03-18','2026-03-25'];
  const wb=XLSX.utils.book_new();
  // 수업정보 시트
  const ws1=XLSX.utils.aoa_to_sheet([
    ['ID','날짜','교재','단원','상세진도','과제1','과제2','과제3'],
    [genLessonId(),dates[0],'수학의 정석','1단원 - 집합','집합의 뜻과 표현\n부분집합','교재 p.12~15 풀기','오답노트 정리',''],
    [genLessonId(),dates[1],'수학의 정석','1단원 - 집합','합집합과 교집합\n여집합과 차집합','교재 p.16~20 풀기','오답노트 정리','워크시트 1장'],
    [genLessonId(),dates[2],'수학의 정석','2단원 - 명제','명제와 조건\n충분조건과 필요조건','교재 p.25~30 풀기','오답노트 정리','기출문제 5문항']
  ]);
  dates.forEach((_,i)=>{[0,1].forEach(c=>{const cell=ws1[XLSX.utils.encode_cell({r:i+1,c})];if(cell)cell.t='s';});});
  XLSX.utils.book_append_sheet(wb,ws1,'수업정보');

  // 날짜별 시트
  // 1회차: 데이터 없음 (첫 수업)
  const ws_d1=XLSX.utils.aoa_to_sheet([
    ['이름','출결','오답','과제이행률','과제1','과제2','과제3','비고'],
    ...students.map(n=>[n,'2','','','','','',''])
  ]);
  XLSX.utils.book_append_sheet(wb,ws_d1,dates[0]);

  // 2회차: 쌈뽕하게 채움 (이전 과제 2개에 대한 상태 + 이행률)
  const d2Data=[
    ['김민수','2','','90','2','2','',''],
    ['이서윤','2','3, 7','75','2','1','',''],
    ['박지호','2','','60','1','1','',''],
    ['최예린','2','','100','2','2','','']
  ];
  const ws_d2=XLSX.utils.aoa_to_sheet([
    ['이름','출결','오답','과제이행률','과제1','과제2','과제3','비고'],
    ...d2Data
  ]);
  XLSX.utils.book_append_sheet(wb,ws_d2,dates[1]);

  // 3회차: 빈 데이터
  const ws_d3=XLSX.utils.aoa_to_sheet([
    ['이름','출결','오답','과제이행률','과제1','과제2','과제3','비고'],
    ...students.map(n=>[n,'','','','','','',''])
  ]);
  XLSX.utils.book_append_sheet(wb,ws_d3,dates[2]);

  // 다운로드
  const fname='학습리포트_샘플.xlsx';
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:'application/octet-stream'}));
  a.download=fname;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  setBar('ok','✅ 샘플 파일 다운로드 완료! 이 파일을 불러와서 사용해보세요.');
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
