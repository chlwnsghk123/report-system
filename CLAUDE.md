# CLAUDE.md

## 프로젝트 개요
- 순수 프론트엔드 앱 — **반드시 `start.bat` 실행 후 http://localhost:8000 에서 열 것**
- CDN 전용 (빌드도구·npm 금지), 데이터저장: IndexedDB
- **A(좌)**: `.panel` — 입력 패널 | **B(우)**: `.preview` — `#reportCard` PDF 미리보기

## 파일 구조
```
index.html          HTML 구조만 (스타일·JS 없음)
css/
  layout.css        패널·탭·인풋·버튼·페이지네비 등 앱 UI 스타일
  report.css        리포트카드 A4 스타일 (:root 변수 포함)
js/
  state.js          G 객체, 상수(DB/STORE), $$ 헬퍼
  utils.js          getCurL/getPrevL/getNextL, setAuto, setBar, shortD, fmtKo, esc
  db.js             openDB, dbSet, dbGet
  excel.js          triggerLoad, loadExcel, toDS, parseWB, saveToExcel
  ui.js             updateScale, initCE, fp, renderTabs, switchTab, saveTabData, restoreTabData, toggleSec, toggleCurProg, toggleNextHw
  session.js        saveAppData, saveSession, restoreSession, populateSels, showGroups, onDate
  autofill.js       calcScore, autoFillCommon, autoFillAll
  report.js         rebuildGraph, renderHwEditor, onRateManual, calcRateFromStatus, cycleHwStatus, hwBtnLabel, updateHeaderDate, updateHwDisplay, updateHwBadge, updateNoticeList, updateCommentSign, updateWrongTags, updateCurProgSummary, updateNextHwSummary
  pdf.js            loadAttachPdf, renderSpread, drawPdfPrev, prevSpread, nextSpread, dlPdf, dataUrlToBytes
  init.js           window.onload (앱 진입점)
docs/               참조 문서 (필요 시만 읽기)
```

---

## 요청 해석 방법 — 자연어 → 파일 라우팅

**사용자는 파일명을 말하지 않는다.** 요청을 받으면 아래 표로 관련 파일을 먼저 판단한 후 해당 파일만 읽고 수정한다.

### 위치·순서·배치 변경
| 사용자가 말하는 것 | 읽을 파일 |
|---|---|
| "~버튼 위치", "~안으로 넣어", "~위에 추가", "~순서 바꿔" | `index.html` |
| "탭 순서", "학생 탭" | `index.html` + `js/ui.js` |

### 스타일·디자인 변경
| 사용자가 말하는 것 | 읽을 파일 |
|---|---|
| 패널·버튼·탭·인풋 색상/크기/폰트 | `css/layout.css` |
| 리포트카드 안 요소 색상/크기/여백 | `css/report.css` |
| "주색상 바꿔", "--main-color" | `css/report.css` |

### 기능·동작 변경
| 사용자가 말하는 것 | 읽을 파일 |
|---|---|
| "그래프", "이행률 차트", "꺾은선" | `js/report.js` |
| "과제 버튼", "완료/부분완료/미완료", "순환" | `js/report.js` |
| "점수 계산", "맞힌 수", "오답 태그" | `js/autofill.js` + `js/report.js` |
| "미니 테스트" 표시/숨김, 토글 | `js/ui.js` + `index.html` |
| "코멘트" 표시/숨김, 토글 | `js/ui.js` + `index.html` |
| "탭 전환", "학생 선택" 동작 | `js/ui.js` |
| "날짜 바꾸면 자동으로~", "자동채우기" | `js/autofill.js` |
| "이전 과제 불러오기", "hwRec" | `js/autofill.js` + `js/excel.js` |
| "엑셀 파싱", "엑셀 불러올 때", "시트" | `js/excel.js` |
| "엑셀 저장", "저장 버튼" 동작 | `js/excel.js` |
| "PDF 저장", "PDF 생성", "합성" | `js/pdf.js` |
| "시험자료 첨부", "PDF 뷰어" | `js/pdf.js` + `index.html` |
| "IndexedDB", "새로고침 후 복원" | `js/session.js` |
| "날짜 선택 드롭다운" | `js/session.js` |

### 데이터·상태 변경
| 사용자가 말하는 것 | 읽을 파일 |
|---|---|
| 새 전역 변수/데이터 추가 | `js/state.js` + `js/session.js` |
| 날짜 형식, 유틸 함수 | `js/utils.js` |

---

## 작업 순서 (매 요청 시 따를 것)
1. 위 라우팅 표에서 관련 파일 파악 (최대 2개)
2. 해당 파일 읽기
3. 수정
4. 아래 동기화 표에 따라 docs 갱신

## 파일 수정 후 필수 동기화
| 수정 내용 | 갱신할 파일 |
|---|---|
| 함수 추가/삭제/이름 변경 | `docs/functions.md` |
| 데이터 흐름 변경 | `docs/data-flows.md` |
| G 객체 필드 추가/삭제 | `docs/ui-state.md` |
| 엑셀 시트 구조 변경 | `docs/excel-schema.md` |
| js/ 파일 추가/삭제 | `CLAUDE.md` 파일구조 + `index.html` script 태그 |

---

## 코드 수정 원칙
1. 최소 변경 — 요청 부분만, 주변 코드 건드리지 않음
2. 서버 코드 추가 금지
3. 라이브러리 추가 시 CDN 링크만 (index.html HEAD에 추가)
4. 한국어 유지 (UI 텍스트, 주석)
5. 엑셀 시트 구조 임의 변경 금지

## 용어
- **없음 상태**: A 패널엔 유지, B 리포트에서만 숨김
- **완료버튼 순환**: 없음 → ✓완료 → ◑부분완료 → ✗미완료 → 없음

## 커뮤니케이션
- 한국어로 응답
- 코드 변경 시 무엇을 왜 바꿨는지 한 줄 설명
- 불명확한 요청은 먼저 질문

---

## 참조 문서 (필요 시만 읽기)
| 작업 유형 | 읽을 파일 |
|---|---|
| UI 기능 → 파일 상세 매핑 | `docs/feature-map.md` |
| UI 구조·상태 객체 G | `docs/ui-state.md` |
| 함수 목록·역할 | `docs/functions.md` |
| 엑셀파싱·DB·PDF 흐름 | `docs/data-flows.md` |
| 엑셀 시트 구조 | `docs/excel-schema.md` |
