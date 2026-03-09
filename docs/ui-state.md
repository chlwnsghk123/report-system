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
  hwItems: [],        // 이번주 과제 항목
  hwStatus: [],       // 각 과제 상태
  hwRateManual: null, // null=자동계산

  // 미니테스트
  scoreCalc: null, totalQ: 5,

  // 토글
  showMini: false, showComment: false,

  // 탭 임시 저장
  tabData: {},     // {학생명:{hwStatus,scoreCalc,...}}

  // 기타
  excelFileName: '학습리포트_정리본.xlsx',
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
| Pretendard | 1.3.9 | 한글 웹폰트 |

## IndexedDB
- DB: `reportApp4`, Store: `data`
- 키: `'appData'`(전체 G), `'session'`(날짜·학생·토글)
