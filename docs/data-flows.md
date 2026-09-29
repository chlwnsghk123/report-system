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
        → closeLessonModal()    (수업설정이 열려 있었으면 과제 목록 재구성 + 다시 채움)
        → renderDateNav()       상단 날짜 네비게이션 바
        → autoFillAll()         전체 자동채우기 (closeLessonModal에서 이미 채웠으면 생략)

switchView('config')
  → openLessonModal()    수업설정 전체화면 모달 열기
    → renderLessonCards()   수업 날짜별 카드 UI (학생 관리는 ☰ 메뉴 → 학생 관리)

날짜 선택:
  1. 상단 네비: navDatePrev()/navDateNext() 또는 날짜 클릭 드롭다운(data-date)
  2. 키보드 ←→
  → 모두 selectDate(date) 호출

수업설정 접근:
  상단 ⚙ 설정 메뉴 → '수업 진도 설정' → openLessonModal()

수업설정 뷰에서 레슨 편집:
  updateLessonField(idx, field, value)
    → G.lessons[idx][field] = value
    → if (현재 날짜 또는 직전 수업) renderLessonInfo()   리포트카드 진도·과제 직접 갱신
```

## 3. IndexedDB 자동 백업·복구 (v1.80)

```
window.onload()
  → try openDB() (실패해도 앱은 동작 — 백업만 비활성)
  → updateScale() + resize 리스너 등록
  → loadMascotImages() / initPanelResize() / applyViewSettings()
  → dbSet('studentPdfs',null)   구버전 첨부 잔재 정리 (첨부는 세션 한정)
  → checkRecovery()             'appData' 스냅샷이 있으면 #recoverBanner 표시 (자동 복원은 하지 않음)
  → cloudInit()                 학원 저장소 — 로그인해 둔 경우 열어 두었던 리포트를 이어 연다 (§13)

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

`_writeSnapshot()`은 ① '지난 작업' 배너가 복구 대기 중이면 백업을 건드리지 않고, ② 수업·학생이 모두 비어 있으면 이번 세션에 데이터가 있다가 사용자가 모두 지운 경우에만 백업을 비운다(빈 화면에서 보기 설정만 바꿔도 백업이 사라지지 않도록). `dbSet`은 트랜잭션 오류·중단 시 reject한다(무한 대기 방지).

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

미니 테스트는 **직접 입력한 것만** 보여 준다(v1.85). 문제 노트 숙제의 채점 결과는 '지난 수업 과제'에
"12/15 맞음 · 다시 볼 문제"로 나온다(§14 `noteCheckRows`).

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
  → _afterHwStatusChange(before) → renderHwEditor() → 계산 대상(이월·선택·OFF 제외) 상태가 실제로 바뀐 경우에만
                              calcRate(_rateStatuses()) → applyRate(값,false) (자동 계산)
                              ※ 이월·선택 과제만 눌렀을 때는 직접 입력한 이행률을 건드리지 않음
                            → updateNoticeWithCarry() → syncHwRecItems() → saveAppData()

onRateManual()  (직접 입력) → 0~100 보정 → applyRate(값,true) (hwRateManual=값)
autoCalcRate()  (↻ 재계산) → 과제 상태 기준으로 되돌림
applyRate()     → #inputRate · G.rates · refreshRateSection() · rebuildGraph()

refreshRateSection(): 첫 수업·값 없음 → 숨김 / 결석 → '이번 수업 결석'(회색) + 진도 라벨 '빠진 수업 내용' / -1 → '-' / 그 외 숫자

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
  이행률 요약표 첨부: _attachStudentReportToView() — 리포트 날짜까지 최근 6회(SUMMARY_ATTACH_MAX)만 캡처해 A4 반쪽에 배치
  요약표 PDF: _downloadStudentReportPdf() — 폭 400pt 고정, 길면 _pageCuts()로 카드 사이에서 잘라 여러 쪽

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
  isReportEligible(s,d) → 결석이 아니면 true (일괄 PDF·이미지 ZIP 대상)
  attendCategory(s,d)   → 'present'|'late'|'absent'|'none'

setAttend(v): 같은 버튼 재클릭 → 키 삭제(미선택). (v1.80 이전에는 -1로 저장되어 요약·일괄 PDF에서 조용히 빠졌음)
markAllPresent(): 미체크 학생만 출석(2)으로 — 결석·지각만 따로 누르면 됨
updateAttendUI(): 첫 수업일에도 표시, #attendUnset에 '미체크 N명'
영향 받는 화면(모두 domain 규칙 호출):
  리포트 이행률('이번 수업 결석')·그래프, saveToExcel(출결 열), 이행률 요약표·수업일지표·일괄 PDF·이미지 ZIP 대상 판정
```

## 10-1. 날짜·학생 키 데이터 이동 (v1.80)

```
updateLessonDate(idx,new) → 앞뒤 수업을 건너뛰어 순서가 바뀌면 차단(alert) → renameDateData(old,new)
  → "학생||날짜" 키(hwRec·memos·hwDisabled·journalNote·miniScore), 학생→날짜(rates·wrong·attend),
    날짜 키(journalPlan·journalInfo·miniTest), 과제 항목 fromDate, 이월 예약(date)을 모두 새 날짜로
removeLesson(idx) → removeDateData(date) 같은 범위를 삭제
removeLessonHw(idx,hwIdx) → _remapLessonHwRefs(lessonId,n): 삭제된 과제 ref 기록 제거, 뒤 번호 ref 당김
renameStudent(old) / _doRemoveStudent(idx) → 학생 키가 들어간 모든 저장소 이동/삭제
rebuildAllHwItems(fromExcel) → 상태는 rec.items의 ref로 찾고, 엑셀 로드 직후(parseWB → fromExcel=true)에만
                      순번 필드(빈 과제 건너뜀) 사용 → 끝에서 순번 필드(과제N_상태)를 base 과제 순서로만 재생성
                      (이월 과제 상태는 이월과제 시트에 저장되므로 순번 필드에 섞지 않음 — syncHwRecItems도 동일),
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

## 13. 학원 저장소 — 구글 로그인 (v1.83~, js/cloud.js)

서버는 문제 노트 사이트(mathpro.app)의 Worker(`/api/auth/*`·`/api/workspace/*`). 이 앱은 CORS로 부른다
(허용 출처: `https://report-system-nine.vercel.app`, 개발용 `http://localhost:8000`). ☁ 버튼은 늘 보이지만,
로그인하지 않으면 아래는 전부 건너뛰고 예전처럼 엑셀 + 자동 백업.

```
☁ 학원 저장소 → 구글 버튼 → cloudSignIn(credential)
  → POST /api/auth/google → {token(14일), user, tenants} → localStorage 'rs:auth' (학원 선택 'rs:tenant')
  → 운영자가 그 학원에 등록한 이메일만 통과 (아니면 '등록되지 않은 계정' 안내)

리포트 = 엑셀 파일 한 개 분량 (DATA_KEYS 전체 + pendingPropagations + fileName, hwDisabled Set → 배열)
  올리기  cloudUploadCurrent() → POST report → 연결('rs:book' = {tenant,id,title,rev})
  엑셀    cloudUploadExcel(input) → parseWB(실패 시 롤백) → POST report(제목 = 파일 이름) → 연결 (v1.84)
          (올리기 실패 → 엑셀은 이 기기에서 열린 채 '연결 안 됨'으로)
  열기    cloudOpenBook(id)    → GET report → _cloudApply → _cloudShow (sbar '☁ 제목')
  편집    saveAppData() → cloudOnChange() → 1.5초 뒤 _cloudSave()
            → PUT report {baseRev, data} → 새 rev → markSaved + 자동 백업 즉시 갱신
            → 409(다른 곳에서 먼저 저장) → _cloudConflict(): 서버 버전 불러오기 / 내 버전으로 덮어쓰기 / 엑셀로 받아두기
            → 네트워크 오류 → 2·4·8…최대 60초 뒤 재시도, 401 → '로그인 필요'(다시 로그인하면 이어서 저장)
  Ctrl+S  cloudSaveNow() (엑셀 다운로드 대신 즉시 저장, 💾 버튼은 엑셀 백업 그대로)
  끊기    엑셀 열기·데이터 제거·연결 끊기·로그아웃·학원 변경 → cloudDetach() (학원 저장소의 리포트는 그대로)

시작 시 cloudResume()
  → 'rs:book'이 있으면 GET report
  → 자동 백업(appData)에 같은 리포트의 '못 올린 변경'(cloud 표시 + unsaved)이 있으면
       저장본 번호가 같음 → 이 기기 데이터로 열고 이어서 저장
       다름           → 어느 쪽을 쓸지 묻기 (충돌)
  → 없으면 서버 데이터로 열기 ('지난 작업' 배너는 닫힘)
  → 서버에 연결 못 하면 배너(이 기기 백업)로 이어하기 가능

앱 사이 이동 (v1.84)
  📘 문제 노트(#btnNote, 로그인했을 때만) → openNoteApp()
    → 새 탭 먼저 열기 → POST /api/auth/handoff → {code(2분)} → {apiBase}/{학원}#mph=<code>
  숙제 채점 카드 '문제 노트 ↗' → openNoteApp('student:이름') → …#mph=<code>&go=student:이름 (그 학생 오답·기록 화면)
  반 전체 창 '문제 노트에서 학생별 오답 노트 인쇄' → openNoteApp('classroom') (숙제·채점)
  문제 노트 '학습 리포트 ↗' → 이 앱 주소#mph=<code>&t=<학원>[&go=student:이름]
    → cloudInit → _cloudConsumeHandoff(): 주소에서 #… 즉시 지움 → POST /api/auth/redeem
    → 새 세션 'rs:auth' (계정이 달라도 이 계정으로), 학원 = t (그 계정의 학원일 때) → 평소처럼 이어 열기
    → go=student:이름 이면 리포트가 올라온 뒤 _cloudApplyGo() → 그 학생 탭
```

## 14. 숙제 채점 · 오답 다시 풀기 — 문제 노트 연동 (v1.84~v1.85, js/cloud.js)

규칙은 문제 노트와 한 벌(note-pro `src/lib/classroomRules.js`, docs/CLASSROOM.md §4). 설계 근거: note-pro docs/CLASSROOM_UX.md.

```
문제 노트: 노트 '숙제로 내기' → 숙제 {id, title, date(나눠 주는 날), due(검사하는 날, 비우면 자동), students, problems:[{id,label,unit,no}]}
cloudLoadNotes() (시작·로그인·창으로 돌아올 때 1분에 한 번)
  → GET homework → 이 리포트 학생 전원 GET records?many=1&student=… (40명씩)
  → CLOUD.notes {tenant, homework, recs:{[학생]:{items:{[문제 id]:{h:[[날짜,'o'|'x',숙제 id?],…]}}, missing:{[숙제 id]:날짜}}}} (캐시 'rs:notes')

수업 날짜 = G.lessons 날짜
  나눠 주는 수업 G = 숙제 날짜 당일 또는 그 뒤 첫 수업 · 검사하는 수업 C = 그다음 수업 (due 가 있으면 그날 또는 그 뒤 첫 수업)

[수업 G] autoFillAll → updateNoticeWithCarry → _curHwOnOffItems → noteNextItems(학생, G)
  → 다음 수업까지 과제에 "📘 숙제 (N문제)" (kind 'note', ref mp:<숙제 id> — 눌러서 OFF 가능, OFF 면 C 검사도 없음)
  → 이 수업까지 남은 오답이 있으면 "📘 오답 다시 풀기 N문제 — 20강 2·5번" (ref mp:wrong)
  → 안 해 와서 이월된 숙제는 "(이월) 📘 숙제"

[수업 C] autoFillAll → renderNotePanel() → #noteHwCard (지난 수업 과제 검사 바로 아래)
  → _hwCheckAt(학생, C): 검사할 숙제 + 이월 · _wrongCheckAt(학생, C): 지난 수업에 나간 오답
  → 채점 (_noteClick → _noteMark):
     미채점 숙제에서 칩을 처음 누름 → 그 문제 'x' + 나머지 'o' (이 수업 날짜로) · 모두 맞음 · 모두 틀림(맞은 것만 다시 누름)
     그 뒤 칩 → 맞음↔틀림 (처음 채점한 날짜의 기록을 덮어씀 — 숙제는 학생마다 한 번 채점)
     안 해 옴 → POST records {hw, marks:[], missing:true} (채점하면 저절로 풀림) → 다음 수업까지 과제·다음 검사에 (이월)
     오답 다시 풀기 칩 → 숙제가 아닌 기록 [C, o|x] (날짜마다 한 회차; 채점해도 칩은 남음)
     → 화면 먼저 반영 → 학생별 줄(markQ)로 순서대로 POST records (날짜별) → 응답의 바뀐 문제·missing 으로 맞춤
  → 리포트 지난 수업 과제: updateHwDisplay → noteCheckRows → "📘 숙제 12/15 맞음 · 다시 볼 문제 3·7번" / "안 해 옴" / "오답 다시 풀기 2/3 맞음"
  → 리포트 다음 수업까지 과제: 새로 틀린 문제가 곧바로 "📘 오답 다시 풀기"에 붙음 (다른 날 두 번 맞혀야 빠짐)
  → 📘 숙제 채점 (반 전체) (#btnClassGrade, 검사할 것이 있을 때만) → openClassGrade(): 숙제마다 학생 줄 × 문제 칸 + 오답 다시 풀기
  → 문제 노트 ↗ → 그 학생의 남은 오답·오답 노트 인쇄 (문제 노트 '숙제·채점')
confirmMissingInputs → noteUngradedNames: 검사할 숙제를 채점도 안 해 옴 표시도 안 한 학생 알림
수업 일지표 → 학생별 '문제 노트' 줄(noteCheckRows) + 숙제별 '숙제 오답 집계'(noteWrongTally)
```
