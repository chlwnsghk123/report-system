# 함수 목록

## js/state.js
| 함수/상수 | 역할 |
|---|---|
| `$$` | `document.getElementById` 단축 헬퍼 |
| `isNone(s)` | 상태값 판별 (`''`, `-1`, `null`, `undefined` → 없음) |
| `genLessonId()` | 10자리 난수 수업 ID 생성 |
| `G` | 전역 상태 객체 (필드 설명: `docs/ui-state.md`) |
| `DATA_KEYS` | 엑셀·IndexedDB에 저장되는 데이터 필드 목록 (백업·복구·파싱 롤백 공용) |
| `DB`, `STORE` | IndexedDB 이름 상수 |

## js/utils.js
| 함수 | 역할 |
|---|---|
| `getCurL()` / `getPrevL()` / `getNextL()` | 현재 선택 날짜의 수업 / 이전 수업 / 다음 수업 |
| `setAuto(id,val)` | 인풋에 자동채우기 값 설정 + `.auto` 클래스 (입력하면 해제) |
| `setBar(t,m)` | 상태바 타입·메시지 업데이트 |
| `toast(msg)` | 화면 하단 짧은 알림 (2초) |
| `DATE_RE` / `isValidDate(s)` | `YYYY-MM-DD` 형식 정규식 / 형식 + 달력에 있는 날짜인지 검사 (`2026-13-45` 같은 값 거름 — 수업정보·미니테스트·백업 복구에 사용) |
| `shortD(d)` | YYYY-MM-DD → MM.DD |
| `ymd(d)` | Date → YYYY-MM-DD |
| `fmtKo(d)` | YYYY-MM-DD → 한글날짜 (요일 포함) |
| `isCarryItem(fromDate)` | 현재 선택 날짜 기준 이월 과제 여부 (fromDate !== 직전 수업 날짜) |
| `isCarryForDate(fromDate,date)` | 특정 날짜 기준 이월 과제 여부 |
| `parseHwRef(ref)` | ref 통합 파서 — 신/구 형식, `{type, lessonId, text?, hwKey?, ei?}` |
| `buildExtraRef(lessonId,text)` | 추가과제 신 형식 ref: `{lessonId}@x@{text}` |
| `refToCheckDate(ref)` | ref → 숙제 확인일 (원본 수업 다음 수업일) |
| `esc(s)` | HTML 특수문자 이스케이프 (inline JS 문자열에는 쓰지 말고 `data-*` 속성 사용) |
| `nowKST()` / `todayKST()` / `nowKSTStr()` | 한국 시간 Date / 오늘(YYYY-MM-DD) / 현재 일시 문자열 |

## js/domain.js (도메인 계층)
DOM·저장소에 무관한 순수 비즈니스 규칙. G를 읽기만 하며 부수효과 없음. (설계 배경: `docs/architecture.md`)
| 함수/상수 | 역할 |
|---|---|
| `attOf(student,date)` | 출결값 반환 (2/1/0, 미선택·구버전 -1은 undefined) |
| `isAbsent(student,date)` | **명시적으로 '결석' 선택**한 경우만 결석 판정 (이행률로 추정 안 함) |
| `isReportEligible(student,date)` | 리포트/일괄 PDF·이미지 대상 여부 — 결석만 제외 |
| `attendCategory(student,date)` | 출결 분류 문자열 `'present'|'late'|'absent'|'none'` |
| `hwOffSet(student,date)` | 해당 학생·날짜의 OFF된 과제 ref 집합 (읽기 전용) |
| `isHwOff(student,date,ref)` | 특정 과제 ref가 OFF인지 |
| `RATE_TIER` / `RATE_STYLE` | 이행률 등급 기준(75/30)과 등급별 라벨·색 — 모든 화면·출력물 공통 |
| `rateTier(v)` / `rateFg(v)` / `rateBg(v)` | 이행률 → 등급 / 글자색 / 배경색 |
| `isOptionalHw(text)` | 과제명에 '(선택)'이 있는 선택 과제인지 — 이행률 계산·이월 대상에서 제외 |
| `calcRate(statuses)` | 과제 상태 배열 → 이행률 (완료 100·부분 50·미완료 0 평균, 없으면 null) |
| `hwStatusCounts(statuses)` | 상태 배열 → `{done, partial, miss}` 개수 |
| `MINI_PERFECT_MARKS` / `parseWrongList(str)` | 오답칸 만점 표시('0'·'없음'·'만점') / 오답 문자열 → 번호 배열 (쉼표 구분, 번호만 나열한 조각은 띄어쓰기·마침표로도 나눔, '4번'→'4') |
| `miniOutOfRange(student,date)` | 문항 수 범위(1~문항 수)를 벗어난 오답 번호 배열 — 입력칸 경고·보내기 전 점검용 (글자 항목은 제외, '1-2'는 앞 번호로 판단) |
| `miniResult(student,date)` | 미니테스트 결과 `{total,correct,wrong,range,pct,perfect}` — 결석이거나 **그 학생 입력이 없으면 null** (문항 수만으로 만점 처리하지 않음). v1.85부터 직접 입력한 미니 테스트만 (문제 노트 숙제 결과는 '지난 수업 과제' — `noteCheckRows`) |

## js/db.js
| 함수 | 역할 |
|---|---|
| `openDB()` | IndexedDB 열기 (실패 시 reject — init.js에서 잡고 백업 없이 동작) |
| `dbSet(k,v)` | 값 저장 — 트랜잭션 오류·중단 시 reject |
| `dbGet(k)` | 값 읽기 (실패 시 null) |

## js/excel.js
| 함수 | 역할 |
|---|---|
| `triggerLoad()` | 엑셀 파일 선택 창 열기 |
| `loadExcel(input)` | 파일 읽기 → `parseWB` (실패 시 이전 데이터로 롤백) → 작업 상태 초기화 → 날짜 뷰 |
| `toDS(v)` | 날짜 값 → YYYY-MM-DD |
| `normalizeRate(v)` | 이행률 정규화 ("%"·소수·정수 → 0~100) |
| `stFromExcel(v)` / `stToExcel(v)` | 엑셀 상태 기호 ↔ 내부 숫자 (2/1/0/-1) |
| `parseWB(wb)` | 워크북 → G (수업정보·날짜별·이월과제·설정 시트, 구 형식 호환) |
| `rebuildAllHwItems(fromExcel)` | 모든 학생·날짜의 hwRec.items 재구성 (상태는 ref로, 엑셀 로드 직후에만 순번 필드 사용) + 이월 전파 |
| `updateLastSavedDisplay()` | 마지막 저장 시각 표시 |
| `saveToExcel()` | 엑셀 저장 (성공 true / 실패 false) — 설정 시트 고아 데이터 정리 포함 |
| `removeExcelData()` | 데이터 제거 모달 (저장 후 제거 / 그냥 제거 / 취소) |
| `_clearAllData()` | 모든 데이터·화면·자동 백업 초기화 |
| `createSampleExcel()` | 샘플 엑셀 다운로드 (도움말) |

## js/ui.js
| 함수 | 역할 |
|---|---|
| `updateScale()` | 미리보기 배율 계산 (첨부 있으면 2장 나란히) |
| `switchView(view)` | `'config'`(수업설정 모달) / `'date'`(날짜 뷰) 전환 |
| `openLessonModal()` / `closeLessonModal()` | 수업설정 모달 열기/닫기 — 실제로 열려 있었을 때만 과제 목록 재구성 + 다시 채움 (채웠으면 true) |
| `exitLessonModal()` | 모달 ✕/ESC — 선택 날짜가 없으면 가장 가까운 날짜로 이동 |
| `openLessonModalFocused(date)` | 특정 날짜 카드에 포커스한 채 수업설정 열기 |
| `selectDate(date)` | 날짜 전환 (이월 전파 적용 + 현재 학생 작업 반영) |
| `getLessonHwKeys(l)` | 수업의 과제 키 목록 (과제1~N) |
| `renderLessonCards()` / `focusLessonCard(i)` / `_autoGrowTextarea(el)` | 수업 카드 렌더링·포커스·상세진도 높이 조절 |
| `updateLessonField(i,f,v)` | 수업 필드 수정 → 리포트 진도 갱신 |
| `addLessonHw(i)` / `removeLessonHw(i,hwIdx)` | 과제 추가/삭제 (삭제 시 ref 재매핑) |
| `updateLessonDate(i,newDate)` | 수업 날짜 변경 → `renameDateData` |
| `addLesson()` / `removeLesson(i)` | 수업 추가(+7일) / 삭제(→ `removeDateData`) |
| `addDateFromNav()` | 날짜 네비의 + 버튼 — 수업 추가 후 그 날짜로 이동 |
| `_forDateKeys(date,fn)` | 날짜가 키에 들어간 모든 저장소 순회 |
| `renameDateData(old,new)` / `removeDateData(date)` | 날짜 키 데이터 일괄 이동 / 삭제 (fromDate·이월 예약 포함) |
| `_remapLessonHwRefs(lessonId,n)` | n번째 과제 삭제 시 ref 기록 제거·뒤 번호 당김 |
| `renderDateSummary()` | 패널 상단 수업 정보 요약 카드 |
| `renderTabs()` | 학생 사이드바 (`data-student` + 우클릭: 요약표·PDF 첨부·캐릭터·이름 변경) |
| `openStudentReportFor(name)` | 학생별 이행률 요약표 열기 |
| `switchTab(name)` | 학생 전환 (작업 저장 → 첨부 동기화 → 자동채우기 → 슬라이드 애니메이션) |
| `saveTabData()` / `restoreTabData(name)` | 현재 학생 작업 캐시 저장(+hwRec 동기화) / 복원 |
| `syncHwRecItems(student,date)` | 현재 과제 상태·추가과제·이행률 → hwRec |
| `_getOriginalRefStatus(student,ref)` | 이월 과제의 최초 검사 상태 (비고 자동 요약용) |
| `_openModal(id)` / `_closeModal(id)` / `_showModalToast(id,msg)` | 모달 공통 열기/닫기/토스트 |
| `applyViewSettings()` | 미니테스트·선생님 한마디 토글, 컬러 모드를 화면에 반영 |
| `toggleColorMode()` / `toggleSec(type)` | 컬러/흑백 전환 / 미니테스트·코멘트 표시 전환 (엑셀에 저장) |
| `renderDateNav()` / `navDatePrev()` / `navDateNext()` / `toggleDateDropdown()` | 상단 날짜 네비게이션 |
| `zoomReport(delta)` / `_updateZoomLabel()` | 확대/축소 |
| `navStudentPrev()` / `navStudentNext()` / `_updateStudentNav()` | 학생 전환 화살표 (키보드 ↑↓) |
| `_showContextMenu(x,y,items)` / `_closeContextMenu()` | 커스텀 우클릭 메뉴 |
| `openMascotSettingsModal(name)` | 학생별 캐릭터 설정 |
| `saveAttachAsImage()` | 첨부 시험자료를 JPG로 저장 (리포트 영역 우클릭) |
| `openAddStudentModal()` / `_doAddStudents()` | 학생 추가 (쉼표로 여러 명, 첫 학생이면 바로 리포트 표시) |
| `openRemoveStudentModal()` / `_doRemoveStudent(i)` | 학생 제거 (관련 데이터 전부 정리, 작업 상태 덮어쓰기 방지) |
| `renameStudent(old)` | 학생 이름 변경 (기록 전부 새 이름으로 이동) |
| `_closeHoverMenus()` | 툴바 메뉴 닫기 |
| `openHelpModal()` | 도움말 (v1.85: '문제 노트와 함께 쓰기 (숙제·오답)' 항목) |
| `openBatchPdfModal()` | 일괄 PDF 날짜 선택 (대상 0명이면 비활성) |
| `_showAutoFieldTip(x,y)` | 읽기전용 필드 클릭 시 안내 툴팁 |

## js/session.js
| 함수 | 역할 |
|---|---|
| `_appSnapshot()` / `_writeSnapshot()` | 자동 백업 스냅샷 생성 / IndexedDB 저장 ('지난 작업' 배너 대기 중엔 쓰지 않음, 이번 세션에 직접 다 지운 경우만 백업 비움). 학원 저장소 리포트를 열어 둔 경우 `cloud` 표시(리포트 id·저장본 번호)와 '못 올린 변경' 여부를 함께 저장 |
| `saveAppData()` | 데이터 변경 → 미저장 표시 + 백업 예약(300ms) + 학원 저장소 자동 저장 예약(`cloudOnChange`) |
| `saveSession()` | 선택 변경 → 백업 예약만 |
| `saveAppDataNow()` | 즉시 백업 |
| `checkRecovery()` | 시작 시 백업이 있으면 '지난 작업 이어하기' 배너 표시 |
| `restoreFromBackup()` / `dismissRecovery(byUser)` | 백업 복구 / 배너 닫기 (저장 안 된 백업이면 확인) |
| `showGroups(keepSelection)` | 데이터 로드 후 버튼 표시 + 날짜 뷰 진입 |
| `zeroStart()` | 엑셀 없이 직접 시작 (저장 안 된 '지난 작업' 백업이 있으면 확인) |
| `autoSelectDate()` | 오늘 이후 가장 가까운 수업 날짜 선택 |
| `markUnsaved()` / `markSaved()` | ⚠ 미저장 표시 |

## js/autofill.js
| 함수 | 역할 |
|---|---|
| `_resolveCarryRef(ref,student)` | ref → 과제 텍스트·출제일 (이월 전파용) |
| `propagateCarryover(student,date,ref,status)` | 상태 변경 → 다음 수업 이월 레코드 생성/삭제 |
| `flushPropagations()` | 보류된 이월 전파 일괄 적용 |
| `buildAllCarryover()` | 엑셀 로드 후 전체 이월 전파 |
| `computeCarryover(student,date)` | 직전 수업의 미완료·부분완료 항목 수집 |
| `_hwDisabledSet()` | 현재 학생·날짜의 OFF 집합 (없으면 생성) |
| `_curHwOnOffItems()` | 다음 수업까지 과제 목록 구성 (본과제·추가·문제 노트(kind `'note'`, `noteNextItems`)·이월, ref 포함) |
| `autoSyncHwDisabled()` | 지난 과제 상태에 따라 이월 항목 자동 ON/OFF |
| `updateNoticeWithCarry()` | 리포트 '다음 수업까지 과제' (문제 노트 항목은 `.next-hw-li.note-li`, 없으면 '별도 과제 없음') |
| `renderCurHwList()` / `toggleHwDisabled(i)` | 패널 과제 ON/OFF 목록('(문제 노트)' 배지 포함) / 토글 |
| `renderExtraHwEditor()` | 패널 추가 과제 에디터 |
| `renderLessonInfo()` | 수업 정보 → 리포트 헤더 날짜·진도·과제 기본 목록 |
| `autoFillCommon()` | 날짜 기준 공통 채우기 (`renderLessonInfo` + 요약 카드) |
| `getPrevExtraHw(student,date)` | 직전 수업의 학생별 추가과제 텍스트 |
| `autoFillAll()` | 학생+날짜 전체 채우기 (과제 재구성·이행률·그래프·미니테스트·코멘트·A4 맞춤) |

## js/report.js
| 함수/상수 | 역할 |
|---|---|
| `MASCOT_IMGS` / `MASCOT_DIR` / `registerMascots(tier,files)` | 마스코트 이미지 등록 |
| `updateRateFace()` | 이행률 등급별 마스코트 표시 (학생이 고른 캐릭터만) |
| `openMascotPicker(e)` | 마스코트 선택 팝업 |
| `rebuildGraph()` | 최근 4회 이행률 그래프 (결석은 회색 '결석') |
| `renderHwEditor()` | 패널 과제 검사 목록 (`data-i`) + 상태 개수 `#hwCounts` |
| `addExtraHw()` / `removeExtraHw(i)` / `updateExtraHwText(i,v)` | 학생별 추가 과제 관리 |
| `_rateStatuses()` | 이행률 계산 대상 상태 (이월·(선택)·OFF 제외) |
| `applyRate(v,manual)` | 이행률 값 적용 (입력칸·G.rates·리포트·그래프) |
| `autoCalcRate()` | ↻ 재계산 (과제 상태 기준으로 되돌림) |
| `onRateManual()` | 이행률 직접 입력 (0~100 보정) |
| `refreshRateSection()` | 리포트 이행률 영역 (첫 수업·미입력 숨김, 결석은 '이번 수업 결석' + 진도 라벨 '빠진 수업 내용') |
| `hwBtnLabel(s)` | 상태 버튼 라벨 |
| `cycleHwStatus(i)` | 과제 상태 순환 (없음→완료→부분완료→미완료) |
| `markAllHwDone()` | 비어 있는 과제를 모두 '완료' (이월·선택 과제 제외) |
| `markAllStudentsHwDone()` | 결석 아닌 학생 전원의 검사 안 한 과제를 '완료' + 이행률 재계산 (전원 과제 완료) |
| `confirmMissingInputs(date)` | 일괄 PDF·ZIP 전 빠진 입력(출결·숙제 검사·미니테스트·한마디)과 문항 수를 벗어난 오답 번호 점검 확인창 |
| `_queueCarry(i,status)` / `_afterHwStatusChange(before)` | 이월 전파 예약 / 상태 변경 공통 후처리 (계산 대상 상태가 바뀐 경우에만 이행률 자동 계산) |
| `updateHeaderDate(cur,next)` | 리포트 헤더 날짜·진도 날짜 |
| `updateHwDisplay()` | 리포트 '지난 수업 과제' (이월 2단 레이아웃) + 문제 노트 숙제 결과(`noteCheckRows` — 상태가 없는 과제만 있어도 결과가 있으면 표시) |
| `updateNoticeList(text)` | 과제 기본 목록 (학생 미선택 시) |
| `renderMiniPanel()` / `onMiniInput()` / `onWrongInput(v)` | 미니테스트 입력칸 채우기 + 범위 밖 오답 번호 경고(`#miniWarn`) / 문항 수·범위·맞힌 수 저장 / 오답 즉시 저장 |
| `updateMiniSection()` | 리포트 미니테스트 (점수·범위·다시 볼 문제, 기록 없으면 숨김) |
| `renderCommentPanel()` / `onCommentInput()` / `onTeacherInput()` | 선생님 한마디 입력칸 / 코멘트 저장(G.journalNote) / 서명 저장 |
| `updateCommentSection()` | 리포트 선생님 한마디 (코멘트 있을 때만) |
| `fitReportCard()` | A4 넘치면 `.dense` → `.dense2`(2단 목록)로 자동 맞춤 |
| `setAttend(val)` | 출결 토글 (재클릭 = 미선택) |
| `markAllPresent()` | 출결 미체크 학생 전원 출석 |
| `updateAttendUI()` | 출결 버튼·미체크 인원 표시 (첫 수업일 포함) |

## js/pdf.js
| 함수/상수 | 역할 |
|---|---|
| `_processPdfFile(file)` | 첨부 PDF 첫 페이지 → 캔버스 (세션 한정) |
| `_addPdfToStudent` / `_getStudentPdfCanvases` / `_syncGlobalPdf` | 학생별 첨부 관리 / 캔버스 목록 / 현재 학생 첨부를 `G.pdfCanvases`로 |
| `handlePdfInput(input)` | 첨부 파일 처리 (이 학생 / 모든 학생) |
| `inlinePdfAttach()` / `_showInlineMenu()` / `_closePdfMenu()` / `_closePdfMenuOnClick(e)` | 리포트 옆 + 버튼 메뉴 |
| `attachPdfForStudent(name)` / `removeAllStudentPdfs(name)` | 학생 첨부 교체 / 삭제 |
| `renderSpread()` / `_addPdfDelBtn(slot,name)` / `drawPdfPrev(tgt,src)` | 리포트 + 첨부 미리보기 |
| `_downloadBlob(blob,name)` | 다운로드 (1.5초 후 URL 해제) |
| `_canvasToBlob` / `_canvasToJpgBlob(cv,w)` | 캔버스 → Blob / 폭 w JPG |
| `_safeName(s)` / `_mmdd(date)` / `KAKAO_W` | 파일명 정리 / MMDD / 카톡 이미지 폭(1080) |
| `_captureReportCard(scale)` | 리포트카드 원본 크기 캡처 |
| `_captureOffscreen(elOrHtml,width)` | 화면 밖 캡처 (try/finally 정리) |
| `_addReportPages(doc,report,attach)` | 첨부 없으면 세로 A4 1쪽, 있으면 가로 A4 2장 나란히 (JPEG) |
| `dlPdf()` | 현재 학생 리포트 PDF |
| `toggleToolbarMenu(id)` / `closeToolbarMenus()` | 툴바 드롭다운 |
| `dataUrlToBytes(u)` | dataURL → Uint8Array |
| `_eachStudentCapture(names,label,scale,fn)` | 학생을 차례로 바꿔 캡처 (진행 표시, 끝나면 원래 학생 복원) |
| `_doBatchPdf()` | 일괄 PDF (결석 제외, 대상 0명이면 중단) |
| `dlReportImage()` | 카톡용 JPG 저장 (첨부 있으면 시험자료 JPG도) |
| `dlKakaoZip()` | 학생별 JPG 묶음 ZIP (JSZip) |
| `dlGradeSummary()` / `_renderGradeTable` / `_downloadGradeImage` | 이행률 요약표(전체) 모달·표·이미지 |
| `_journalReportDates(date)` | 일지표 집계 기간 (최근 6회) |
| `_defaultJournalPlan(date)` | '다음 수업 계획' 기본값 = 다음 수업의 단원 — 상세진도 |
| `dlJournalReport()` / `_renderJournalInputs` / `_saveJournalInputs` | 수업 일지표 입력 모달 (진도 편집값은 기본값과 다른 항목만 저장) |
| `_buildJournalReportPages(date)` | 일지표 페이지 HTML (출결 분류·이행률표·미니테스트 오답 집계·숙제 오답 집계(`noteWrongTally`)·학생별 숙제 검사·문제 노트 결과(`noteCheckRows`)·미니테스트·코멘트) |
| `_renderJournalPdf(date)` | 일지표 A4 PDF |
| `_stuRptRemoveItem(key)` / `dlStudentReport(pre)` / `_renderStudentReport(...)` | 학생별 이행률 요약표 모달·렌더 ('기록 회차', 분모에서 '없음' 제외) |
| `_collectIncomplete(student,dates,removed)` / `_incompleteHtml(inc,boxed)` | 미완료 과제 수집 / HTML (공용) |
| `_buildStudentReportEl(...)` | 요약표 캡처용 요소 |
| `_attachSummaryForCurrent()` / `_attachStudentReportToView(...)` | 요약표를 리포트 옆에 첨부 — 보고 있는 리포트 날짜까지, 최근 `SUMMARY_ATTACH_MAX`(6)회만 (반쪽에 들어가도 글자를 읽을 수 있게) |
| `_pageCuts(canvas,pageH)` | 긴 캔버스를 여러 쪽으로 나눌 위치 계산 — 쪽 끝 근처의 흰 줄(카드 사이 여백)에서 자름 |
| `_downloadStudentReportPdf(...)` | 요약표 PDF — 폭 400pt로 두고 길면 `_pageCuts`로 여러 쪽 A4 세로로 나눔 (파일명은 `_safeName`) |
| `showUpdateModal()` | 업데이트 내역(updates.md) 모달 |

## js/init.js
| 함수 | 역할 |
|---|---|
| `loadMascotImages()` | 마스코트 이미지 파일 등록 |
| `initPanelResize()` | 패널 드래그 리사이즈 |
| `window.onload` | 앱 진입점 (IndexedDB → 배율 → 마스코트 → 보기 설정 → 지난 작업 확인 → 학원 저장소 `cloudInit`) |
| (keydown) | ESC: 동적 모달·수업설정 닫기 / Ctrl+S: 엑셀 저장 (학원 저장소 리포트를 열어 둔 경우 `cloudSaveNow`) |

## js/cloud.js (학원 저장소 · 숙제 채점 · 오답 다시 풀기 · 앱 사이 이동, v1.83~v1.85)
서버는 문제 노트 사이트(mathpro.app)의 Worker — 이 앱에는 서버 코드가 없다. 상태는 `G`가 아니라 별도 객체 `CLOUD`.
| 함수 | 역할 |
|---|---|
| `cloudInit()` | 시작 시(지난 작업 확인 뒤) 로그인·학원 복원 → 문제 노트에서 넘어온 로그인 받기(`_cloudConsumeHandoff`) → 숙제 캐시 복원 → 서버 설정 확인(`/api/auth/config`; ☁ 버튼은 늘 보임) → 숙제 받기 · 열어 두었던 리포트 이어 열기 |
| `cloudApiBase()` | 서버 주소 (기본 `https://mathpro.app`, localStorage `rs:apiBase`로 바꿀 수 있음 — 시험용) |
| `cloudSignIn(credential)` / `cloudSignOut()` | 구글 ID 토큰 → 세션 토큰 저장(`rs:auth`) / 로그아웃 (연결 끊고 숙제·기록 캐시 비움) |
| `cloudUploadExcel(input)` | ☁ 창의 '엑셀 파일을 학원 저장소에 올리기' — 엑셀을 읽어(실패 시 롤백) 곧바로 새 학원 리포트로 올리고 연결 (제목 = 파일 이름; 올리기 실패 시 이 기기에서만 열림) |
| `openNoteApp(go)` | 📘 문제 노트 — 새 탭을 먼저 열고, 로그인했으면 넘김 코드(`/api/auth/handoff`, 2분)를 받아 `{apiBase}/{학원}#mph=…`로. `go` = 갈 곳(`'student:이름'` 그 학생 오답·기록 · `'classroom'` 숙제·채점) → `&go=` |
| `_cloudConsumeHandoff()` | 주소의 `#mph=<code>&t=<학원>&go=<갈 곳>`을 즉시 지우고 `/api/auth/redeem` → 새 세션·학원 선택, `go=student:이름`이면 `CLOUD.goStudent` (문제 노트에서 넘어올 때) |
| `_cloudApplyGo()` | 넘어온 학생(`CLOUD.goStudent`)이 이 리포트에 있으면 그 학생으로 (`switchTab`) — 리포트가 화면에 올라온 뒤(`_cloudShow`·`cloudInit`) |
| `cloudChangeTenant(path)` | 학원 바꾸기 (여러 학원에 등록된 선생님) |
| `openCloudModal()` / `_renderCloudModal()` | ☁ 학원 저장소 창 — 로그인·리포트 목록·열기·올리기·빈 리포트·삭제·연결 끊기 |
| `cloudOpenBook(id)` / `cloudUploadCurrent()` / `cloudCreateBlank()` / `cloudDeleteBook(id)` / `cloudDisconnect()` | 리포트 열기 / 지금 화면을 새 리포트로 올리기 / 빈 리포트 만들기 / 삭제(휴지통) / 연결 끊기 |
| `cloudResume()` | 열어 두었던 리포트 이어 열기 — 이 기기 백업에 못 올린 변경이 있으면 이어서 올리거나(저장본 번호 같음) 어느 쪽을 쓸지 묻기 |
| `cloudOnChange()` / `_cloudSave(force)` / `cloudSaveNow()` | 변경 → 1.5초 뒤 자동 저장 (`baseRev` 확인, 409면 충돌 안내, 실패하면 점점 늦춰 재시도) / 즉시 저장 |
| `_cloudConflict()` | 저장 충돌 — 학원 저장소 버전 불러오기 · 내 버전으로 덮어쓰기 · 내 버전 엑셀로 받아두기 |
| `cloudDetach()` / `cloudActive()` / `cloudIsDirty()` / `cloudSnapshotTag()` | 연결 끊기 / 열어 둔 리포트 있음 / 못 올린 변경 있음 / 자동 백업에 붙일 표시 |
| `_cloudPayload()` / `_cloudApply(src)` | `DATA_KEYS` 전체 ↔ 저장 형식 (hwDisabled의 Set ↔ 배열) |
| `_cloudStatus()` / `cloudStatusClick()` | 패널 상단 저장 상태(#cloudStatus: 저장됨·저장 중·대기·실패·충돌·로그인 필요) + 📘 문제 노트 버튼 표시(로그인했을 때만) |
| `cloudLoadNotes()` | 숙제 받기 + **이 리포트 학생 전원**의 문제 기록 받기(`_fetchRecsMany` — 40명씩 한 번에) (창으로 돌아올 때 1분에 한 번), 이 기기에 캐시(`rs:notes`) |
| `_fetchRecsMany(students)` / `_fetchRecs(student,force)` | 여러 학생 기록 한 번에(`GET records?many=1`, 40명씩 — 예전 서버라 `students`가 없으면 한 명씩으로) / 한 명 (저장 중인 학생은 건너뜀, `force` = 저장 실패 뒤 서버 값으로 되돌림). 기록 = `{items, missing}` |
| `_nStatus(h)` / `_nUpto(h,d)` / `_nBefore(h,d)` / `_nPending(st)` | **공통 규칙**(문제 노트 `src/lib/classroomRules.js`와 한 벌) — 상태: 맞음 · 틀림 · 확인 중(틀린 뒤 다른 날 1번 맞힘) · 해결(다른 날 2번, `NOTE_SOLVE_STREAK`) / 그날까지 / 전날까지 / 오답(틀림+확인 중) |
| `_hwGiven(hw,ds)` / `_hwCheck(hw,ds)` / `_onOrAfter` / `_after` / `_before` | 나눠 주는 수업(숙제 날짜 당일 또는 그 뒤 첫 수업) / 검사하는 수업(그다음 수업, `due`가 있으면 그날 또는 그 뒤 첫 수업) / 수업 날짜 찾기 |
| `_hwRes(student,hw)` | 학생 × 숙제 채점 결과 `{marks, marked, wrong, correct, total, missing(안 해 옴 날짜), gradedAt}` |
| `_hwCheckAt(student,date)` / `_hwGivenAt(student,date)` | 이 수업에 검사할 숙제(+안 해 와서 이월된 숙제 — 그 수업에 채점하면 그대로 보임) / 이 수업에 나가는 숙제(+이월) — `[{hw, carry}]`. 나눠 준 수업에서 `mp:<숙제 id>`를 OFF 했으면 검사 없음 |
| `_wrongGivenAt(student,date)` / `_wrongCheckAt(student,date)` | 이 수업까지 남은 오답(다음 수업까지 과제의 '오답 다시 풀기') / 이 수업에서 검사할 오답(바로 전 수업까지 오답이고 전날까지도 오답, 전 수업에서 `mp:wrong` OFF면 없음) |
| `_sourceOf` / `_chipName` / `_paperName` / `_wrongSummary` / `_problemOrder` | 문제가 마지막으로 나온 숙제 / 칩 이름("20강 5") / 받은 종이 이름("숙제 · 20강 5번") / 리포트용 짧은 목록("20강 2·5번, 21강 3번") / 문제 순서 |
| `noteNextItems(student,date)` | '다음 수업까지 과제'에 붙는 문제 노트 항목 `[{text, ref}]` — `📘 숙제 (N문제)`(ref `mp:<id>`) · `(이월) 📘 …` · `📘 오답 다시 풀기 N문제 — …`(ref `mp:wrong`). `_curHwOnOffItems`가 kind `'note'`로 넣는다(ON/OFF 가능) |
| `noteCheckRows(student,date)` | '지난 수업 과제'에 붙는 결과 `[{text, chip, st, sub}]` — `12/15 맞음 · 다시 볼 문제 3·7번` / `안 해 옴` / `오답 다시 풀기 2/3 맞음` (`updateHwDisplay`·수업 일지표) |
| `noteWrongTally(date)` | 수업 일지표용 — 이 날짜에 검사한 숙제별 많이 틀린 문제 `[{title, top:[[번호, 명]]}]` |
| `renderNotePanel()` / `_hwHtml({hw,carry})` / `_wrongHtml(st,date,ids)` | 숙제 채점 카드(#noteHwCard, 지난 수업 과제 검사 바로 아래) — 숙제별 단원 칩(맞음 초록·틀림 빨강·틀린 횟수 배지·주황 점 = 3번 이상), 모두 맞음·모두 틀림·안 해 옴 / 나머지 맞음 / 채점 지우기, 오답 다시 풀기(✓1 = 확인 중), 오늘 나간 숙제 안내, 문제 노트 ↗. #btnClassGrade 표시도 |
| `_noteClick(e,st,date)` | 카드·반 전체 창의 칩·버튼 → 채점 (처음 누르면 그 문제 틀림 + 나머지 맞음, 그 뒤 맞음↔틀림; 숙제는 처음 채점한 날짜의 기록을 고침) |
| `_noteMark(student,hwId,marks,flag)` | 채점 표시 저장 — 화면 먼저 반영, 학생별 줄로 순서대로 `POST records`(날짜별), `flag = {missing, date}` = 안 해 옴 표시·풀기, 실패 시 다시 받기 |
| `openClassGrade()` / `_renderClassGrade()` / `_closeClassGrade()` | 📘 숙제 채점(반 전체) 창 — 이 수업에 검사할 숙제마다 학생 줄 × 문제 칸 표(줄마다 모두 맞음·모두 틀림·안 해 옴·지우기, 틀린 학생 수) + 오답 다시 풀기(학생마다 칩) |
| `noteUngradedNames(date,students)` | 이 수업에 검사할 숙제를 아직 채점하지도, 안 해 옴으로 표시하지도 않은 학생 (보내기 전 점검) |
