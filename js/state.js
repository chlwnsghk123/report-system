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
  mascotChoices:{},selectedMascot:null,lastSaved:'',
  currentView:'config',dateTabOffset:0,unsaved:false,
};

// ─── IndexedDB 상수 ───
const DB='reportApp4',STORE='data';
let db=null;
