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
  rates:{},scores:{},corrects:{},wrong:{},hwRec:{},memos:{},attend:{},
  selDate:'',selStudent:'',
  hwItems:[],hwStatus:[],hwItemRefs:[],hwRateManual:null,extraHw:[],reportEdits:{},
  totalQ:5,
  showMini:false,showComment:false,colorMode:false,
  tabData:{},
  excelFileName:'학습리포트_데이터.xlsx',
  attachedPdfBytes:null,pdfCanvases:[],pdfPageCount:0,currentSpread:0,
  studentPdfs:{},  // {studentName: [{bytes:Uint8Array, name:string, canvases:[], pageCount:number}, ...]}
  mascotChoices:{},selectedMascot:null,lastSaved:'',
  currentView:'config',dateTabOffset:0,unsaved:false,
  pendingPropagations:[],
  hwDisabled:{},  // {"학생||날짜": Set(OFF된 과제 ref)} — 이번 주차 과제 ON/OFF
  journalNote:{}, // {"학생||날짜": "코멘트"} — 수업 일지표 학생별 코멘트 (날짜별 저장)
  journalPlan:{}, // {"날짜": "다음 수업 계획"} — 수업 일지표 다음 수업 계획
  journalInfo:{}, // {"날짜": {book,chapter,detail,hwText}} — 수업 일지표 오늘 진도·과제 편집값 (없으면 레슨 기본값)
};

// ─── IndexedDB 상수 ───
const DB='reportApp4',STORE='data';
let db=null;
