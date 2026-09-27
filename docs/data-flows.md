# 데이터 흐름

## 1. 엑셀 파싱

```
loadExcel() → XLSX.read(arrayBuffer) → parseWB(wb)
  [1] '수업정보' 시트 → G.lessons[]
      신규 형식: 날짜(0) 교재(1) 단원(2) 상세진도(3) 과제1~N(4+, 동적)
      구 형식 (강사명 포함): 날짜(0) 강사명(1) 교재(2) 단원(3) 상세진도(4) 과제1~N(5+)
      → 헤더에 '강사명' 유무로 자동 감지, 과제 열은 '과제' 접두사로 동적 감지
      날짜 오름차순 정렬, 전체문제수 기본값 5

  형식 감지: SheetNames에 YYYY-MM-DD 패턴 존재 → 신규 형식, 없으면 구 형식

  [2-A] 신규 형식 (날짜별 시트) ← 현재 기본 형식
      첫 번째 날짜 시트 → G.students[] 순서 결정
      각 날짜 시트 파싱 → G.corrects, G.wrong, G.rates, G.hwRec
        열: 이름(0) 성적(1) 오답(2) 이행률(3) 과제1~N_상태(4+, 동적) 비고(마지막, 무시)
        과제 상태: 숫자(0/1/2) 또는 기호(○/△/X) → stFromExcel()로 변환

  [2-B] 구 형식 (하위 호환)
      '성적' 시트 → G.students[], G.corrects, G.wrong
      학생별 시트 → G.hwRec, G.rates

  [3] '이월과제' 시트 → hwRec[key].items (carry 항목만)
      ▼ 구분행 무시, 학생·확인날짜·과제내용·원본날짜·상태 파싱

  [4] hwRec items 재구성: base(날짜시트) + carry(이월과제시트) 병합

  [5] buildAllCarryover(): 전체 날짜·학생 순회 → 미완료/부분완료 항목의 이월 레코드 자동 생성

→ saveAppData() → showGroups() → autoSelectDate()
```

## 2. 뷰 전환 시스템

```
showGroups()
  → autoSelectDate()    오늘 이후 가장 가까운 날짜 자동 선택
    → selectDate(date)
      → G.selDate = date
      → switchView('date')
        → renderDateSummary()   수업정보 요약
        → renderTabs()          학생 사이드바
        → renderDateNav()       상단 날짜 네비게이션 바
        → renderDateSidebar()   우측 세로 날짜 사이드바
        → autoFillAll()         전체 자동채우기

switchView('config')
  → openLessonModal()    수업설정 전체화면 모달 열기
    → renderLessonCards()   수업 날짜별 카드 UI
    → renderStudentList()   학생 목록 UI

날짜 선택 (3가지 경로):
  1. 상단 네비: navDatePrev()/navDateNext() 또는 날짜 클릭 드롭다운
  2. 우측 세로 날짜 사이드바: 직접 클릭
  → 모두 selectDate(date) 호출

수업설정 접근:
  상단 ⚙ 설정 메뉴 → '수업 진도 설정' → openLessonModal()

수업설정 뷰에서 레슨 편집:
  updateLessonField(idx, field, value)
    → G.lessons[idx][field] = value
    → if (현재 선택 날짜) syncLessonToReport()
      → hidden inputs 갱신 → fp() → 리포트카드 동기화
```

## 3. IndexedDB 자동 백업·복구 (v1.80)

```
window.onload()
  → try openDB() (실패해도 앱은 동작 — 백업만 비활성)
  → updateScale() + resize 리스너 등록
  → loadMascotImages() / initPanelResize() / applyViewSettings()
  → dbSet('studentPdfs',null)   구버전 첨부 잔재 정리 (첨부는 세션 한정)
  → checkRecovery()             'appData' 스냅샷이 있으면 #recoverBanner 표시 (자동 복원은 하지 않음)

restoreFromBackup()  (배너 '이어하기')
  → DATA_KEYS 필드 + fileName·pendingPropagations·selDate·selStudent 복원
  → applyViewSettings() → showGroups(true) (저장돼 있던 날짜·학생 선택 유지)
  → 스냅샷의 unsaved 플래그대로 ⚠ 미저장 표시
```

저장 시점:

| 함수 | 동작 | 시점 |
|---|---|---|
| `saveAppData()` | 미저장 표시 + 백업 예약(300ms) | 데이터 변경 (과제 상태·출결·입력·수업 편집 등) |
| `saveSession()` | 백업 예약만 (미저장 표시 없음) | 날짜·학생 선택, 뷰 전환 |
| `saveAppDataNow()` | 즉시 백업 | 엑셀 로드·저장 직후 |
| `saveTabData()` | 현재 학생 작업 → G.tabData + hwRec 동기화 | 학생·날짜 전환, 엑셀 저장 |

`_writeSnapshot()`은 수업·학생이 모두 비어 있으면 기존 백업을 덮어쓰지 않는다. `dbSet`은 트랜잭션 오류·중단 시 reject한다(무한 대기 방지).

## 4. 학생 탭 전환

```
switchTab(name)
  → saveTabData()       현재 학생 입력값 → G.tabData
  → G.selStudent = name
  → renderTabs()        학생 사이드바 갱신
  → _syncGlobalPdf()    학생별 PDF 동기화
  → renderSpread()      PDF 미리보기 갱신
  → if(G.selDate) autoFillAll()
  → updateAttendUI()    출결 토글 갱신
  → saveSession()
  → 리포트카드 슬라이드 애니메이션 (.rc-transition)
```

## 5. 미니테스트 (v1.80)

```
입력 (패널 #gMini)
  문항 수·범위 → G.miniTest[날짜]={total,range}   (반 공통, onMiniInput)
  오답 번호    → G.wrong[학생][날짜]              (입력 즉시 저장, onWrongInput)
  맞힌 수      → G.miniScore["학생||날짜"]        (직접 입력한 경우만)

miniResult(학생,날짜)  (js/domain.js)
  → 결석이거나 그 학생 입력(오답·'0' 만점 표시·맞힌 수)이 없으면 null → 리포트 #secMini 숨김
     (반 공통 문항 수만 있고 학생 입력이 없으면 '만점'이 아니라 미입력)
  → correct = 직접 입력값 ?? (문항 수 − 오답 개수), 문항 수를 넘지 않게 보정, pct = correct/total
  → perfect: 문항 수가 있고 맞힌 수 = 문항 수이며 오답이 없을 때 (오답칸 '0'·'없음'·'만점' = 다 맞음)

updateMiniSection() → #rMiniScore(3/5 · 60%) · #rMiniRange(범위) · #rWrongTags(다시 볼 문제)
```

## 6. 이행률 데이터 흐름

```
이행률 값 규칙:  (※ 이행률은 출결과 무관 — 결석 판정은 attend로만 한다)
  null / undefined  = 이행률 없음 (그래프에서 제외)
  -1                = 표시 안 함 (리포트에 '-' 표시, 그래프 제외)
  0~100             = 정상 이행률 (직접 입력은 0~100으로 보정)

계산 규칙 (js/domain.js calcRate):
  완료=100, 부분완료=50, 미완료=0 의 평균(반올림). '없음'·이월과제·(선택) 과제·직전 회차 OFF 과제는 제외
  모든 상태를 '없음'으로 되돌리면 자동 계산값도 비움 (직접 입력값은 유지)
  markAllStudentsHwDone(): 결석 아닌 학생 전원의 '없음' 과제만 완료로 + 학생별 이행률 재계산
등급 (RATE_TIER): 75% 이상 양호 / 30~74% 보통 / 30% 미만 미흡 — 리포트·요약표·일지표·마스코트 공통

cycleHwStatus(i) / markAllHwDone()
  → _queueCarry()          이월 전파 예약 (pendingPropagations)
  → _afterHwStatusChange() → renderHwEditor() → calcRate(_rateStatuses()) → applyRate(값,false) (자동 계산)
                            → updateNoticeWithCarry() → syncHwRecItems() → saveAppData()

onRateManual()  (직접 입력) → 0~100 보정 → applyRate(값,true) (hwRateManual=값)
autoCalcRate()  (⚡ 다시 계산) → 과제 상태 기준으로 되돌림
applyRate()     → #inputRate · G.rates · refreshRateSection() · rebuildGraph()

refreshRateSection(): 첫 수업·값 없음 → 숨김 / 결석 → '결석' / -1 → '-' / 그 외 숫자

rebuildGraph()
  → G.rates[학생][날짜] (현재 날짜 이하, 첫 날짜 제외, -1 제외) + 결석일
  → 최근 4개 slice(-4) → SVG polyline(결석 제외) + circle + text
  → 결석 점은 가운데 높이에 회색 점선 원 + '결석' (0%와 구분)
```

## 7. PDF·이미지 생성 (학생별 첨부)

```
PDF 첨부 흐름 (세션 한정 — 저장·복원하지 않음):
  inlinePdfAttach() → _showInlineMenu() → "이 학생" / "모든 학생" / "이행률 요약표" 선택
  → handlePdfInput() → _processPdfFile(file)
    → 첫 페이지만 추출 (pdfjsLib로 렌더, 상5%·하6% 크롭) → 캔버스
    → G.studentPdfs[학생명].push({name, canvases, pageCount:1})
  학생 전환 시: _syncGlobalPdf() → G.pdfCanvases를 현재 학생 기준 갱신

dlPdf()
  → _captureReportCard(2) → reportCanvas
  → _addReportPages(doc, reportCanvas, G.pdfCanvases)
      첨부 없음: A4 세로 1쪽 (여백 18pt) / 첨부 있음: A4 가로에 리포트+시험자료 2장 나란히
      이미지는 JPEG로 임베드 (용량 축소)
  파일명: {학생명}_{날짜}_리포트.pdf

_doBatchPdf()  (메뉴 > 일괄 PDF, 대상 = isReportEligible, 0명이면 중단)
  → _eachStudentCapture(): 학생을 차례로 G.selStudent 전환 + autoFillAll() → 캡처 (진행 표시)
     try/finally로 원래 학생·미리보기 opacity 복원
  → 학생별 _addReportPages → 일괄리포트_{날짜}.pdf

dlReportImage()   → 폭 1080px JPG `{학생}_{MMDD}.jpg` (+ 첨부 있으면 `_시험자료.jpg`)
dlKakaoZip()      → 대상 학생 전원 JPG(+시험자료) → JSZip → 리포트이미지_{날짜}.zip
```

## 8. 엑셀 저장

```
saveToExcel()  → 성공 true / 실패 false 반환 ('저장 후 제거'는 성공 시에만 데이터 삭제)
  → saveTabData()       현재 학생 작업 → hwRec (다른 학생은 전환 시 이미 반영됨)
  → flushPropagations() 보류된 이월 전파 적용
  → XLSX 워크북 생성:
    수업정보 시트: [ID, 날짜, 교재, 단원, 상세진도, 과제1~N] (동적 열)
    날짜별 시트: [이름, 출결, 오답, 과제이행률, 과제1~N(숫자상태), 추가과제1~M(extraHw), 비고]
      과제 열 수 = max(4, 직전 수업 과제 수 + 직전 수업 학생별 추가과제 최대 수)
      출결 열: G.attend 선택값 그대로 (0/1/2, 미선택은 공란)
      이행률 열: 결석이면 '결석' 문자열
      비고 열: `[이월] 과제 (MM.DD 출제) → 상태, …` 자동 요약 + ` | ` + 사용자 메모
    이월과제 시트: [학생, 확인날짜, 참조, 상태] (▼ 날짜 블록 구분)
    설정 시트: ▼ 스티커 / ▼ 과제OFF / ▼ 수업일지코멘트 / ▼ 수업일지계획 / ▼ 수업일지진도 /
               ▼ 미니테스트 / ▼ 미니테스트점수 / ▼ 강사 / ▼ 보기설정 / ▼ 마지막저장
      "학생||날짜"·날짜 키는 현재 학생·수업 날짜에 해당하는 것만 저장 (고아 데이터 정리)
  → 다운로드 → markSaved() → saveAppDataNow() (백업에 '저장됨' 반영, 결과를 기다리지 않음)

loadExcel()
  → 저장 안 한 작업(현재 또는 '지난 작업' 백업)이 있으면 확인창
  → 파싱 전 DATA_KEYS 백업 → parseWB() 실패 시 원래 데이터로 되돌림
     (수업정보·날짜 시트가 없는 파일은 '학습 리포트 형식이 아님' 오류)
  → 성공 시 이전 파일의 작업 상태(tabData·pendingPropagations·첨부·현재 학생 과제 상태) 초기화
  → .xls 파일은 .xlsx 이름으로 저장
```

## 9. 캐리오버 시스템

```
autoFillAll()
  → hwRec[key].items 있으면 그대로 사용 (parseWB에서 구축된 ref 보존)
  → 없으면: 직전 레슨 과제 + 추가과제 + computeCarryover() 결과를 조합
  → G.hwItems = [텍스트], G.hwItemRefs = [{ref, fromDate}], G.hwStatus = [상태]
  → 이월 판별: isCarryItem(fromDate) — fromDate !== 직전수업날짜

cycleHwStatus()
  → updateNoticeWithCarry()
    → 이번 주차 과제 = 현재 레슨 hw + 현재 미완료 이월 항목
    → 리포트카드 #rNoticeList 갱신
  → propagateCarryover(student, date, ref, newStatus)
    → status 0/1: 다음 날짜 hwRec에 이월 레코드 추가 (없으면 생성, status -1)
    → status 2/-1: 이후 모든 날짜에서 해당 ref 이월 레코드 삭제 (체인 종료)

saveTabData()
  → syncHwRecItems()
    → G.hwItems/hwStatus/hwItemRefs → hwRec[key].items 배열 동기화
    → 모든 항목 통일 구조: {text, status, ref, fromDate}
```

## 10. 출결 판정 (선택 기반)

```
출결은 "실제로 선택한 값"만 기준. 이행률(rates)로 출석/결석을 추정/보정하지 않는다.
판정 규칙은 js/domain.js (도메인 계층)에 단일화:
  attOf(s,d)            → 2/1/0, 미선택은 undefined (구버전 -1도 미선택)
  isAbsent(s,d)         → attOf===0 (명시적 결석만)
  isPresent(s,d)        → 2 또는 1
  isReportEligible(s,d) → 결석이 아니면 true (일괄 PDF·이미지 ZIP 대상)
  attendCategory(s,d)   → 'present'|'late'|'absent'|'none'

setAttend(v): 같은 버튼 재클릭 → 키 삭제(미선택). (v1.80 이전에는 -1로 저장되어 요약·일괄 PDF에서 조용히 빠졌음)
markAllPresent(): 미체크 학생만 출석(2)으로 — 결석·지각만 따로 누르면 됨
updateAttendUI(): 첫 수업일에도 표시, #attendUnset에 '미체크 N명'
영향 받는 화면(모두 domain 규칙 호출):
  리포트 이행률('결석')·그래프, saveToExcel(출결 열), 이행률 요약표·수업일지표·일괄 PDF·이미지 ZIP 대상 판정
```

## 10-1. 날짜·학생 키 데이터 이동 (v1.80)

```
updateLessonDate(idx,new) → 앞뒤 수업을 건너뛰어 순서가 바뀌면 차단(alert) → renameDateData(old,new)
  → "학생||날짜" 키(hwRec·memos·hwDisabled·journalNote·miniScore), 학생→날짜(rates·wrong·attend),
    날짜 키(journalPlan·journalInfo·miniTest), 과제 항목 fromDate, 이월 예약(date)을 모두 새 날짜로
removeLesson(idx) → removeDateData(date) 같은 범위를 삭제
removeLessonHw(idx,hwIdx) → _remapLessonHwRefs(lessonId,n): 삭제된 과제 ref 기록 제거, 뒤 번호 ref 당김
renameStudent(old) / _doRemoveStudent(idx) → 학생 키가 들어간 모든 저장소 이동/삭제
rebuildAllHwItems() → 상태는 rec.items의 ref로 찾고, base 항목이 하나도 없을 때(엑셀 로드 직후)만
                      순번 필드(빈 과제 건너뜀) 사용 → 끝에서 순번 필드(과제N_상태)를 items 순서로 재생성,
                      원본 수업이 삭제된 이월·(선택) 과제 이월 항목은 제거
closeLessonModal() → 모달이 실제로 열려 있었을 때만 tabData 초기화 + rebuildAllHwItems() + autoFillAll()
```

## 11. 이번 주차 과제 ON/OFF 영속화

```
toggleHwDisabled(idx)
  → G.hwDisabled["학생||날짜"](Set)에 과제 ref add/delete
  → saveAppData()

저장: saveToExcel() → 설정 시트 ▼ 과제OFF 섹션에 [학생||날짜, ref] 기록
복원: parseWB() → ▼ 과제OFF 파싱 → G.hwDisabled[key] = Set(ref들)

다음 주차 반영:
  renderHwEditor()/updateHwDisplay()가 직전 주차에서 OFF된 과제(isHwOff)를 체크목록에서 제외
  → "이번 주차에 OFF한 과제는 다음 주차 숙제로 나타나지 않음"
```

## 12. 수업 일지표 (원장님 보고용, 멀티페이지 PDF)

```
dlJournalReport()  [메뉴 > 리포트 모아보기 > 📓 수업 일지표]
  → 모달: 날짜 선택 + 오늘 진도/과제(기본=레슨, 수정 가능) + 다음 수업 계획 + 학생별 코멘트(결석 포함 전원)
  → 입력값은 날짜별 저장 (_saveJournalInputs):
      G.journalInfo["날짜"] = 레슨 기본값과 **다른** 항목만 {book?,chapter?,detail?,hwText?}
      G.journalNote["학생||날짜"] = 코멘트 (리포트 '선생님 한마디'와 같은 데이터), G.journalPlan["날짜"] = 계획
  → 영속화: 엑셀 설정 시트 ▼ 수업일지진도 / ▼ 수업일지코멘트 / ▼ 수업일지계획

PDF 생성: _renderJournalPdf(date)
  → _buildJournalReportPages(date): 페이지 HTML 배열
      1쪽: 헤더 + 수업정보(진도·과제) + 출결현황(출석·지각(표기)·결석, 미체크는 회색 줄)
           + 숙제 이행률표(최근 6회차, 결석 회차는 평균 제외) + 반 전체 오답 집계(상위 8개)
      2쪽~: 학생별 카드(출결 배지·기간평균·숙제 검사 칩 ✓△✗/이월·미니테스트 결과·코멘트)
            카드 예상 높이로 쪽 나눔 + 마지막 쪽에 '다음 수업 계획'
  → 각 페이지 _captureOffscreen → pdf-lib A4 세로
  → 파일명: 수업일지표_{날짜}.pdf
  이행률 등급 = domain RATE_TIER (75% 이상 양호 / 30~74% 보통 / 30% 미만 미흡)
```
