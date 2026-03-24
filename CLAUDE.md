# CLAUDE.md

## AI 에이전트 작업 프로토콜
사용자의 코드 수정 요청을 처리할 때, 코드 변경 후 문서 동기화와 Git 워크플로우가 누락되는 것을 방지하기 위해 다음 2가지 규칙을 준수한다.
1. 기본적으로 매 답변마다 문서 최하단에 정의된 **[표준 작업 체크리스트]**를 복사하여, 각 단계를 수행한 후 `[x]` 표시와 함께 출력해야 한다.
2. **빠른 작업 모드(/fast)**: 사용자가 프롬프트에 `/fast` 키워드를 포함한 경우, 체크리스트 출력 및 후행 문서 동기화, Git 워크플로우를 모두 생략하고 즉각적인 코드 수정에만 집중한다.

## 프로젝트 개요
- 순수 프론트엔드 앱 — **반드시 `start.bat` 실행 후 http://localhost:8000 에서 열 것**
- CDN 전용 (빌드도구·npm 금지), 데이터저장: IndexedDB
- **A(좌)**: `.panel` — 입력 패널 | **B(우)**: `.preview` — `#reportCard` PDF 미리보기

## 파일 구조
```
index.html          HTML 구조만 (스타일·JS 없음)
css/
  layout.css        패널·탭·인풋·버튼·페이지네비·뷰탭·수업카드·날짜요약 등 앱 UI 스타일
  report.css        리포트카드 A4 스타일 (:root 변수 포함)
js/
  state.js          G 객체, 상수(DB/STORE), $$ 헬퍼
  utils.js          getCurL/getPrevL/getNextL, setAuto, rmAuto, setBar, shortD, fmtKo, esc
  db.js             openDB, dbSet, dbGet
  excel.js          triggerLoad, loadExcel, toDS, normalizeRate, stFromExcel, stToExcel, parseWB, saveToExcel, createTemplate
  ui.js             updateScale, initCE, fp, switchView, openLessonModal, closeLessonModal, renderViewTabs, shiftDate, selectDate, getLessonHwKeys, renderLessonCards, updateLessonField, syncLessonToReport, addLessonHw, removeLessonHw, addLesson, removeLesson, renderDateSummary, renderTabs, switchTab, saveTabData, syncHwRecItems, restoreTabData, _getCarryAutoText, openMemo, closeMemo, saveMemo, updateMemoBtn, _openModal, _closeModal, _showModalToast, toggleSec
  session.js        saveAppData, saveAppDataNow, saveSession, restoreSession, showGroups, autoSelectDate, renderStudentList, addStudent, removeStudent, toggleStudentSec
  autofill.js       computeCarryover, updateNoticeWithCarry, autoFillCommon, stFromExcel, autoFillAll
  report.js         rebuildGraph, renderHwEditor, addExtraHw, removeExtraHw, updateExtraHwText, onRateManual, cycleHwStatus, hwBtnLabel, updateHeaderDate, updateHwDisplay, updateHwBadge, updateNoticeList, updateCommentSign, updateWrongTags, registerMascots, updateRateFace, openMascotPicker, applyReportEdits, initReportListeners
  pdf.js            loadAttachPdf, renderSpread, drawPdfPrev, prevSpread, nextSpread, dlPdf, toggleToolbarMenu, closeToolbarMenus, dlSummaryPdf, _doSummaryImage, showConfirmModal, dataUrlToBytes, dlBatchPdf, _doBatchPdf, dlGradeSummary, _renderGradeTable, _downloadGradeImage, dlClassJournal, _downloadJournalImage
  init.js           window.onload (앱 진입점), loadMascotImages
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
| "이월과제", "캐리오버", "미완료 넘김" | `js/autofill.js` + `js/excel.js` |
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

## 작업 순서 (매 요청 시 반드시 따를 것)
1. 사용자의 요청에 `/fast` 키워드가 있는지 확인한다.
2. `/fast`가 있다면 부연 설명 없이 즉시 해당 파일을 찾아 코드를 수정하고 답변을 종료한다.
3. `/fast`가 없다면, 즉시 하단의 **[표준 작업 체크리스트]** 포맷을 출력하고, 1~4단계를 순차적으로 실행하며 빈틈없이 작업을 완수한다. (작업 전 불필요한 계획 브리핑 생략)

## 파일 수정 후 필수 동기화 (절대 생략 금지)
**코드를 수정하면 반드시 아래 표를 확인하고 해당하는 docs 파일을 같은 커밋에 포함시킨다.**
커밋 전에 이 체크리스트를 검토하지 않으면 안 된다.

| 수정 내용 | 갱신할 파일 | 체크 |
|---|---|---|
| 함수 추가/삭제/이름 변경 | `docs/functions.md` | 반드시 |
| 데이터 흐름 변경 | `docs/data-flows.md` | 반드시 |
| G 객체 필드 추가/삭제 | `docs/ui-state.md` | 반드시 |
| 엑셀 시트 구조 변경 | `docs/excel-schema.md` | 반드시 |
| js/ 파일 추가/삭제 | `CLAUDE.md` 파일구조 + `index.html` script 태그 | 반드시 |
| CSS 클래스 추가 (리포트카드) | `docs/ui-state.md` 레이아웃 트리 | 해당 시 |
| **모든 코드 변경** | `updates.md` 업데이트 내역 추가 | **반드시** |

## 업데이트 내역 관리 (절대 생략 금지)
- 파일: `updates.md` (프로젝트 루트)
- **모든 코드 변경 시** 반드시 새 버전 항목을 `updates.md` 최상단에 추가
- 버전 형식: `v1.XX` (0.01씩 증가, 현재 최신: v1.11)
- 항목 형식: `## v1.XX (YYYY-MM-DD)` + `- 변경 내용` 목록
- 최근 10개 버전만 유지 (오래된 것은 삭제)
- `index.html`의 업데이트 확인 버튼 텍스트도 새 버전으로 갱신
- 이 규칙을 건너뛰면 안 됨
- 작성 원칙 1: 업데이트 내역은 처음 보는 일반 유저도 직관적으로 이해할 수 있도록 최대한 심플하고 친숙한 언어로 작성한다.
- 작성 원칙 2: 복잡한 내부 코드 로직이나 어려운 기술 용어는 배제한다. 기술적으로 복잡한 수정 사항이더라도 사용자 관점에서 어떤 점이 좋아졌는지 위주로 뭉뚱그려(추상화하여) 쉽게 풀어서 설명한다.

---

## 코드 수정 원칙
1. 최소 변경 — 요청 부분만, 주변 코드 건드리지 않음
2. 서버 코드 추가 금지
3. 라이브러리 추가 시 CDN 링크만 (index.html HEAD에 추가)
4. 한국어 유지 (UI 텍스트, 주석)
5. 엑셀 시트 구조 임의 변경 금지

## 용어
- **없음 상태**: A 패널엔 유지, B 리포트에서만 숨김
- **완료버튼 순환**: 없음 → ✓완료 → △부분완료 → ✗미완료 → 없음

## Git 워크플로우 (자동 main 반영)
코드 수정 완료 후 반드시 아래 순서를 따른다:
1. 변경 파일 `git add` → `git commit`
2. **머지 충돌 방지**: push 전에 반드시 `git fetch origin main && git rebase origin/main` 실행
3. `git push` (현재 브랜치)
4. **main 브랜치에 머지** — PR 생성 후 즉시 squash 머지
5. 별도 확인 없이 자동으로 수행 (사용자가 "커밋해" 또는 코드 수정을 요청하면 push+merge까지 완료)

> 요약: 모든 코드 변경은 최종적으로 **main 브랜치에 반영**되어야 한다.

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

---

## 표준 작업 체크리스트 (답변 시 필수 출력)
사용자 요청 처리 시 (`/fast` 모드가 아닐 경우) 답변 내용에 반드시 아래 체크리스트를 포함하여 작업 누락을 방지한다.

### 1. 작업 대상 파악
- [ ] 타겟 파일: [본문의 '자연어 → 파일 라우팅' 표를 참조하여 파일명 기재]

### 2. 코드 수정
- [ ] [파일명] 코드 수정 완료

### 3. 문서 동기화 (누락 주의)
- [ ] docs 갱신: ['파일 수정 후 필수 동기화' 표 대조 확인, 갱신 파일명 기재 또는 '해당 없음']
- [ ] updates.md 및 index.html 버전 갱신: [새 버전(v1.XX) 반영 완료]

### 4. Git 자동화
- [ ] `git add` & `commit` 완료
- [ ] `git fetch` & `rebase origin/main` 대조 및 `push` 완료
