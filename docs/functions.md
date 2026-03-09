# 함수 목록

## js/state.js
| 함수/상수 | 역할 |
|---|---|
| `$$` | `document.getElementById` 단축 헬퍼 |
| `G` | 전역 상태 객체 |
| `DB`, `STORE` | IndexedDB 이름 상수 |

## js/utils.js
| 함수 | 역할 |
|---|---|
| `getCurL()` | 현재 선택 날짜의 lesson 반환 |
| `getPrevL()` | 이전 lesson 반환 |
| `getNextL()` | 다음 lesson 반환 |
| `setAuto(id,val)` | 인풋에 자동채우기 값 설정 + `.auto` 클래스 |
| `rmAuto(el)` | `.auto` 클래스 제거 |
| `setBar(t,m)` | 상태바 타입·메시지 업데이트 |
| `shortD(d)` | YYYY-MM-DD → M.D |
| `fmtKo(d)` | YYYY-MM-DD → 한글날짜 (요일 포함) |
| `esc(s)` | HTML 특수문자 이스케이프 |

## js/db.js
| 함수 | 역할 |
|---|---|
| `openDB()` | IndexedDB 오픈 |
| `dbSet(k,v)` | IndexedDB 키·값 저장 |
| `dbGet(k)` | IndexedDB 값 읽기 |

## js/excel.js
| 함수 | 역할 |
|---|---|
| `triggerLoad()` | 파일선택 다이얼로그 열기 |
| `loadExcel(input)` | 엑셀 파일 읽기·파싱 진입 |
| `toDS(v)` | 날짜값 → YYYY-MM-DD 정규화 |
| `parseWB(wb)` | 워크북 파싱 → G 전체 채움 (날짜별 시트 신규 형식 + 구 형식 하위 호환) |
| `saveToExcel()` | G → 엑셀 파일 다운로드 (수업정보 + 날짜별 시트) |
| `createTemplate()` | 오늘~6월까지 주 1회 날짜가 포함된 신규 템플릿 엑셀 생성·다운로드 |

## js/ui.js
| 함수 | 역할 |
|---|---|
| `updateScale()` | 리포트카드 반응형 스케일 계산·적용 |
| `initCE()` | contenteditable 양방향 동기화 설정 |
| `fp(cid,pid)` | 리포트카드 → 패널 단방향 텍스트 동기화 |
| `renderTabs()` | 학생 탭바 렌더링 |
| `switchTab(name)` | 학생 탭 전환 |
| `saveTabData()` | 현재 학생 입력값 → G.tabData 임시저장 |
| `restoreTabData(name)` | G.tabData → UI 복원 |
| `toggleSec(type)` | 미니테스트/코멘트 토글 |
| `toggleCurProg()` | 현재 진도 접기·펼치기 |
| `toggleNextHw()` | 이번 과제 접기·펼치기 |

## js/session.js
| 함수 | 역할 |
|---|---|
| `saveAppData()` | G → IndexedDB `appData` 저장 |
| `saveSession()` | 세션 상태 → IndexedDB `session` 저장 |
| `restoreSession(s)` | IndexedDB → 세션 복원 |
| `populateSels()` | 날짜 드롭다운 채우기 |
| `showGroups()` | 엑셀 로드 후 UI 요소 표시 (gStudents 포함) |
| `onDate()` | 날짜 변경 핸들러 |
| `renderStudentList()` | 학생 목록 UI 렌더링 |
| `addStudent()` | 새 학생 G.students에 추가 |
| `removeStudent(idx)` | 학생 삭제 (G.students에서 제거) |
| `toggleStudentSec()` | 학생 목록 섹션 접기·펼치기 |

## js/autofill.js
| 함수 | 역할 |
|---|---|
| `calcScore()` | 맞힌수/전체 → 점수 계산 및 표시 |
| `autoFillCommon()` | 날짜 기준 공통 필드 자동채우기 |
| `autoFillAll()` | 학생+날짜 기준 전체 자동채우기 |

## js/report.js
| 함수 | 역할 |
|---|---|
| `rebuildGraph()` | SVG 이행률 꺾은선 그래프 재빌드 |
| `renderHwEditor()` | 과제 에디터 UI 렌더링 |
| `onRateManual()` | 이행률 수동입력 핸들러 |
| `calcRateFromStatus(s)` | 과제상태 배열 → 이행률 자동계산 |
| `hwBtnLabel(s)` | 상태 → 버튼 라벨 문자열 반환 |
| `cycleHwStatus(i)` | 과제 상태 순환 (없음→완료→부분→미완료→없음) |
| `updateHeaderDate(cur,next)` | 리포트 날짜 헤더 업데이트 |
| `updateHwDisplay()` | 저번 과제 리포트 UI 업데이트 |
| `updateHwBadge()` | 과제 뱃지 업데이트 (현재 미구현) |
| `updateNoticeList(text)` | 이번 과제 목록 리포트 UI 업데이트 |
| `updateCommentSign()` | 강사 서명 업데이트 |
| `updateWrongTags(tagStr)` | 오답 번호 태그 UI 업데이트 |
| `updateCurProgSummary()` | 현재 진도 접힌 상태 요약 텍스트 |
| `updateNextHwSummary()` | 이번 과제 접힌 상태 요약 텍스트 |

## js/pdf.js
| 함수 | 역할 |
|---|---|
| `loadAttachPdf(input)` | PDF 첨부 파일 로드 (pdf.js 렌더링) |
| `renderSpread()` | 현재 spread 페이지 표시 업데이트 |
| `drawPdfPrev(tgt,src)` | PDF 캔버스 → 미리보기 캔버스 그리기 |
| `prevSpread()` | 이전 spread 이동 |
| `nextSpread()` | 다음 spread 이동 |
| `dlPdf()` | 리포트+첨부PDF 합성 → 다운로드 |
| `dataUrlToBytes(u)` | DataURL → Uint8Array 변환 |

## js/init.js
| 함수 | 역할 |
|---|---|
| `window.onload` | 앱 초기화 진입점: DB오픈→복원→UI |
