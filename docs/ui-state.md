# UI 레이아웃 & 전역 상태

## 레이아웃 트리

```
body (flex, 100vh)
├─ .panel (좌, 400px, 드래그 리사이즈 가능 280~700px)
│  ├─ .panel-head (흰색 배경, 하단 보더)
│  │  ├─ .panel-brand (제목 + 마지막 저장 시간)
│  │  │  ├─ .panel-logo + .panel-title  "📝 학습 리포트"
│  │  │  └─ #rLastSaved (.panel-saved)  마지막 저장 시간 (작은 텍스트)
│  │  ├─ #sbar          상태바 / 엑셀 불러오기 (클릭 → triggerLoad)
│  │  └─ #excelInput    파일 선택 input (hidden)
│  ├─ #viewTabs         (숨김, 레거시 — 날짜 선택은 우측 사이드바+상단 네비로 대체)
│  └─ .panel-body
│     └─ #viewDate      날짜별 학생기록 뷰
│        ├─ #dateSummary     수업정보 읽기전용 요약 (.date-summary, 카드형)
│        ├─ .panel-section "과제 & 이행률"
│        │  ├─ .panel-card > #gPrevHw  저번 주차 과제 + 이행률
│        │  │  ├─ #hwEditor    과제 에디터 (항목 + 상태 버튼)
│        │  │  └─ .rate-input-row > #inputRate  이행률 수동 입력 (0~100)
│        │  └─ .panel-card > #gCurHw   이번 주차 과제 + 추가 과제 입력
│        └─ .panel-section "선택 항목"
│           ├─ #toggleMini      미니 테스트 토글 스위치
│           ├─ #gMini > .panel-card  오답 번호 입력 (#inputWrong)
│           ├─ #toggleComment   코멘트 토글 (임시 숨김)
│           └─ #btnMemo         비고 작성 버튼 (임시 숨김)
│  (hidden inputs: inCurBook, inCurChap, inCurDetail, inPrevBook/Chap/Detail, inputNotice, inputCorrect/Total, calcResult)
├─ .panel-resize (#panelResize)  드래그 리사이즈 핸들
└─ .preview (우, flex:1)
   ├─ #unsavedBanner    미저장 배너
   ├─ .toolbar          상단 도구 모음
   │  ├─ #attendToggle  출결 세그먼트 (출석/지각/결석)
   │  ├─ #btnPdf        PDF 내보내기 버튼
   │  ├─ #btnSave       저장 버튼
   │  ├─ #tbMenu        ☰ 메뉴 드롭다운 (일괄PDF, 요약표, 수업일지 등)
   │  └─ #tbSettings    ⚙ 설정 드롭다운
   │     ├─ 📋 수업 진도 설정 → openLessonModal()
   │     └─ 🌙 흑백 모드 토글
   └─ .preview-body (flex row)
      ├─ .preview-content (flex:1)
      │  ├─ #dateNavBar     상단 날짜 네비게이션 (‹ 날짜 › + 클릭 드롭다운)
      │  │  ├─ .dn-arrow × 2  이전/다음 화살표
      │  │  ├─ #dnLabel       날짜 텍스트 (클릭 → 드롭다운)
      │  │  └─ #dnDropdown    전체 날짜 드롭다운 목록
      │  ├─ #pageNav      페이지 네비 (‹ · 페이지 정보 · › + PDF 삭제 버튼)
      │  ├─ #spreadRow
      │  │  ├─ #leftSlot
      │  │  │  ├─ #reportCard  A4 캡처 대상 (.rc-transition 슬라이드 애니메이션)
      │  │  │  ├─ #leftPdfCanvas
      │  │  │  └─ #pdfAddInline  PDF 첨부 버튼 (+, 리포트카드 바로 오른쪽)
      │  │  └─ #rightSlot > #rightPdfCanvas
      ├─ #dateSidebar     세로 날짜 사이드바 (52px, 다크 사선 스타일)
      │  └─ #dsList       .ds-item × N (세로 날짜 라벨, 클릭 → selectDate)
      └─ #studentSidebar  학생 사이드바 (200px, 폴더탭 스타일)
         ├─ .ss-header    "학생" 제목
         └─ #ssList       .ss-item × N (이름 + PDF 뱃지 + 호버 메뉴)
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
  attend: {},      // {학생명:{날짜:값}} — -1=특수/제외, 0=결석, 1=지각, 2=출석, 미선택=undefined
                   //   ★ 출결은 "실제 선택한 값"만 기준 (이행률로 추정/보정하지 않음). 판정은 js/domain.js

  // 현재 선택
  selDate: '', selStudent: '',

  // 과제 입력
  hwItems: [],        // 저번 주차 과제 항목 배열 (base + 이전extraHw + carry 병합)
  hwStatus: [],       // 각 과제 상태 ('' | '완료' | '부분완료' | '미완료')
  hwItemRefs: [],     // 각 항목 참조 [{ref, fromDate}] — base는 'lessonId-과제N', 추가과제는 'lessonId@x@텍스트' (parseHwRef로 통합 파싱)
  extraHw: [],        // 이번 주차 학생별 추가 과제 [{text}]
  hwDisabled: {},     // 이번 주차 과제 OFF 상태 {"학생||날짜": Set(과제 ref)} — 학생·날짜별 분리, ref 기반
                      //   엑셀 설정 시트(▼ 과제OFF)에 영속화. OFF 과제는 다음 주차 체크목록에서도 제외(js/domain.js: hwOffSet)
  journalNote: {},    // 수업 일지표 학생별 코멘트 {"학생||날짜":"코멘트"} — 엑셀 설정 시트(▼ 수업일지코멘트)에 영속화
  journalPlan: {},    // 수업 일지표 다음 수업 계획 {"날짜":"계획"} — 엑셀 설정 시트(▼ 수업일지계획)에 영속화
  hwRateManual: null, // null=엑셀 데이터 사용, 숫자=수동입력
  reportEdits: {},    // 리포트카드 contenteditable 직접편집 오버라이드 (키: 요소ID, 값: innerHTML)

  // 미니테스트
  totalQ: 5,

  // 토글 상태
  showMini: false, showComment: false, colorMode: false,

  // 마스코트 선택
  mascotChoices: {},   // (레거시) DB 호환용, 실사용 안 함
  selectedMascot: null, // {tier:'high'|'mid'|'low', idx:숫자} — 세션 내 고정 마스코트 (DB/엑셀 미저장)
  lastSaved: '',       // 마지막 엑셀 저장 날짜/시간 (설정 시트에 저장/복원)

  // 탭 임시 저장
  tabData: {},

  // 뷰 상태
  currentView: 'config',   // 'config' | 'date'
  dateTabOffset: 0,         // (레거시, 미사용) 날짜 탭 스크롤 오프셋

  // 기타
  excelFileName: '학습리포트_데이터.xlsx',
  attachedPdfBytes: null,
  pdfCanvases: [], pdfPageCount: 0, currentSpread: 0,
  studentPdfs: {},  // {학생명: [{bytes, name, canvases, pageCount, isPng}, ...]} — 학생별 PDF 첨부
  pendingPropagations: [],  // 이월 전파 보류 큐 [{student,date,ref,status}]
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
- 키: `'appData'`(lessons/students/rates/scores/corrects/wrong/hwRec/memos/attend/tabData/fileName/mascotChoices/hwDisabled/journalNote/journalPlan), `'session'`(selDate·selStudent·showMini·showComment·colorMode·currentView), `'studentPdfs'`(학생별 PDF bytes/name/pageCount/isPng)
- 참고: IndexedDB에 저장되는 키는 `fileName` (G.excelFileName 값을 저장)
- 참고: `appData`는 현재 백업용(쓰기 전용)이며 새로고침 시 자동 복원하지 않음 — 실질 영속화는 **엑셀 파일**. (architecture.md P5 참고)
