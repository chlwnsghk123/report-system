// ─── 도메인 계층 (Domain Layer) ───
// DOM·저장소·프레임워크에 의존하지 않는 순수 비즈니스 규칙 모음.
// 전역 상태 G를 "읽기만" 하며(부수효과 없음), 표현 계층(report.js·pdf.js·ui.js)과
// 인프라 계층(excel.js)이 이 규칙을 호출한다.
// 아키텍처 전반과 채택 배경은 docs/architecture.md 참고.

// ════════════════════════════════════════
// 1) 출결 규칙 (Attendance Rules)
// ════════════════════════════════════════
// G.attend[학생][날짜] 값: 2=출석, 1=지각, 0=결석, 없음(undefined)=미선택
// ★ 핵심 원칙: 출결은 "실제로 선택한 값"만을 기준으로 판정한다.
//   과제 이행률(G.rates)로 출석/결석을 추정하지 않는다.
// ※ 구버전 파일의 -1은 '선택 해제'를 뜻했으므로 미선택으로 취급한다.

// 학생·날짜의 출결값 반환 (2|1|0, 미선택이면 undefined)
function attOf(student,date){
  if(!student||!date)return undefined;
  const v=G.attend?.[student]?.[date];
  return(v===0||v===1||v===2)?v:undefined;
}
// 명시적으로 '결석'을 선택한 경우에만 결석으로 판정
function isAbsent(student,date){return attOf(student,date)===0;}
// 리포트/PDF 생성 대상 여부 — 명시적 결석만 제외
function isReportEligible(student,date){return attOf(student,date)!==0;}
// 출결 분류 문자열 ('present'|'late'|'absent'|'none')
function attendCategory(student,date){
  const v=attOf(student,date);
  if(v===2)return'present';
  if(v===1)return'late';
  if(v===0)return'absent';
  return'none';
}

// ════════════════════════════════════════
// 2) 이번 주차 과제 ON/OFF 규칙 (Homework Assignment Rules)
// ════════════════════════════════════════
// '이번 주차 과제'를 OFF 하면 ① 이번 회차 리포트에서 숨고,
// ② 다음 회차 '저번 주차 과제' 체크목록에도 나타나지 않는다(=숙제 없음).
// 저장 구조: G.hwDisabled["학생||날짜"] = Set(OFF된 과제 ref)

// 읽기 전용: 해당 학생·날짜의 OFF된 과제 ref 집합 반환 (없으면 빈 Set)
function hwOffSet(student,date){
  if(!G.hwDisabled||G.hwDisabled instanceof Set||typeof G.hwDisabled!=='object')return new Set();
  const s=G.hwDisabled[`${student}||${date}`];
  return s instanceof Set?s:new Set();
}
// 특정 과제(ref)가 해당 학생·날짜에 OFF 되었는지 여부
function isHwOff(student,date,ref){return!!ref&&hwOffSet(student,date).has(ref);}

// ════════════════════════════════════════
// 3) 이행률 규칙 (Homework Rate Rules)
// ════════════════════════════════════════
// 계산: 완료=100, 부분완료=50, 미완료=0의 평균(반올림). '없음'·이월과제는 계산에서 제외.
// 등급: 모든 화면·출력물(리포트·요약표·일지표·마스코트)이 같은 기준을 쓰도록 여기서만 정의.
const RATE_TIER={high:75,mid:30}; // 75% 이상=양호, 30~74%=보통, 30% 미만=미흡
const RATE_STYLE={
  high:{label:'양호',fg:'#166534',bg:'#dcfce7'},
  mid:{label:'보통',fg:'#92400e',bg:'#fef3c7'},
  low:{label:'미흡',fg:'#991b1b',bg:'#fee2e2'},
};
// 이행률 → 'high'|'mid'|'low' (값이 없거나 음수면 null)
function rateTier(v){
  if(v==null||v===''||isNaN(v)||v<0)return null;
  return v>=RATE_TIER.high?'high':v>=RATE_TIER.mid?'mid':'low';
}
function rateFg(v){return RATE_STYLE[rateTier(v)]?.fg||'#9ca3af';}
function rateBg(v){return RATE_STYLE[rateTier(v)]?.bg||'#f1f3f5';}
// '(선택)'으로 시작하는 과제 = 선택 과제 → 이행률 계산·이월 대상에서 제외 (안 해도 불이익 없음)
function isOptionalHw(text){return/[(（]\s*선택\s*[)）]/.test(String(text||''));}
// 과제 상태 배열 → 이행률(0~100 정수), 상태가 하나도 없으면 null
function calcRate(statuses){
  const sc=(statuses||[]).filter(s=>s===0||s===1||s===2).map(s=>s===2?100:s===1?50:0);
  return sc.length?Math.round(sc.reduce((a,b)=>a+b,0)/sc.length):null;
}
// 과제 상태 배열 → {done, partial, miss} 개수
function hwStatusCounts(statuses){
  const c={done:0,partial:0,miss:0};
  (statuses||[]).forEach(s=>{if(s===2)c.done++;else if(s===1)c.partial++;else if(s===0)c.miss++;});
  return c;
}

// ════════════════════════════════════════
// 4) 미니 테스트 규칙 (Mini Test Rules)
// ════════════════════════════════════════
// 저장 구조: G.wrong[학생][날짜]="3, 7"(오답 번호), G.miniTest[날짜]={total:문항수, range:범위},
//           G.miniScore["학생||날짜"]=맞힌 수(직접 입력 시에만, 없으면 문항수-오답수로 자동 계산)
// 오답칸에 '0'·'없음'·'만점'을 적으면 다 맞음(만점)을 뜻함
const MINI_PERFECT_MARKS=['0','없음','만점'];
// 오답 문자열 → 번호 배열 (만점 표시는 제외)
// 쉼표로 나누고, '3 7 12'·'3.7.12'·'3번 7번'처럼 번호만 나열한 조각은 띄어쓰기·마침표로도 나눔.
// '4번'은 '4'로 통일 (표시할 때 '번'을 붙임), '1-2' 같은 소문항은 그대로
function parseWrongList(str){
  const out=[];
  String(str||'').split(/[,，、]/).forEach(part=>{
    const p=part.trim();if(!p)return;
    const toks=p.split(/[\s.\/·]+/).filter(Boolean);
    if(toks.length>1&&toks.every(t=>/^\d+(-\d+)?번?$/.test(t)))out.push(...toks);
    else out.push(p);
  });
  return out.map(t=>t.replace(/^(\d+(?:-\d+)?)번$/,'$1')).filter(s=>!MINI_PERFECT_MARKS.includes(s));
}
// 문항 수 범위를 벗어난 오답 번호 (입력 실수 확인용) — '1-2' 같은 소문항은 앞 번호로 판단, 글자 항목은 제외
function miniOutOfRange(student,date){
  const total=Number(G.miniTest?.[date]?.total);
  if(!(total>0))return[];
  return parseWrongList(G.wrong?.[student]?.[date]).filter(t=>{const n=parseInt(t,10);return!isNaN(n)&&(n<1||n>total);});
}
// 학생·날짜의 미니테스트 결과 (결석이거나 그 학생 입력이 없으면 null)
// ★ 반 공통 문항 수만 있고 학생 입력(오답·만점 표시·맞힌 수)이 없으면 '만점'으로 보지 않음 (미입력)
// 반환: {total, correct, wrong:[...], range, pct, perfect}
function miniResult(student,date){
  if(!student||!date||isAbsent(student,date))return null;
  const raw=String(G.wrong?.[student]?.[date]||'').trim();
  const wrong=parseWrongList(raw);
  const t=G.miniTest?.[date]||{};
  const total=Number(t.total)>0?Math.round(Number(t.total)):null;
  const ov=G.miniScore?.[`${student}||${date}`];
  const hasOv=ov!=null&&ov!==''&&!isNaN(ov);
  if(!raw&&!hasOv)return null;
  let correct=hasOv?Math.max(0,Number(ov)):(total!=null?Math.max(0,total-wrong.length):null);
  if(correct!=null&&total!=null)correct=Math.min(correct,total);
  const pct=(correct!=null&&total)?Math.round(correct/total*100):null;
  return{total,correct,wrong,range:String(t.range||'').trim(),pct,perfect:total!=null&&correct===total&&!wrong.length};
}
