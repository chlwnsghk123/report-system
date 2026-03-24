# UI 레이아웃 & 전역 상태

## 레이아웃 트리

```
body (flex, 100vh)
├─ .panel (좌, 400px)
│  ├─ .panel-head
│  │  ├─ #sbar          상태바 / 엑셀 불러오기 (클릭 → triggerLoad)
│  │  ├─ #btnSave       파일 저장 버튼 (로드 후 표시)
│  │  └─ #excelInput    파일 선택 input (hidden)
│  ├─ #viewTabs         뷰 탭 바 (로드 후 표시)
│  │  ├─ .vt-item[config]  ⚙ 수업설정 탭
│  │  └─ .vt-date-nav      날짜 탭 영역 (◀ 날짜들 ▶)
│  ├─ #tabBar           학생 탭바 (날짜 뷰에서만 표시)
│  └─ .panel-body
│     ├─ #viewConfig    수업설정 뷰
│     │  ├─ 학생 관리 (접기/펼치기)
│     │  │  ├─ #studentSummary  학생 요약
│     │  │  └─ #studentListEdit 학생 추가/삭제 UI
│     │  └─ #lessonCards        날짜별 레슨 카드
│     │     └─ .lesson-card × N (교재/단원/상세진도/과제1~4 입력)
│     └─ #viewDate      날짜별 학생기록 뷰
│        ├─ #dateSummary     수업정보 읽기전용 요약
│        ├─ #gPrevHw         저번 주차 과제 + 이행률
│        │   ├─ #hwEditor    과제 에디터 (항목 + 상태 버튼)
│        │   └─ #inputRate   이행률 수동 입력 (0~100)
│        ├─ #toggleMini      미니 테스트 토글 스위치
│        ├─ #gMini           미니 테스트 입력 영역
│        ├─ #toggleComment   코멘트 토글 스위치
│        ├─ #gComment        코멘트 입력 영역
│        ├─ #btnMemo          비고 작성 버튼
│        ├─ #btnPdf          PDF 저장 버튼
│        └─ #btnPdf          PDF 저장 버튼
│  (hidden inputs: inCurBook, inCurChap, inCurDetail, inPrevBook/Chap/Detail, inputNotice, inputCorrect/Total, calcResult)
└─ .preview (우, flex:1)
   ├─ #pageNav          페이지 네비 (‹ · 페이지 정보 · ›)
   └─ #spreadRow
      ├─ #leftSlot
      │  ├─ #reportCard     A4 캡처 대상
      │  │  ├─ .rc-header   학생명 (#rName) · 날짜 (#rDate)
      │  │  ├─ #secRate     ① 이행률 + SVG 꺾은선 그래프 + 마스코트
      │  │  ├─ #secPrevHw   ② 저번 주차 과제 목록
      │  │  ├─ (수업 진도)  ③ 현재/이전 진도
      │  │  ├─ (이번 과제)  ④ 이번 주차 과제 목록
      │  │  ├─ #secMini     ⑤ 미니 테스트 (선택)
      │  │  └─ #secComment  ⑥ 코멘트 (선택)
      │  └─ #leftPdfCanvas  PDF 페이지 캔버스
      └─ #rightSlot > #rightPdfCanvas
```

## 전역 상태 객체 G

```js
G = {
  // 엑셀 파싱 결과
  lessons: [],     // [{날짜,교재,단원,상세진도,과제1~N,전체문제수}]
  students: [],    // ['이름1',...]

  // 학생별·날짜별
  rates: {},       // {학생명:{날짜:이행률%}}
  scores: {},      // {학생명:{날짜:점수}}
  corrects: {},    // {학생명:{날짜:맞힌개수}}
  wrong: {},       // {학생명:{날짜:"오답번호문자열"}}
  hwRec: {},       // {"학생명||날짜":{이행률,과제1_상태~N_상태,items:[{text,status,type,fromDate}]}}
  memos: {},       // {"학생명||날짜":"비고 텍스트"} — 리포트 미반영, 엑셀 저장용

  // 현재 선택
  selDate: '', selStudent: '',

  // 과제 입력
  hwItems: [],        // 저번 주차 과제 항목 배열 (base + 이전extraHw + carry 병합)
  hwStatus: [],       // 각 과제 상태 ('' | '완료' | '부분완료' | '미완료')
  hwItemTypes: [],    // 각 항목 타입 [{type:'base'} | {type:'carry',fromDate:'YYYY-MM-DD'}]
  extraHw: [],        // 이번 주차 학생별 추가 과제 [{text}]
  hwRateManual: null, // null=엑셀 데이터 사용, 숫자=수동입력
  reportEdits: {},    // 리포트카드 contenteditable 직접편집 오버라이드 (키: 요소ID, 값: innerHTML)

  // 미니테스트
  totalQ: 5,

  // 토글 상태
  showMini: false, showComment: false,

  // 마스코트 선택
  mascotChoices: {},   // (레거시) DB 호환용, 실사용 안 함
  selectedMascot: null, // {tier:'high'|'mid'|'low', idx:숫자} — 세션 내 고정 마스코트 (DB/엑셀 미저장)
  lastSaved: '',       // 마지막 엑셀 저장 날짜/시간 (설정 시트에 저장/복원)

  // 탭 임시 저장
  tabData: {},

  // 뷰 상태
  currentView: 'config',   // 'config' | 'date'
  dateTabOffset: 0,         // 날짜 탭 스크롤 오프셋

  // 기타
  excelFileName: '학습리포트_데이터.xlsx',
  attachedPdfBytes: null,
  pdfCanvases: [], pdfPageCount: 0, currentSpread: 0,
}
```

## CDN 라이브러리

| 라이브러리 | 버전 | 용도 |
|---|---|---|
| XLSX | 0.18.5 | 엑셀 읽기/쓰기 |
| html2canvas | latest | HTML→캔버스 (PDF용) |
| pdf-lib | 1.17.1 | PDF 생성·이미지 임베드 |
| pdf.js | 3.11.174 | 첨부 PDF 미리보기 |

## IndexedDB
- DB: `reportApp4`, Store: `data`
- 키: `'appData'`(lessons/students/rates/scores/corrects/wrong/hwRec/memos/tabData/fileName/mascotChoices), `'session'`(selDate·selStudent·showMini·showComment·currentView)
- 참고: IndexedDB에 저장되는 키는 `fileName` (G.excelFileName 값을 저장)
