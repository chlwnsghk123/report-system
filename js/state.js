// ─── pdf.js 워커 설정 ───
if(typeof pdfjsLib!=='undefined')
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ─── DOM 헬퍼 ───
const $$=id=>document.getElementById(id);

// ─── 상태값 판별 헬퍼 (''과 -1 모두 "없음") ───
const isNone=s=>s===''||s===-1||s==null||s===undefined;

// ─── 수업 ID 생성 (10자리 난수) ───
function genLessonId(){return String(Math.floor(Math.random()*9e9)+1e9);}

// ─── 전역 상태 G ───
const G={
  lessons:[],students:[],
  rates:{},wrong:{},hwRec:{},memos:{},attend:{},
  selDate:'',selStudent:'',
  hwItems:[],hwStatus:[],hwItemRefs:[],hwRateManual:null,extraHw:[],
  showMini:false,showComment:false,colorMode:false,
  tabData:{},
  excelFileName:'학습리포트_데이터.xlsx',
  pdfCanvases:[],
  studentPdfs:{},  // {studentName: [{name:string, canvases:[캔버스], pageCount:number}]} — 첨부 시험자료, 세션 한정
  mascotChoices:{},lastSaved:'',
  currentView:'config',unsaved:false,
  pendingPropagations:[],
  hwDisabled:{},  // {"학생||날짜": Set(OFF된 과제 ref)} — 이번 주차 과제 ON/OFF
  journalNote:{}, // {"학생||날짜": "코멘트"} — 선생님 코멘트 (수업 일지표 + 리포트 '선생님 한마디' 공용)
  journalPlan:{}, // {"날짜": "다음 수업 계획"} — 수업 일지표 다음 수업 계획
  journalInfo:{}, // {"날짜": {book?,chapter?,detail?,hwText?}} — 수업 일지표 진도·과제 편집값 (수업 정보와 다른 항목만)
  miniTest:{},    // {"날짜": {total:문항수, range:"시험 범위"}} — 미니 테스트 정보 (날짜별)
  miniScore:{},   // {"학생||날짜": 맞힌 수} — 직접 입력한 경우만 (없으면 문항수-오답수)
  teacherName:'', // 리포트 코멘트 서명 (From. ○○ T)
};

// ─── 엑셀·IndexedDB에 저장되는 데이터 필드 (저장·복구·초기화 공용) ───
const DATA_KEYS=['lessons','students','rates','wrong','hwRec','memos','attend','mascotChoices','hwDisabled',
  'journalNote','journalPlan','journalInfo','miniTest','miniScore','teacherName','showMini','showComment','colorMode','lastSaved'];

// ─── IndexedDB 상수 ───
const DB='reportApp4',STORE='data';
let db=null;
