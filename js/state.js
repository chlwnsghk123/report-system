// ─── pdf.js 워커 설정 ───
if(typeof pdfjsLib!=='undefined')
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ─── DOM 헬퍼 ───
const $$=id=>document.getElementById(id);

// ─── 전역 상태 G ───
const G={
  lessons:[],students:[],
  rates:{},scores:{},corrects:{},wrong:{},hwRec:{},memos:{},
  selDate:'',selStudent:'',
  hwItems:[],hwStatus:[],hwItemTypes:[],hwRateManual:null,extraHw:[],reportEdits:{},
  totalQ:5,
  showMini:false,showComment:false,
  tabData:{},
  excelFileName:'학습리포트_데이터.xlsx',
  attachedPdfBytes:null,pdfCanvases:[],pdfPageCount:0,currentSpread:0,
  mascotChoices:{},selectedMascot:null,
  currentView:'config',dateTabOffset:0,
};

// ─── IndexedDB 상수 ───
const DB='reportApp4',STORE='data';
let db=null;
