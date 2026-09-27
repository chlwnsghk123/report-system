# UI 레이아웃 & 전역 상태

## 레이아웃 트리

```
body (flex, 100vh)
├─ .panel (좌, 400px, 드래그 리사이즈 가능 280~700px)
│  ├─ .panel-head (흰색 배경, 하단 보더)
│  │  ├─ .panel-brand (제목 + 마지막 저장 시간 + ⚠ 미저장 표시 #unsavedInline)
│  │  ├─ #sbar          상태바 / 엑셀 불러오기 (클릭 → triggerLoad) + #btnExcelRemove(−)
│  │  ├─ #excelInput    파일 선택 input (hidden)
│  │  ├─ #recoverBanner 지난 작업 이어하기 배너 (IndexedDB 자동 백업, #recoverInfo · 이어하기/닫기)
│  │  └─ #btnZeroStart  직접 시작하기
│  └─ .panel-body
│     └─ #viewDate      날짜별 학생기록 뷰
│        ├─ #dateSummary     수업정보 읽기전용 요약 (.date-summary, 카드형)
│        ├─ .panel-section "과제 & 이행률"
│        │  ├─ .panel-card > #gPrevHw  지난 수업 과제 검사 + 이행률
│        │  │  ├─ .hw-all-done  ✓ 모두 완료 (markAllHwDone)
│        │  │  ├─ #hwEditor    과제 에디터 (.hw-item[data-i] + 상태 버튼)
│        │  │  └─ .rate-input-row > #inputRate(자동 계산·직접 입력 0~100) · #hwCounts(완료/부분/미완료 개수) · ↻ 재계산
│        │  └─ .panel-card > #gCurHw   다음 수업까지 과제 (ON/OFF) + 추가 과제 입력
│        └─ .panel-section "선택 항목"
│           ├─ #toggleMini      미니 테스트 토글
│           ├─ #gMini > .panel-card  #miniTotal(문항 수)·#miniRange(범위) — 날짜 공통 / #inputWrong(오답)·#miniCorrect(맞힌 수) — 학생별
│           ├─ #toggleComment   선생님 한마디 토글
│           └─ #gComment > .panel-card  #inputComment(학생별 코멘트) · #inputTeacher(서명)
├─ .panel-resize (#panelResize)  드래그 리사이즈 핸들
└─ .preview (우, flex:1)
   ├─ .toolbar          상단 도구 모음
   │  ├─ #btnImg        🖼 이미지 (카톡용 JPG 저장, dlReportImage)
   │  ├─ #btnPdf        PDF 내보내기 버튼
   │  ├─ #btnSave       저장 버튼
   │  ├─ #tbMenu        ☰ 메뉴 (학생 관리 / 리포트 모아보기: 수업 일지표·이행률 요약표 / 카톡용 이미지 일괄 ZIP / 일괄 PDF)
   │  └─ #tbSettings    ⚙ 설정 (수업 진도 설정 / 컬러·흑백 모드 / 업데이트 확인)
   └─ .preview-body (flex row)
      ├─ .preview-content (flex:1)
      │  ├─ #dateNavBar     상단 날짜 네비게이션 (‹ 날짜 › + 클릭 드롭다운 + 날짜 추가)
      │  ├─ #attendBar      출결 세그먼트 #attendToggle(출석/지각/결석) + 전원 출석 버튼 + #attendUnset(미체크 N명)
      │  ├─ #spreadRow
      │  │  ├─ #leftSlot
      │  │  │  ├─ #reportCard  A4 캡처 대상 (.dense/.dense2: A4 넘칠 때 자동 맞춤)
      │  │  │  │  ├─ #secRate      숙제 이행률 + 그래프 + 마스코트 (.absent → '이번 수업 결석' 표시, 마스코트 숨김)
      │  │  │  │  ├─ #secPrevHw    지난 수업 과제 (#rHwList)
      │  │  │  │  ├─ .sec          수업 진도 (오늘 배운 내용 / 지난 수업 내용)
      │  │  │  │  ├─ .sec          다음 수업까지 과제 (#rNoticeList, 없으면 '별도 과제 없음')
      │  │  │  │  ├─ #secMini      미니 테스트 (#rMiniScore 점수 · #rMiniRange 범위 · #rWrongTags 다시 볼 문제) — 기록 있을 때만
      │  │  │  │  └─ #secComment   선생님 한마디 (#commentBody · #commentSign) — 코멘트 있을 때만
      │  │  │  ├─ #leftPdfCanvas
      │  │  │  └─ #pdfAddInline  PDF 첨부 버튼 (+, 리포트카드 바로 오른쪽)
      │  │  └─ #rightSlot > #rightPdfCanvas  첨부 시험자료 1장
      │  ├─ #zoomCtrl       확대/축소
      │  └─ #stuNavGroup    학생 전환 화살표
      └─ #studentSidebar  학생 사이드바 (폴더탭 스타일, 우클릭: 요약표·PDF 첨부·캐릭터·이름 변경)
         └─ #ssList       .ss-item[data-student] × N
```

## 전역 상태 객체 G

```js
G = {
  // 엑셀 파싱 결과
  lessons: [],     // [{id,날짜,교재,단원,상세진도,과제1~N}]
  students: [],    // ['이름1',...]

  // 학생별·날짜별
  rates: {},       // {학생명:{날짜:이행률%}}
  wrong: {},       // {학생명:{날짜:"오답번호문자열"}} — 입력 즉시 저장 (onWrongInput)
  hwRec: {},       // {"학생명||날짜":{이행률,과제1_상태~N_상태,items:[{text,status,ref,fromDate}],extraHw:[{text}]}}
  memos: {},       // {"학생명||날짜":"비고 텍스트"} — 리포트 미반영, 엑셀 비고 열 저장용
  attend: {},      // {학생명:{날짜:값}} — 2=출석, 1=지각, 0=결석, 미선택=키 없음
                   //   ★ 출결은 "실제 선택한 값"만 기준. 판정은 js/domain.js (구버전 -1은 미선택 취급)

  // 현재 선택
  selDate: '', selStudent: '',

  // 과제 입력 (현재 학생)
  hwItems: [],        // 지난 수업 과제 항목 배열 (base + 이전extraHw + carry 병합)
  hwStatus: [],       // 각 과제 상태 (2=완료, 1=부분완료, 0=미완료, -1=없음)
  hwItemRefs: [],     // 각 항목 참조 [{ref, fromDate}] — base는 'lessonId-과제N', 추가과제는 'lessonId@x@텍스트'
  extraHw: [],        // 이번 회차 학생별 추가 과제 [{text}]
  hwRateManual: null, // null=자동 계산/엑셀 값, 숫자=선생님이 직접 입력
  hwDisabled: {},     // 이번 주차 과제 OFF {"학생||날짜": Set(과제 ref)} — 설정 시트(▼ 과제OFF)
  pendingPropagations: [],  // 이월 전파 보류 큐 [{student,date,ref,status}]

  // 선생님 기록
  journalNote: {},    // 선생님 코멘트 {"학생||날짜":"코멘트"} — 리포트 '선생님 한마디' + 수업 일지표 공용 (▼ 수업일지코멘트)
  journalPlan: {},    // 수업 일지표 다음 수업 계획 {"날짜":"계획"} (▼ 수업일지계획)
  journalInfo: {},    // 수업 일지표 진도·과제 편집값 {"날짜":{book?,chapter?,detail?,hwText?}} — 수업 정보와 다른 항목만 (▼ 수업일지진도)
  miniTest: {},       // 미니 테스트 정보 {"날짜":{total,range}} — 반 공통 (▼ 미니테스트)
  miniScore: {},      // 직접 입력한 맞힌 수 {"학생||날짜":숫자} (▼ 미니테스트점수)
  teacherName: '',    // 코멘트 서명 (▼ 강사)

  // 보기 설정 — 엑셀 설정 시트(▼ 보기설정)에 저장
  showMini: false, showComment: false, colorMode: false,

  // 마스코트
  mascotChoices: {},   // {학생명:{high|mid|low:이미지 idx}} (▼ 스티커)
  lastSaved: '',       // 마지막 엑셀 저장 날짜/시간 (▼ 마지막저장)

  // 세션 상태
  tabData: {},             // 현재 날짜의 학생별 작업 캐시 {학생:{hwStatus,hwItems,hwItemRefs,extraHw,rateManual}}
  currentView: 'config',   // 'config' | 'date'
  unsaved: false,          // 엑셀에 저장되지 않은 변경 여부
  excelFileName: '학습리포트_데이터.xlsx',
  pdfCanvases: [],         // 현재 학생 첨부 캔버스 (studentPdfs에서 동기화)
  studentPdfs: {},         // {학생명: [{bytes, name, canvases, pageCount, isPng}]} — 세션 한정 (저장 안 함)
}

// 저장·백업·복구 대상 필드 목록 (state.js)
DATA_KEYS = ['lessons','students','rates','wrong','hwRec','memos','attend','mascotChoices','hwDisabled',
  'journalNote','journalPlan','journalInfo','miniTest','miniScore','teacherName','showMini','showComment','colorMode','lastSaved']
```

## CDN 라이브러리

| 라이브러리 | 버전 | 용도 |
|---|---|---|
| XLSX | 0.18.5 | 엑셀 읽기/쓰기 |
| html2canvas | latest | HTML→캔버스 (PDF·이미지용) |
| pdf-lib | 1.17.1 | PDF 생성·이미지 임베드 |
| pdf.js | 3.11.174 | 첨부 PDF 미리보기 |
| JSZip | 3.10.1 | 카톡용 이미지 일괄 저장(ZIP) |

## IndexedDB (자동 백업)
- DB: `reportApp4`, Store: `data`
- 키 `'appData'`: `DATA_KEYS` 전체 + `fileName`·`savedAt`·`unsaved`·`pendingPropagations`·`selDate`·`selStudent` 스냅샷.
  편집할 때마다 300ms 디바운스로 저장(`saveAppData`/`saveSession`), 엑셀 저장 직후 즉시 갱신(`saveAppDataNow`).
- 시작 시 `checkRecovery()`가 스냅샷을 찾아 **지난 작업 이어하기** 배너를 띄움 — 자동으로 복원하지는 않고, 사용자가 누르면 `restoreFromBackup()`.
- 실질 영속화는 여전히 **엑셀 파일**. IndexedDB를 쓸 수 없는 환경에서도 앱은 동작(백업만 비활성).
- `'studentPdfs'`는 구버전 잔재 — 시작 시 정리(null)만 함. 첨부 PDF는 세션 한정.
