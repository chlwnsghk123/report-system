# 함수 목록

> 함수명·역할 빠른 참조용. 동작 원리는 해당 파일 직접 확인.

---

## js/state.js
| 함수/상수 | 역할 |
|---|---|
| `$$` | `document.getElementById` 단축 헬퍼 |
| `G` | 전역 상태 객체 (전체 앱 데이터 허브) |
| `DB`, `STORE` | IndexedDB 이름 상수 |

---

## js/utils.js
| 함수 | 역할 |
|---|---|
| `getCurL()` | `G.selDate` 기준 현재 lesson 반환 |
| `getPrevL()` | 현재 lesson의 직전 lesson 반환 |
| `getNextL()` | 현재 lesson의 직후 lesson 반환 |
| `setAuto(id, val)` | input에 값 설정 + `.auto` 클래스 부여 (자동채우기 표시) |
| `rmAuto(el)` | `.auto` 클래스 제거 (사용자 편집 시 호출) |
| `setBar(t, m)` | 상태바 타입(`'wait'`/`'ok'`/`'err'`) · 메시지 업데이트 |
| `shortD(d)` | `YYYY-MM-DD` → `M.D` 형식 |
| `fmtKo(d)` | `YYYY-MM-DD` → 한글 날짜+요일 형식 |
| `esc(s)` | HTML 특수문자 이스케이프 (XSS 방지) |

---

## js/db.js
| 함수 | 역할 |
|---|---|
| `openDB()` | IndexedDB 오픈 (앱 시작 시 1회) |
| `dbSet(k, v)` | IndexedDB 키·값 저장 |
| `dbGet(k)` | IndexedDB 값 읽기 |

---

## js/excel.js
| 함수 | 역할 |
|---|---|
| `triggerLoad()` | 파일선택 다이얼로그 열기 |
| `loadExcel(input)` | 엑셀 파일 읽기 → `parseWB` 호출 |
| `toDS(v)` | 다양한 날짜 형식 → `YYYY-MM-DD` 정규화 |
| `parseWB(wb)` | 워크북 파싱 → `G.lessons`, `G.students`, `G.corrects`, `G.wrong`, `G.hwRec`, `G.rates` 전체 채움 |
| `saveToExcel()` | 현재 G 상태 → 엑셀 파일 재생성 후 다운로드 |

---

## js/ui.js
| 함수 | 역할 |
|---|---|
| `updateScale()` | 우측 리포트카드 반응형 스케일 계산·적용 |
| `initCE()` | contenteditable 요소의 리포트카드↔패널 동기화 이벤트 설정 |
| `fp(cid, pid)` | **패널 → 리포트카드** 단방향 동기화 (패널 input 값을 카드 innerText에 복사) |
| `renderTabs()` | `G.students` 기준 학생 탭바 렌더링 |
| `switchTab(name)` | 학생 탭 전환: 현재 저장 → 선택 변경 → autoFillAll |
| `saveTabData()` | 현재 학생 입력값 → `G.tabData[학생명]` (메모리만, DB 아님) |
| `restoreTabData(name)` | `G.tabData[name]` → UI 복원. 데이터 있으면 `true` 반환 |
| `toggleSec(type)` | `'mini'` 또는 `'comment'` 섹션 토글 |
| `toggleCurProg()` | 현재 진도 접기·펼치기 |
| `toggleNextHw()` | 이번 과제 접기·펼치기 |

---

## js/session.js
| 함수 | 역할 |
|---|---|
| `saveAppData()` | G → IndexedDB `'appData'` 저장 (lessons/students/rates 등 전체) |
| `saveSession()` | 선택 상태 → IndexedDB `'session'` 저장 (날짜·학생·토글) |
| `restoreSession(s)` | IndexedDB 데이터 → UI 복원 후 autoFill 재실행 |
| `populateSels()` | `G.lessons` 기준 날짜 드롭다운 채우기 |
| `showGroups()` | 엑셀 로드 후 숨겨진 UI 요소 일괄 표시 |
| `onDate()` | 날짜 드롭다운 변경 핸들러 |

---

## js/autofill.js
| 함수 | 역할 |
|---|---|
| `calcScore()` | 맞힌수/전체 → 점수 계산 및 표시 (공식: `autofill.js` 참조) |
| `autoFillCommon()` | 날짜 기준 공통 필드 자동채우기 (진도·과제·강사명) |
| `autoFillAll()` | 학생+날짜 기준 전체 자동채우기 (`autoFillCommon` + 학생별 데이터) |

---

## js/report.js
| 함수 | 역할 |
|---|---|
| `rebuildGraph()` | SVG 이행률 꺾은선 그래프 재빌드 |
| `renderHwEditor()` | 저번 과제 에디터 UI 렌더링 (항목별 상태 버튼 포함) |
| `onRateManual()` | 이행률 수동입력 핸들러 → `G.hwRateManual` 설정 후 그래프 갱신 |
| `calcRateFromStatus(s)` | 과제상태 배열 → 이행률 자동계산 (완료=100%, 부분=50%) |
| `hwBtnLabel(s)` | 상태 문자열 → 버튼 표시 라벨 반환 |
| `cycleHwStatus(i)` | i번째 과제 상태 순환 (없음→완료→부분완료→미완료→없음) |
| `updateHeaderDate(cur, next)` | 리포트 날짜 헤더 업데이트 |
| `updateHwDisplay()` | 저번 과제 리포트 섹션 UI 업데이트 |
| `updateHwBadge()` | (예약됨, 현재 빈 함수) |
| `updateNoticeList(text)` | 이번 과제 목록 리포트 섹션 업데이트 |
| `updateCommentSign()` | 강사 서명 업데이트 (`From. 이름 T` 형식) |
| `updateWrongTags(tagStr)` | 오답 번호 태그 UI 업데이트 |
| `updateCurProgSummary()` | 현재 진도 접힌 상태 요약 텍스트 |
| `updateNextHwSummary()` | 이번 과제 접힌 상태 요약 텍스트 |

---

## js/pdf.js
| 함수 | 역할 |
|---|---|
| `loadAttachPdf(input)` | PDF 첨부 로드 → pdf.js로 전 페이지 캔버스 렌더링 |
| `renderSpread()` | 현재 spread 인덱스 기준 미리보기 표시 업데이트 |
| `drawPdfPrev(tgt, src)` | PDF 캔버스 → 미리보기 캔버스에 복사 |
| `prevSpread()` | 이전 spread 이동 |
| `nextSpread()` | 다음 spread 이동 |
| `dlPdf()` | 리포트+첨부PDF 합성 → A4 가로 PDF 다운로드 |
| `dataUrlToBytes(u)` | DataURL → Uint8Array 변환 |

---

## js/init.js
| 함수 | 역할 |
|---|---|
| `window.onload` | 앱 초기화 진입점: DB오픈 → 데이터복원 → UI초기화 |
