# UI 레이아웃 & 전역 상태

## 레이아웃 트리

```
body (flex, 100vh)
├─ .panel (좌, 370px)
│  ├─ .panel-head
│  │  ├─ #sbar          상태바 / 엑셀 불러오기 (클릭 → triggerLoad)
│  │  ├─ #btnSave       파일 저장 버튼 (로드 후 표시)
│  │  ├─ #excelInput    파일 선택 input (hidden)
│  │  ├─ #gDate         수업일 드롭다운 (#selDate)
│  │  ├─ #gCurProgHead  현재 진도 (접기/펼치기 헤더)
│  │  │  ├─ #curProgSummary  접힌 상태 요약 (교재·단원)
│  │  │  └─ #curProgEdit     펼쳐진 입력: #inCurBook, #inCurChap, #inCurDetail
│  │  ├─ #gNextHwHead   이번 주차 과제 (접기/펼치기 헤더)
│  │  │  ├─ #nextHwSummary   접힌 상태 요약 (N개 과제)
│  │  │  └─ #nextHwEdit      펼쳐진 입력: #inputNotice (textarea)
│  │  └─ hidden inputs
│  │     ├─ #inPrevBook, #inPrevChap, #inPrevDetail  (이전 진도, type=hidden)
│  │     ├─ #inputCorrect, #inputTotal               (미니테스트 수, display:none)
│  │     └─ #calcResult                              (계산결과, display:none)
│  ├─ #tabBar           학생 탭바 (가로스크롤, 로드 후 표시)
│  └─ .panel-body
│     ├─ #sdMain        섹션 구분바 "과제 & 진도"
│     ├─ #gPrevHw       저번 주차 과제 + 이행률
│     │   ├─ #hwEditor      과제 에디터 (항목 + 상태 버튼)
│     │   └─ #inputRate     이행률 수동 입력 (0~100)
│     ├─ #sdOpt         섹션 구분바 "선택 항목"
│     ├─ #toggleMini    미니 테스트 토글 스위치
│     ├─ #gMini         미니 테스트 입력 영역
│     │   ├─ #inputWrong    오답 번호 텍스트
│     │   └─ #btnAttach     시험자료 PDF 첨부 버튼 (#pdfInput hidden)
│     ├─ #toggleComment 코멘트 토글 스위치
│     ├─ #gComment      코멘트 입력 영역
│     │   ├─ #inputTeacher  강사명
│     │   └─ #inputComment  코멘트 텍스트 (textarea)
│     ├─ #btnPdf        PDF 저장 버튼
│     └─ #lastSaved     저장 시각 표시
└─ .preview (우, flex:1)
   ├─ #pageNav          페이지 네비 (‹ · 페이지 정보 · ›)
   └─ #spreadRow
      ├─ #leftSlot
      │  ├─ #reportCard     A4 캡처 대상
      │  │  ├─ .rc-header   학생명 (#rName) · 날짜 (#rDate)
      │  │  ├─ #secRate     ① 이행률 + SVG 꺾은선 그래프 (#svgChart, #gLabels)
      │  │  ├─ #secPrevHw  ② 저번 주차 과제 목록 (#rHwList)
      │  │  ├─ (수업 진도)  ③ 현재/이전 진도 (.prog-card)
      │  │  ├─ (이번 과제)  ④ #rNoticeList
      │  │  ├─ #secMini    ⑤ 미니 테스트 (선택, 기본 숨김)
      │  │  └─ #secComment ⑥ 코멘트 (선택, 기본 숨김)
      │  └─ #leftPdfCanvas  PDF 페이지 캔버스
      └─ #rightSlot > #rightPdfCanvas
```

## 전역 상태 객체 G

```js
G = {
  // 엑셀 파싱 결과
  lessons: [],     // [{날짜,강사명,교재,단원,상세진도,과제1~5,전체문제수}]
  students: [],    // ['이름1',...]

  // 학생별·날짜별
  rates: {},       // {학생명:{날짜:이행률%}}
  scores: {},      // {학생명:{날짜:점수}}
  corrects: {},    // {학생명:{날짜:맞힌개수}}
  wrong: {},       // {학생명:{날짜:"오답번호문자열"}}
  hwRec: {},       // {"학생명||날짜":{이행률,과제1_상태~5_상태}}

  // 현재 선택
  selDate: '', selStudent: '',

  // 과제 입력
  hwItems: [],        // 이전 수업 과제 항목 문자열 배열
  hwStatus: [],       // 각 과제 상태 ('' | '완료' | '부분완료' | '미완료')
  hwRateManual: null, // null=엑셀 데이터 사용, 숫자=수동입력 (자동계산 없음)

  // 미니테스트
  scoreCalc: null, totalQ: 5,

  // 토글 상태
  showMini: false, showComment: false,

  // 탭 임시 저장 (학생 전환 시 현재 입력값 보존)
  tabData: {},     // {학생명:{hwStatus,scoreCalc,correctInput,totalInput,wrongInput,rateManual,comment}}

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
- 키: `'appData'`(G.lessons/students/rates/scores/corrects/wrong/hwRec/tabData/excelFileName), `'session'`(selDate·selStudent·showMini·showComment)
