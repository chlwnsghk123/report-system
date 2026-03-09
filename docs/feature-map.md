# 기능별 파일 위치 지도

> 사용자의 자연어 요청에서 기능을 파악한 뒤 이 파일을 참조해 정확한 파일로 이동한다.

---

## 화면 구조 (index.html)

```
A 패널 (좌측)
├─ 상태바 / 엑셀 불러오기 버튼       → #sbar, #excelInput
├─ 수업일 드롭다운                   → #selDate
├─ 현재 진도 (접기/펼치기)           → #gCurProgHead, #curProgEdit
├─ 이번 주차 과제 (접기/펼치기)       → #gNextHwHead, #nextHwEdit
├─ 학생 탭바                        → #tabBar
├─ 저번 주차 과제 + 이행률 입력       → #gPrevHw, #hwEditor, #inputRate
├─ 미니 테스트 토글                  → #toggleMini → #gMini
│    └─ 맞힌 수/전체 + 오답 번호      → #inputCorrect, #inputTotal, #inputWrong
├─ 코멘트 토글                      → #toggleComment → #gComment
│    └─ 강사명 + 코멘트 텍스트        → #inputTeacher, #inputComment
└─ 버튼 3개                        → #btnSave, #btnAttach, #btnPdf

B 미리보기 (우측)
├─ 페이지 네비                      → #pageNav
└─ 리포트카드 #reportCard
     ├─ 헤더 (학생명/날짜)           → #rName, #rDate
     ├─ ① 이행률 + 그래프            → #secRate, #svgChart
     ├─ ② 저번 주차 과제 목록        → #secPrevHw, #rHwList
     ├─ ③ 수업 진도 (현재/이전)       → .prog-card
     ├─ ④ 이번 주차 과제 목록        → #rNoticeList
     ├─ ⑤ 미니 테스트 (선택)         → #secMini
     └─ ⑥ 코멘트 (선택)             → #secComment
```

---

## 기능 → 파일 상세 매핑

### 버튼·입력 위치 변경
| 기능 | HTML ID | 수정 파일 |
|---|---|---|
| 엑셀 불러오기 버튼 위치 | `#sbar` | `index.html` |
| 저장(엑셀) 버튼 | `#btnSave` | `index.html` |
| 시험자료 첨부 버튼 | `#btnAttach` | `index.html` |
| PDF 저장 버튼 | `#btnPdf` | `index.html` |
| 미니 테스트 토글 위치 | `#toggleMini` | `index.html` |
| 코멘트 토글 위치 | `#toggleComment` | `index.html` |
| 이행률 입력 위치 | `#inputRate` | `index.html` |

### 기능 동작 변경
| 기능 | 수정 파일 | 관련 함수 |
|---|---|---|
| 이행률 그래프 표시 방식 | `js/report.js` | `rebuildGraph()` |
| 과제 상태 버튼 순환 | `js/report.js` | `cycleHwStatus()` |
| 과제 에디터 렌더링 | `js/report.js` | `renderHwEditor()` |
| 이행률 자동계산 | `js/report.js` | `calcRateFromStatus()` |
| 점수 계산 공식 | `js/autofill.js` | `calcScore()` |
| 자동채우기 (날짜 기준) | `js/autofill.js` | `autoFillCommon()` |
| 자동채우기 (학생+날짜) | `js/autofill.js` | `autoFillAll()` |
| 탭 전환 | `js/ui.js` | `switchTab()` |
| 미니/코멘트 토글 | `js/ui.js` | `toggleSec()` |
| 진도 접기/펼치기 | `js/ui.js` | `toggleCurProg()`, `toggleNextHw()` |
| 엑셀 파싱 | `js/excel.js` | `parseWB()` |
| 엑셀 저장 | `js/excel.js` | `saveToExcel()` |
| PDF 저장 | `js/pdf.js` | `dlPdf()` |
| 시험자료 PDF 뷰어 | `js/pdf.js` | `loadAttachPdf()`, `renderSpread()` |
| 날짜 드롭다운 | `js/session.js` | `populateSels()`, `onDate()` |
| 앱 저장/복원 | `js/session.js` | `saveAppData()`, `restoreSession()` |

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
| "그래프 최근 6개로 늘려줘" | 그래프 로직 | `js/report.js` |
| "버튼 색 파란색으로 바꿔줘" | 버튼 CSS | `css/layout.css` |
| "리포트 주색상 파란색으로 바꿔줘" | :root 변수 | `css/report.css` |
| "점수 계산 방식 바꿔줘" | 점수 공식 | `js/autofill.js` |
| "엑셀 불러올 때 강사명 자동입력 안 되게 해줘" | 자동채우기 | `js/autofill.js` |
| "미니테스트 항목 기본으로 켜져 있게 해줘" | 토글 초기값 | `js/init.js` + `js/ui.js` |
| "탭 폰트 크게 해줘" | 탭 CSS | `css/layout.css` |
| "이행률 없으면 그래프 섹션 숨겨줘" | 조건부 표시 | `js/report.js` or `js/autofill.js` |
| "저장 시간 표시 없애줘" | HTML + JS | `index.html` + `js/excel.js` |
