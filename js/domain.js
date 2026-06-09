// ─── 도메인 계층 (Domain Layer) ───
// DOM·저장소·프레임워크에 의존하지 않는 순수 비즈니스 규칙 모음.
// 전역 상태 G를 "읽기만" 하며(부수효과 없음), 표현 계층(report.js·pdf.js·ui.js)과
// 인프라 계층(excel.js)이 이 규칙을 호출한다.
// 아키텍처 전반과 채택 배경은 docs/architecture.md 참고.

// ════════════════════════════════════════
// 1) 출결 규칙 (Attendance Rules)
// ════════════════════════════════════════
// G.attend[학생][날짜] 값: 2=출석, 1=지각, 0=결석, -1=특수/제외, undefined=미선택
// ★ 핵심 원칙: 출결은 "실제로 선택한 값"만을 기준으로 판정한다.
//   과제 이행률(G.rates)로 출석/결석을 추정하지 않는다.

// 학생·날짜의 원본 출결값 반환 (없으면 undefined)
function attOf(student,date){
  if(!student||!date)return undefined;
  return G.attend?.[student]?.[date];
}
// 명시적으로 '결석'을 선택한 경우에만 결석으로 판정
function isAbsent(student,date){return attOf(student,date)===0;}
// 출석 또는 지각을 선택한 경우 (실제 출석)
function isPresent(student,date){const v=attOf(student,date);return v===2||v===1;}
// 특수/제외(-1): 요약·집계에서 제외
function isExcluded(student,date){return attOf(student,date)===-1;}
// 리포트/PDF 생성 대상 여부 — 명시적 결석·제외가 아니면 대상
function isReportEligible(student,date){const v=attOf(student,date);return v!==0&&v!==-1;}
// 출결 분류 문자열 ('present'|'late'|'absent'|'excluded'|'none')
function attendCategory(student,date){
  const v=attOf(student,date);
  if(v===2)return'present';
  if(v===1)return'late';
  if(v===0)return'absent';
  if(v===-1)return'excluded';
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
