// ─── 엑셀 로드 ───
function triggerLoad(){$$('excelInput').click();}

async function loadExcel(input){
  const file=input.files[0];if(!file)return;
  setBar('wait','⏳ 파싱 중...');
  try{
    const buf=await file.arrayBuffer();
    parseWB(XLSX.read(buf,{type:'array',cellDates:false,raw:false}));
    G.excelFileName=file.name;G.tabData={};
    await saveAppData();populateSels();showGroups();
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

// 워크북 파싱 → G 채움
function parseWB(wb){
  G.lessons=[];
  const ws1=wb.Sheets['수업정보'];
  if(ws1){
    XLSX.utils.sheet_to_json(ws1,{header:1,defval:'',raw:false}).slice(1).forEach(r=>{
      const d=toDS(r[0]);if(!d)return;
      G.lessons.push({날짜:d,강사명:String(r[1]||'').trim(),전체문제수:5,
        교재:String(r[2]||'').trim(),단원:String(r[3]||'').trim(),상세진도:String(r[4]||'').trim(),
        과제1:String(r[5]||'').trim(),과제2:String(r[6]||'').trim(),과제3:String(r[7]||'').trim(),
        과제4:String(r[8]||'').trim(),과제5:String(r[9]||'').trim()});
    });
    G.lessons.sort((a,b)=>a.날짜.localeCompare(b.날짜));
  }

  G.students=[];G.scores={};G.corrects={};G.wrong={};G.hwRec={};G.rates={};

  // 새 형식(날짜별 시트) vs 구 형식(성적+학생별 시트) 감지
  const hasDateSheets=wb.SheetNames.some(n=>/^\d{4}-\d{2}-\d{2}$/.test(n));

  if(hasDateSheets){
    // 새 형식: 첫 번째 날짜 시트에서 학생 순서 결정
    const firstDate=wb.SheetNames.find(n=>/^\d{4}-\d{2}-\d{2}$/.test(n));
    if(firstDate){
      XLSX.utils.sheet_to_json(wb.Sheets[firstDate],{header:1,defval:'',raw:false}).slice(1).forEach(r=>{
        const name=String(r[0]||'').trim();if(name&&!G.students.includes(name))G.students.push(name);
      });
    }
    // 모든 날짜 시트 파싱
    // rows[0]=헤더, rows[1+]=학생데이터
    wb.SheetNames.forEach(sheetName=>{
      if(!/^\d{4}-\d{2}-\d{2}$/.test(sheetName))return;
      const ws=wb.Sheets[sheetName];if(!ws)return;
      const date=sheetName;
      XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false}).slice(1).forEach(r=>{
        const name=String(r[0]||'').trim();if(!name)return;
        if(!G.students.includes(name))G.students.push(name);
        // 성적: "맞힌/전체" 형식
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
        const rate=parseFloat(r[3]);
        if(!isNaN(rate)){G.rates[name]=G.rates[name]||{};G.rates[name][date]=rate;}
        const key=`${name}||${date}`;
        G.hwRec[key]={이행률:isNaN(rate)?null:rate,
          과제1_상태:String(r[4]||'').trim(),과제2_상태:String(r[5]||'').trim(),
          과제3_상태:String(r[6]||'').trim(),과제4_상태:String(r[7]||'').trim(),
          과제5_상태:String(r[8]||'').trim()};
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
        const rate=r[1]!==''?parseFloat(r[1]):null;
        const key=`${name}||${d}`;
        G.hwRec[key]={이행률:isNaN(rate)?null:rate,
          과제1_상태:String(r[3]||'').trim(),과제2_상태:String(r[5]||'').trim(),
          과제3_상태:String(r[7]||'').trim(),과제4_상태:String(r[9]||'').trim(),과제5_상태:String(r[11]||'').trim()};
        if(!isNaN(rate)&&rate!==null){G.rates[name]=G.rates[name]||{};G.rates[name][d]=rate;}
      });
    });
  }
}

// ─── 엑셀 저장 ───
async function saveToExcel(){
  const btn=$$('btnSave');btn.disabled=true;btn.textContent='저장 중...';
  saveTabData();
  const cur=getCurL(),prev=getPrevL();
  if(cur){
    cur.교재=$$('inCurBook').value;cur.단원=$$('inCurChap').value;cur.상세진도=$$('inCurDetail').value;
    const lines=$$('inputNotice').value.split('\n').filter(l=>l.trim());
    for(let i=0;i<5;i++)cur[`과제${i+1}`]=lines[i]||'';
    cur.강사명=$$('inputTeacher').value.replace(/^From\. /,'').replace(/ T$/,'');
  }
  G.students.forEach(n=>{
    const td=G.tabData[n];if(!td||!G.selDate)return;
    if(td.scoreCalc!=null){G.scores[n]=G.scores[n]||{};G.scores[n][G.selDate]=td.scoreCalc;}
    if(td.correctInput!==''){G.corrects[n]=G.corrects[n]||{};G.corrects[n][G.selDate]=parseInt(td.correctInput)||0;}
    if(td.wrongInput){G.wrong[n]=G.wrong[n]||{};G.wrong[n][G.selDate]=td.wrongInput;}
    if(prev){
      if(n===G.selStudent){
        G.hwItems.forEach((item,idx)=>{prev[`과제${idx+1}`]=item||'';});
        for(let i=G.hwItems.length;i<5;i++)prev[`과제${i+1}`]='';
      }
      const key=`${n}||${prev.날짜}`;
      const ex=G.hwRec[key]||{이행률:null,과제1_상태:'',과제2_상태:'',과제3_상태:'',과제4_상태:'',과제5_상태:''};
      if(td.rateManual!=null){ex.이행률=td.rateManual;G.rates[n]=G.rates[n]||{};G.rates[n][prev.날짜]=td.rateManual;}
      const hs=td.hwStatus||[];for(let i=0;i<5;i++)ex[`과제${i+1}_상태`]=hs[i]||ex[`과제${i+1}_상태`]||'';
      G.hwRec[key]=ex;
    }
  });
  await saveAppData();
  const wb=XLSX.utils.book_new();
  // 수업정보 시트
  const ws1=XLSX.utils.aoa_to_sheet([
    ['날짜','강사명','교재','단원','상세진도','과제1','과제2','과제3','과제4','과제5'],
    ...G.lessons.map(l=>[l.날짜,l.강사명,l.교재,l.단원,l.상세진도,l.과제1,l.과제2,l.과제3,l.과제4,l.과제5])]);
  G.lessons.forEach((_,i)=>{const c=ws1[XLSX.utils.encode_cell({r:i+1,c:0})];if(c)c.t='s';});
  XLSX.utils.book_append_sheet(wb,ws1,'수업정보');
  // 날짜별 시트 (학생별 시트 대체)
  // 행 0: 헤더, 행 1+: 학생별 데이터
  G.lessons.forEach(les=>{
    const date=les.날짜,total=les.전체문제수||5;
    const wsD=XLSX.utils.aoa_to_sheet([
      ['이름','성적','오답','과제이행률','과제1','과제2','과제3','과제4','과제5'],
      ...G.students.map(n=>{
        const correct=G.corrects[n]?.[date];
        const scoreStr=correct!==undefined?`${correct}/${total}`:'';
        const key=`${n}||${date}`,rec=G.hwRec[key];
        return[n,scoreStr,G.wrong[n]?.[date]||'',rec?.이행률??'',
          rec?.과제1_상태||'',rec?.과제2_상태||'',rec?.과제3_상태||'',
          rec?.과제4_상태||'',rec?.과제5_상태||''];
      })
    ]);
    XLSX.utils.book_append_sheet(wb,wsD,date);
  });
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:'application/octet-stream'}));
  a.download=G.excelFileName;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  $$('lastSaved').style.display='';
  $$('lastSaved').textContent=`✅ ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} 저장됨`;
  btn.disabled=false;btn.textContent='💾 저장 (엑셀)';saveSession();
}

// ─── 템플릿 생성 ───
function createTemplate(){
  if(!confirm('6월까지 주 1회 수업 날짜가 포함된 새 엑셀 템플릿을 생성합니다.\n계속하시겠습니까?'))return;
  const students=G.students.length?G.students:['하정','김도은','윤희','황선재','원빈','희은'];
  // 오늘부터 6월 말까지 주 1회 날짜 생성
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
    ['날짜','강사명','교재','단원','상세진도','과제1','과제2','과제3','과제4','과제5'],
    ...dates.map(d=>[d,'','','','','','','','',''])
  ]);
  dates.forEach((_,i)=>{const c=ws1[XLSX.utils.encode_cell({r:i+1,c:0})];if(c)c.t='s';});
  XLSX.utils.book_append_sheet(wb,ws1,'수업정보');
  dates.forEach(date=>{
    const wsD=XLSX.utils.aoa_to_sheet([
      ['이름','성적','오답','과제이행률','과제1','과제2','과제3','과제4','과제5'],
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
