# UI 레이아웃 & 전역 상태

## 레이아웃 트리

```
body (flex, 100vh)
├─ .panel (좌, 370px)
│  ├─ .panel-head: #sbar(상태바) #excelInput(파일) #gDate(날짜)
│  ├─ #tabBar (학생 탭, 가로스크롤)
│  └─ .panel-body
│     ├─ #gPrevHw  저번주 과제
│     ├─ #gRate    이행률 입력
│     ├─ #gPrevProg / #gCurProg  진도
│     ├─ #gNextHw  이번주 과제
│     ├─ #gTeacher 강사명
│     ├─ #toggleMini + #gMini   미니테스트
│     ├─ #toggleComment + #gComment  코멘트
│     ├─ #btnSave #btnAttach #btnPdf
│     └─ #lastSaved
└─ .preview (우, flex:1)
   └─ #spreadRow
      ├─ #leftSlot
      │  ├─ #reportCard (A4 캡처 대상)
      │  │  ├─ .rc-header: 학생명·날짜·강사명
      │  │  ├─ #secRate   이행률 SVG
      │  │  ├─ #secPrevHw 저번주 과제
      │  │  ├─ 수업진도 (현재/이전)
      │  │  ├─ 이번주 과제
      │  │  ├─ #secMini   미니테스트
      │  │  └─ #secComment 코멘트
      │  └─ #leftPdfCanvas
      └─ #rightSlot > #rightPdfCanvas
```

---

## 전역 상태 객체 G

```js
G = {
  // 엑셀 파싱 결과 (loadExcel 후 채워짐)
  lessons: [],     // [{날짜,강사명,교재,단원,상세진도,과제1~5,전체문제수}]
  students: [],    // ['이름1', ...]

  // 학생별·날짜별 성적 데이터
  rates: {},       // {학생명: {날짜: 이행률%}}
  scores: {},      // {학생명: {날짜: 점수}} — 현재 미사용(hwRec 기준)
  corrects: {},    // {학생명: {날짜: 맞힌개수}}
  wrong: {},       // {학생명: {날짜: "오답번호문자열"}}
  hwRec: {},       // {"학생명||날짜": {이행률, 과제1_상태~5_상태}}

  // 현재 선택
  selDate: '',
  selStudent: '',

  // 과제 입력 (현재 학생 기준)
  hwItems: [],        // 이번주 과제 항목 문자열 배열
  hwStatus: [],       // 각 과제 상태 ('완료'|'부분완료'|'미완료'|'')
  hwRateManual: null, // null = 자동계산, 숫자 = 수동 고정

  // 미니테스트
  scoreCalc: null,
  totalQ: 5,          // 전체문제수 (엑셀에서 덮어씌워짐)

  // 토글 상태
  showMini: false,
  showComment: false,

  // 학생별 입력 스냅샷 (탭 전환 시 메모리 보존용)
  tabData: {},     // {학생명: {hwStatus, scoreCalc, correctInput, ...}}

  // 기타
  excelFileName: '학습리포트_데이터.xlsx',  // 로드 시 실제 파일명으로 덮어씌워짐
  attachedPdfBytes: null,
  pdfCanvases: [],
  pdfPageCount: 0,
  currentSpread: 0,
}
```

**런타임 주의:**
- `G.excelFileName`은 사용자가 파일을 로드하면 실제 파일명으로 바뀜 (기본값은 참고용)
- `G.tabData`는 IndexedDB에 저장되지 않는 임시 메모리 (새로고침 시 초기화)
- `G.totalQ`는 엑셀 `[전체문제수]` 행에서 날짜별로 덮어씌워짐

---

## IndexedDB

- DB: `reportApp4`, Store: `data`
- 키 `'appData'`: lessons, students, rates, corrects, wrong, hwRec, tabData, fileName
- 키 `'session'`: selDate, selStudent, showMini, showComment

---

## CDN 라이브러리

| 라이브러리 | 용도 |
|---|---|
| XLSX | 엑셀 읽기/쓰기 |
| html2canvas | HTML → 캔버스 (PDF 캡처용) |
| pdf-lib | PDF 생성·이미지 임베드 |
| pdf.js | 첨부 PDF 미리보기 렌더링 |
| Pretendard | 한글 웹폰트 |

> 버전 및 CDN URL은 `index.html` HEAD 참조.
