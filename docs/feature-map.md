# 기능별 파일 위치 지도

> 사용자의 자연어 요청에서 기능을 파악한 뒤 이 파일을 참조해 정확한 파일로 이동한다.

---

## 화면 구조 (index.html)

```
A 패널 (좌측)
[panel-head]
├─ 상태바 / 엑셀 불러오기            → #sbar, #excelInput
├─ 파일 저장 버튼 (로드 후 표시)      → #btnSave
[viewTabs]
├─ ⚙ 수업설정 탭 (클릭 → 모달)     → .vt-item[config]
├─ 날짜 탭 영역 (◀ 날짜들 ▶)       → .vt-date-nav, #vtDates
[tabBar]
└─ 학생 탭바 (날짜 뷰에서만)        → #tabBar

[panel-body > viewDate]
├─ 수업 정보 읽기전용 요약           → #dateSummary
├─ 저번 주차 과제 + 이행률 입력       → #gPrevHw, #hwEditor, #inputRate
│    └─ base 과제 + 이월 과제 (캐리오버 뱃지)
├─ 미니 테스트 토글                  → #toggleMini → #gMini
│    └─ 오답 번호 + 시험자료 첨부     → #inputWrong, #btnAttach (#pdfInput)
├─ 코멘트 토글                      → #toggleComment → #gComment
│    └─ 강사명 + 코멘트 텍스트        → #inputTeacher, #inputComment
└─ PDF 저장 버튼 + 저장시각          → #btnPdf, #lastSaved
hidden: #inCurBook/Chap/Detail, #inPrevBook/Chap/Detail, #inputNotice, #inputCorrect/#inputTotal

수업설정 전체화면 모달 (#lessonModalOverlay)
├─ 학생 관리 (접기/펼치기)           → #studentSummary, #studentListEdit
└─ 수업 날짜별 레슨 카드             → #lessonCards
     └─ .lesson-card × N (교재/단원/상세진도/과제 동적 추가·삭제)
        └─ 날짜 상태: .lc-past(과거 회색) / .lc-next(다음 파란 강조)

B 미리보기 (우측)
├─ 페이지 네비                      → #pageNav
└─ 리포트카드 #reportCard
     ├─ 헤더 (학생명/날짜)           → #rName, #rDate
     ├─ ① 이행률 + 그래프 + 마스코트  → #secRate, #svgChart, #gLabels, #rateMascot
     ├─ ② 저번 주차 과제 목록        → #secPrevHw, #rHwList (캐리오버: (전) 마크)
     ├─ ③ 수업 진도 (현재/이전)       → .prog-card
     ├─ ④ 이번 주차 과제 목록        → #rNoticeList (미완료 캐리오버 자동 추가)
     ├─ ⑤ 미니 테스트 (선택)         → #secMini, #rWrongTags
     └─ ⑥ 코멘트 (선택)             → #secComment, #commentBody, #commentSign
```

---

## 기능 → 파일 상세 매핑

### 버튼·입력 위치 변경
| 기능 | HTML ID | 위치 | 수정 파일 |
|---|---|---|---|
| 엑셀 불러오기 버튼 | `#sbar` | panel-head | `index.html` |
| 저장(엑셀) 버튼 | `#btnSave` | panel-head | `index.html` |
| 시험자료 첨부 버튼 | `#btnAttach` | `#gMini` 안 | `index.html` |
| PDF 저장 버튼 | `#btnPdf` | panel-body 하단 | `index.html` |
| 미니 테스트 토글 | `#toggleMini` | panel-body | `index.html` |
| 코멘트 토글 | `#toggleComment` | panel-body | `index.html` |
| 이행률 입력 | `#inputRate` | `#gPrevHw` 안 | `index.html` |
| 오답 번호 입력 | `#inputWrong` | `#gMini` 안 | `index.html` |

### 기능 동작 변경
| 기능 | 수정 파일 | 관련 함수 |
|---|---|---|
| 이행률 그래프 표시 방식 | `js/report.js` | `rebuildGraph()` |
| 마스코트 이미지 (이행률 티어별) | `js/report.js` | `updateRateFace()`, `registerMascots()` |
| 과제 상태 버튼 순환 | `js/report.js` | `cycleHwStatus()` |
| 과제 에디터 렌더링 | `js/report.js` | `renderHwEditor()` (캐리오버 뱃지 포함) |
| 점수 계산 공식 | `js/autofill.js` | `autoFillCommon()` 내 점수 로직 |
| 자동채우기 (날짜 기준) | `js/autofill.js` | `autoFillCommon()` |
| 자동채우기 (학생+날짜) | `js/autofill.js` | `autoFillAll()` (base + 캐리오버 병합) |
| 캐리오버 계산 | `js/autofill.js` | `computeCarryover()` |
| 이번 과제 + 캐리오버 반영 | `js/autofill.js` | `updateNoticeWithCarry()` |
| 탭 전환 | `js/ui.js` | `switchTab()` |
| 미니/코멘트 토글 | `js/ui.js` | `toggleSec()` |
| 수업설정 모달 | `js/ui.js` | `openLessonModal()`, `closeLessonModal()` |
| 수업 카드 렌더링 | `js/ui.js` | `renderLessonCards()` (날짜 상태 분류 포함) |
| 수업 날짜 변경 | `js/ui.js` | `updateLessonDate()` (hwRec/rates/wrong/memos 키 이동) |
| 과제 동적 추가/삭제 | `js/ui.js` | `addLessonHw()`, `removeLessonHw()` |
| hwRec items 동기화 | `js/ui.js` | `syncHwRecItems()` |
| 엑셀 파싱 | `js/excel.js` | `parseWB()` (이월과제 시트 + 동적 과제열) |
| 엑셀 저장 | `js/excel.js` | `saveToExcel()` (이월과제 시트 + 비고열 + 마지막 저장 시각) |
| 마지막 저장 표시 | `js/excel.js` | `updateLastSavedDisplay()` → #rLastSaved |
| PDF 저장 | `js/pdf.js` | `dlPdf()` |
| 일괄 PDF 내보내기 | `js/pdf.js` | `dlBatchPdf()`, `_doBatchPdf()` |
| 성적 요약표 | `js/pdf.js` | `dlGradeSummary()`, `_renderGradeTable()`, `_downloadGradeImage()` |
| 수업 일지 이미지 | `js/pdf.js` | `dlClassJournal()`, `_downloadJournalImage()` |
| 업데이트 내역 모달 | `js/pdf.js` | `showUpdateModal()` (updates.md 로드) |
| 시험자료 PDF 뷰어 | `js/pdf.js` | `loadAttachPdf()`, `renderSpread()` |
| 마스코트 이미지 로드 | `js/init.js` | `loadMascotImages()` |
| 날짜 자동 선택 | `js/session.js` | `autoSelectDate()` |
| 앱 저장/복원 | `js/session.js` | `saveAppData()`, `saveAppDataNow()`, `restoreSession()` |

### 스타일 수정
| 수정 대상 | 수정 파일 |
|---|---|
| 패널, 탭바, 인풋, 버튼, 상태바 | `css/layout.css` |
| 리포트카드 헤더, 섹션, 이행률, 과제, 진도, 미니테스트, 코멘트 | `css/report.css` |
| 주색상 (--main-color) | `css/report.css` `:root` 블록 |

---

## 자연어 요청 예시 해석

| 요청 예시 | 해석 | 읽을 파일 |
|---|---|---|
| "시험자료 첨부 버튼을 미니 테스트 안으로 넣어줘" | HTML 위치 이동 | `index.html` |
| "그래프 최근 4개에서 늘려줘" | 그래프 로직 | `js/report.js` |
| "버튼 색 파란색으로 바꿔줘" | 버튼 CSS | `css/layout.css` |
| "리포트 주색상 파란색으로 바꿔줘" | :root 변수 | `css/report.css` |
| "점수 계산 방식 바꿔줘" | 점수 공식 | `js/autofill.js` |
| "엑셀 불러올 때 강사명 자동입력 안 되게 해줘" | 자동채우기 | `js/autofill.js` |
| "미니테스트 항목 기본으로 켜져 있게 해줘" | 토글 초기값 | `js/init.js` + `js/ui.js` |
| "탭 폰트 크게 해줘" | 탭 CSS | `css/layout.css` |
| "이행률 없으면 그래프 섹션 숨겨줘" | 조건부 표시 | `js/report.js` or `js/autofill.js` |
| "저장 시간 표시 없애줘" | HTML + JS | `index.html` + `js/excel.js` |
| "마스코트 이미지 바꿔줘" | 이미지 파일 교체 | `img/mascots/` |
