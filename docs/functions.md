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
| `isCarryItem(fromDate)` | 현재 선택 날짜 기준 이월 과제 여부 판별 (fromDate !== 직전 수업 날짜) |
| `isCarryForDate(fromDate,date)` | 특정 날짜 기준 이월 과제 여부 판별 |
| `refToCheckDate(ref)` | ref → 체크 날짜 변환 (원본 수업 다음 수업일 = 숙제 확인일) |
| `esc(s)` | HTML 특수문자 이스케이프 |
| `nowKST()` | 한국 시간(KST) Date 객체 반환 |
| `todayKST()` | 한국 시간 기준 오늘 날짜 (YYYY-MM-DD) |
| `nowKSTStr()` | 한국 시간 기준 현재 일시 (YYYY-MM-DD HH:MM:SS) |

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
| `normalizeRate(v)` | 이행률 정규화: %문자열·소수·정수 → 0~100 숫자 |
| `stFromExcel(v)` | 엑셀 상태(○/△/X/0/1/2) → 한글(완료/부분완료/미완료) 변환 |
| `stToExcel(v)` | 한글 상태 → 엑셀 숫자('2'/'1'/'0'/공란) 변환 |
| `parseWB(wb)` | 워크북 파싱 → G 전체 채움 (신구 형식 자동 감지, 설정 시트 포함) |
| `_resolveRefText(ref,studentName)` | 이월과제 ref → 원본 과제 텍스트 해석 (parseWB 내부 함수) |
| `saveToExcel()` | G → 엑셀 파일 다운로드 (수업정보 + 날짜별 + 이월과제 + 설정 시트, 마지막 저장 시각 기록) |
| `createTemplate()` | 오늘~6월까지 주 1회 날짜가 포함된 신규 템플릿 엑셀 생성·다운로드 |
| `updateLastSavedDisplay()` | G.lastSaved → #rLastSaved 텍스트 업데이트 |
| `removeExcelData()` | 엑셀 데이터 제거 모달 (저장 후 제거/그냥 제거/취소 3버튼) |
| `_clearAllData()` | 모든 데이터 초기화 (G 초기화 + UI 리셋 + DB 정리) |
| `createSampleExcel()` | 4명 학생·3개 날짜 샘플 엑셀 생성·다운로드 |

## js/ui.js
| 함수 | 역할 |
|---|---|
| `updateScale()` | 리포트카드 반응형 스케일 계산·적용 |
| `initCE()` | contenteditable 양방향 동기화 설정 |
| `fp(cid,pid)` | 리포트카드 → 패널 단방향 텍스트 동기화 |
| `switchView(view)` | 'config'/'date' 뷰 전환 |
| `renderViewTabs()` | (레거시, 미사용) 뷰 탭 바 렌더링 |
| `shiftDate(dir)` | (레거시, 미사용) 날짜 탭 스크롤 |
| `selectDate(date)` | 날짜 선택 → date 뷰 전환 |
| `renderDateSidebar()` | 우측 날짜 사이드바 렌더링 (학생 사이드바 왼쪽, 세로 사선 스타일) |
| `renderDateNav()` | 상단 날짜 네비게이션 바 렌더링 (< 날짜 > + 드롭다운) |
| `navDatePrev()` | 이전 날짜로 이동 |
| `navDateNext()` | 다음 날짜로 이동 |
| `toggleDateDropdown()` | 날짜 드롭다운 토글 |
| `zoomReport(delta)` | 리포트카드 확대/축소 (0=자동맞춤) |
| `navStudentPrev()` | 이전 학생으로 전환 |
| `navStudentNext()` | 다음 학생으로 전환 |
| `_updateStudentNav()` | 학생 전환 화살표 활성/비활성 갱신 |
| `_showContextMenu(x,y,items)` | 커스텀 우클릭 컨텍스트 메뉴 표시 |
| `openMascotSettingsModal(name)` | 학생별 점수대 캐릭터 설정 모달 |
| `_saveReportAsImage(target)` | 리포트/PDF를 PNG 이미지로 저장 |
| `openAddStudentModal()` | 학생 추가 모달 (쉼표 구분 다중 추가 지원) |
| `_doAddStudents()` | 학생 추가 모달 실행 (내부 함수) |
| `openRemoveStudentModal()` | 학생 제거 모달 (목록 + 경고 삭제) |
| `_doRemoveStudent(idx)` | 학생 제거 실행 (관련 데이터 정리 포함) |
| `openStudentSettingsModal()` | 학생 설정 모달 (껍데기, 준비 중) |
| `openHelpModal()` | 도움말 모달 (아코디언 형태 기능별 설명 + 샘플 다운로드) |
| `openBatchPdfModal()` | 일괄 PDF 날짜 선택 모달 |
| `addDateFromNav()` | 날짜 네비 바에서 날짜 추가 + 이동 |
| `openLessonModalFocused(date)` | 특정 날짜에 포커싱하여 수업설정 모달 열기 |
| `_showAutoFieldTip(x,y)` | 읽기전용 필드 클릭 시 안내 툴팁 표시 |
| `openLessonModal()` | 수업설정 전체화면 모달 열기 |
| `closeLessonModal()` | 수업설정 모달 닫기 |
| `getLessonHwKeys(l)` | 레슨 객체의 동적 과제 키 목록 반환 |
| `renderLessonCards()` | 수업설정 모달: 레슨 카드 렌더링 (날짜 상태 분류·포커스 포함) |
| `updateLessonField(idx,field,value)` | 레슨 필드 수정 → G.lessons 업데이트 + 리포트 동기화 |
| `syncLessonToReport()` | 현재 선택 날짜의 수업정보 → 리포트카드 동기화 |
| `addLessonHw(idx)` | 레슨에 과제 필드 동적 추가 |
| `removeLessonHw(idx,hwIdx)` | 레슨의 과제 필드 삭제 + 키 재정렬 |
| `updateLessonDate(idx,newDate)` | 수업 날짜 변경 (hwRec/rates/wrong/memos 키 이동 포함) |
| `addLesson()` | 새 수업 날짜 추가 (마지막 +7일) |
| `removeLesson(idx)` | 수업 날짜 삭제 |
| `renderDateSummary()` | 날짜 뷰 상단: 수업정보 읽기전용 요약 |
| `renderTabs()` | 학생 사이드바 렌더링 (우측 프리뷰 영역, PDF 뱃지·호버 포함) |
| `switchTab(name)` | 학생 전환 (사이드바 갱신 + PDF 동기화) |
| `saveTabData()` | 현재 학생 입력값 → G.tabData 임시저장 + hwRec items 동기화 |
| `syncHwRecItems(student,date)` | G.hwItems/hwStatus/hwItemRefs → hwRec[key].items 동기화 (통일 구조: ref+fromDate) |
| `restoreTabData(name)` | G.tabData → UI 복원 (hwItems/hwItemRefs 포함) |
| `_getCarryAutoText(student,date)` | 이월과제 자동 요약 텍스트 생성 (상태 변경분만, 중복 제거) |
| `_getOriginalRefStatus(student,ref)` | ref로 원본 과제의 최초 상태 조회 (변경 감지용) |
| `openMemo()` | 비고 모달 열기 (자동 요약 표시 + 메모 편집) |
| `closeMemo(force)` | 비고 모달 닫기 (변경 감지 → confirm) |
| `saveMemo()` | 비고 저장 → G.memos + saveAppData + 토스트 |
| `updateMemoBtn()` | 비고 버튼 상태 업데이트 (작성/수정 + disabled) |
| `_openModal(id)` | 모달 열기 공통 (배경 스크롤 잠금) |
| `_closeModal(id)` | 모달 닫기 공통 (스크롤 복원) |
| `_showModalToast(modalId,msg)` | 모달 내 토스트 메시지 표시 |
| `toggleSec(type)` | 미니테스트/코멘트 토글 |

## js/session.js
| 함수 | 역할 |
|---|---|
| `saveAppData()` | G → IndexedDB `appData` 저장 (300ms 디바운스, 에러 핸들링) |
| `saveAppDataNow()` | G → IndexedDB `appData` 즉시 저장 (엑셀 저장 등) |
| `saveSession()` | 세션 상태 → IndexedDB `session` 저장 |
| `restoreSession(s)` | IndexedDB → 세션 복원 |
| `showGroups()` | 엑셀 로드 후 UI 요소 표시 + 날짜 자동 선택 + 제거버튼 표시 |
| `zeroStart()` | 엑셀 없이 직접 시작 (빈 상태 UI 활성화) |
| `autoSelectDate()` | 오늘 이후 가장 가까운 날짜 자동 선택 |
| `renderStudentList()` | 학생 목록 UI 렌더링 |
| `addStudent()` | 새 학생 G.students에 추가 |
| `removeStudent(idx)` | 학생 삭제 (G.students에서 제거) |
| `toggleStudentSec()` | 학생 목록 섹션 접기·펼치기 |
| `markUnsaved()` | 미저장 상태 배너 표시 (G.unsaved=true) |
| `markSaved()` | 미저장 배너 숨김 (G.unsaved=false) |

## js/autofill.js
| 함수 | 역할 |
|---|---|
| `stFromExcel(v)` | 엑셀 기호/숫자(○/△/X/0/1/2) → 한글 상태 변환 |
| `_resolveCarryRef(ref,student)` | ref → 과제 텍스트·출제일 해석 (이월 전파용 헬퍼) |
| `propagateCarryover(student,date,refStr,newStatus)` | 과제 status 변경 시 미래 날짜 hwRec 갱신 (0/1→다음 날짜 이월 생성, 2/-1→이후 모든 이월 삭제) |
| `buildAllCarryover()` | 엑셀 로드 후 전체 날짜·학생 순회하며 미완료/부분완료 항목의 이월 레코드 일괄 생성 |
| `flushPropagations()` | G.pendingPropagations 큐의 보류된 이월 전파를 일괄 적용 (세션 전환/저장 시 호출) |
| `computeCarryover(student,date)` | 직전 날짜 hwRec에서 미완료/부분완료 항목 수집 → 캐리오버 배열 반환 |
| `updateNoticeWithCarry()` | 이번 주차 과제 + 추가과제 + 미완료 캐리오버 → 리포트카드 반영 |
| `renderCurHwList()` | 패널 이번 주차 과제 목록 렌더 (레슨+추가+이월, Enable/Disable 토글) |
| `toggleHwDisabled(idx)` | 이번 주차 과제 Enable/Disable 토글 |
| `renderExtraHwEditor()` | 패널 학생별 추가 과제 에디터 렌더 (수정/삭제 가능) |
| `autoFillCommon()` | 날짜 기준 공통 필드 자동채우기 |
| `getPrevExtraHw(student,date)` | 이전 날짜의 학생별 추가과제 텍스트 배열 반환 |
| `autoFillAll()` | 학생+날짜 기준 전체 자동채우기 (hwRec.items 우선 사용, 없으면 직접 구성) |

## js/report.js
| 함수 | 역할 |
|---|---|
| `MASCOT_IMGS` | 티어별(high/mid/low) 마스코트 이미지 경로 배열 |
| `registerMascots(tier,files)` | 마스코트 이미지 등록 (tier: high/mid/low) |
| `updateRateFace()` | 이행률 기반 마스코트 이미지 표시 (75↑high, 30↑mid, 30↓low), 사용자 선택 시 세션 내 고정, 첫 로드만 랜덤 |
| `openMascotPicker()` | 마스코트 클릭 시 선택 팝업 열기 (같은 티어 이미지 그리드 표시) |
| `rebuildGraph()` | SVG 이행률 꺾은선 그래프 재빌드 |
| `renderHwEditor()` | 과제 에디터 UI 렌더링 (base/carry만, 저번 주차 체크) |
| `addExtraHw()` | 이번 주차 추가 과제 항목 추가 (G.extraHw) |
| `removeExtraHw(idx)` | 이번 주차 추가 과제 항목 삭제 |
| `updateExtraHwText(idx,val)` | 이번 주차 추가 과제 텍스트 수정 |
| `autoCalcRate()` | 과제 상태에서 이행률 자동 계산 (완료=100%, 부분=50%, 미완료=0%) |
| `onRateManual()` | 이행률 수동입력 핸들러 |
| `hwBtnLabel(s)` | 상태 → 버튼 라벨 문자열 반환 |
| `cycleHwStatus(i)` | 과제 상태 순환 (없음→완료→부분→미완료→없음) |
| `updateHeaderDate(cur,next)` | 리포트 날짜 헤더 업데이트 |
| `updateHwDisplay()` | 저번 과제 리포트 UI 업데이트 |
| `updateHwBadge()` | 과제 뱃지 업데이트 (현재 미구현) |
| `updateNoticeList(text)` | 이번 과제 목록 리포트 UI 업데이트 |
| `updateCommentSign()` | 강사 서명 업데이트 |
| `updateWrongTags(tagStr)` | 오답 번호 태그 UI 업데이트 |
| `applyReportEdits()` | 리포트카드 contenteditable 직접편집 오버라이드 적용 |
| `initReportListeners()` | 리포트카드 편집 리스너 (현재 비활성화 — 안정성 확보) |
| `setAttend(val)` | 출결 상태 설정 (2=출석,1=지각,0=결석) |
| `updateAttendUI()` | 출결 토글 버튼 UI 갱신 |
| `autoAttendOnRate()` | 이행률 변경 시 결석→출석 자동전환 |

## js/pdf.js
| 함수 | 역할 |
|---|---|
| `_processPdfFile(file)` | PDF 파일 → 첫 페이지 캔버스 + PNG bytes 추출 (내부 함수) |
| `_addPdfToStudent(student,pdfData)` | 학생별 PDF 데이터 추가 |
| `_getStudentPdfCanvases(student)` | 학생별 PDF 캔버스 배열 반환 |
| `_getStudentPdfPageCount(student)` | 학생별 PDF 총 페이지 수 반환 |
| `_syncGlobalPdf()` | 현재 학생 기준 전역 pdfCanvases/pdfPageCount 동기화 |
| `handlePdfInput(input)` | PDF 파일 입력 핸들러 (학생별/전체 분기) |
| `inlinePdfAttach()` | 리포트 옆 + 버튼 핸들러 (스마트 분기: 개별 PDF 존재 시 현재 학생만, 없으면 선택 메뉴) |
| `attachPdfForStudent(name)` | 특정 학생에게 PDF 직접 첨부 (기존 PDF 있으면 교체 모드) |
| `openStudentReportFor(name)` | 사이드바에서 학생별 이행률 요약표 바로 열기 |
| `_attachStudentReportToView(student,dates)` | 이행률 요약표를 PNG로 캡처하여 학생 PDF로 첨부 |
| `removeStudentPdf(student,idx)` | 학생별 PDF 개별 삭제 (confirm) |
| `removeAllStudentPdfs(student)` | 학생별 PDF 전체 삭제 (confirm) |
| `_savePdfData()` | 학생별 PDF bytes → IndexedDB 저장 |
| `restorePdfData()` | IndexedDB → 학생별 PDF 복원 (PNG/레거시 PDF 지원) |
| `renderSpread()` | 현재 spread 페이지 표시 업데이트 |
| `drawPdfPrev(tgt,src)` | PDF 캔버스 → 미리보기 캔버스 그리기 |
| `prevSpread()` | 이전 spread 이동 |
| `nextSpread()` | 다음 spread 이동 |
| `dlPdf()` | 리포트+첨부PDF 합성 → 다운로드 |
| `toggleToolbarMenu(id)` | 툴바 드롭다운 메뉴 토글 |
| `closeToolbarMenus()` | 모든 툴바 메뉴 닫기 |
| `dlSummaryPdf()` | 전체 과제 요약 이미지 생성 (확인 모달 표시) |
| `_doSummaryImage()` | 과제 요약 PNG 캡처 및 다운로드 (내부 함수) |
| `showConfirmModal(title,desc,fn)` | 범용 확인/취소 모달 |
| `dataUrlToBytes(u)` | DataURL → Uint8Array 변환 |
| `dlBatchPdf()` | 일괄 PDF 내보내기 진입점 (확인 모달 → _doBatchPdf) |
| `_doBatchPdf()` | 결석 제외 전체 학생 리포트 → 세로 A4 멀티페이지 PDF 생성·다운로드 |
| `dlGradeSummary()` | 성적 요약표 날짜 범위 선택 모달 열기 |
| `_renderGradeTable(dates,container)` | 학생×날짜 성적 테이블 HTML 렌더링 |
| `_downloadGradeImage(dates)` | 성적 요약표 PNG 캡처·다운로드 |
| `_buildJournalAttendHtml(date)` | 수업 일지 출결 현황 HTML (프리뷰용) |
| `dlClassJournal()` | 수업 일지 날짜 선택 모달 열기 |
| `_downloadJournalImage(date)` | 수업 일지 PNG 캡처·다운로드 |
| `_buildJournalAttendImageHtml(date)` | 수업 일지 출결 현황 HTML (이미지 다운로드용) |
| `dlStudentReport()` | 학생별 리포트 요약 모달 열기 (학생·날짜 범위 선택) |
| `_renderStudentReport(student,s,e,container)` | 학생별 종합 요약 + 날짜별 과제 상세 HTML 렌더링 |
| `_downloadStudentReportPdf(student,dates)` | 학생별 리포트 요약 PDF 캡처·다운로드 (A4 멀티페이지) |
| `showUpdateModal()` | 업데이트 내역 모달 (updates.md 로드·표시) |

## js/init.js
| 함수 | 역할 |
|---|---|
| `loadMascotImages()` | 마스코트 이미지 수동 등록 (하드코딩된 파일 목록) |
| `document keydown` | 전역 키보드: ESC(모달 닫기), Ctrl+S(저장) |
| `initPanelResize()` | 좌측 패널 드래그 리사이즈 핸들 초기화 |
| `window.onload` | 앱 초기화 진입점: DB오픈→updateScale→initCE→loadMascotImages→initPanelResize→restorePdfData |
