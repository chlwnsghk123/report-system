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

→ saveAppData() → showGroups() → autoSelectDate()
```

## 2. 뷰 전환 시스템

```
showGroups()
  → renderViewTabs()    뷰 탭 바 표시
  → autoSelectDate()    오늘 이후 가장 가까운 날짜 자동 선택
    → selectDate(date)
      → G.selDate = date
      → switchView('date')
        → renderDateSummary()   수업정보 요약
        → renderTabs()          학생 탭
        → autoFillAll()         전체 자동채우기

switchView('config')
  → renderLessonCards()   수업 날짜별 카드 UI
  → renderStudentList()   학생 목록 UI

수업설정 뷰에서 레슨 편집:
  updateLessonField(idx, field, value)
    → G.lessons[idx][field] = value
    → if (현재 선택 날짜) syncLessonToReport()
      → hidden inputs 갱신 → fp() → 리포트카드 동기화
```

## 3. IndexedDB 초기화·복원

```
window.onload()
  → openDB()
  → updateScale() + resize 리스너 등록
  → initCE()
  → loadMascotImages()
  // 항상 새로 시작 — 이전 세션 자동 복원 없음
```

저장 시점:

| 함수 | 키 | 시점 |
|---|---|---|
| `saveAppData()` | `'appData'` | 엑셀 로드/저장 후, 레슨 편집 시 (300ms 디바운스) |
| `saveAppDataNow()` | `'appData'` | 엑셀 저장 직전 등 즉시 저장이 필요한 시점 |
| `saveSession()` | `'session'` | 뷰 전환, 날짜·학생 변경, 토글 변경 시 |
| `saveTabData()` | `G.tabData` 내 | 탭 전환 시 |

## 4. 학생 탭 전환

```
switchTab(name)
  → saveTabData()       현재 학생 입력값 → G.tabData
  → G.selStudent = name
  → renderTabs()        활성 탭 UI
  → if(G.selDate) autoFillAll()
  → saveSession()
```

## 5. 미니테스트 점수

```
공식: 20 + ceil(정답률 × 30), 최대 50점
예) 0/5 → 20점 | 3/5 → 38점 | 5/5 → 50점
```

## 6. 이행률 데이터 흐름

```
이행률 값 규칙:
  null / undefined  = 결석 (데이터 없음, 그래프에서 제외)
  -1                = 표시 안 함 (리포트에 '-' 표시, 그래프 제외)
  0                 = 출석했지만 이행률 0% (그래프에 0% 표시)
  1~100             = 정상 이행률

onRateManual()
  → inputRate 빈값(''): G.hwRateManual=null, G.rates에서 해당 키 삭제 (=결석)
  → inputRate '0': G.hwRateManual=0, G.rates[학생][날짜]=0 (=출석, 0%)

syncHwRecItems() / selectDate() / saveToExcel()
  → hwRec.이행률 동기화 우선순위: rateManual > G.rates[학생][날짜] > null(결석)
  → rateManual이 null이고 G.rates도 없으면 hwRec.이행률 = null (결석 처리)
  → 0과 null 구분 보존

selectDate() 날짜 전환 시 동기화 항목:
  → tabData → hwRec (items, 이행률, 클리어 시 null)
  → tabData → G.rates (rateManual, 클리어 시 삭제)
  → tabData → G.wrong (wrongInput, 클리어 시 삭제)
  (correctInput은 미사용 — 엑셀 성적 열은 항상 공란)

saveToExcel() 동기화 (현재 날짜 tabData 기준):
  → tabData → G.wrong (클리어 시 삭제)
  → tabData → hwRec.이행률 (클리어 시 null)

rebuildGraph()
  → G.rates[학생][날짜] (현재 날짜 이하만, 첫 번째 날짜 제외, -1 제외)
  → v!=null 필터 → null(결석)은 제외, 0은 포함
  → 수동입력값 반영
  → 최근 4개 slice(-4)
  → SVG polyline + circle + text
```

## 7. PDF 생성

```
dlPdf()
  → html2canvas(#reportCard, scale:2) → reportCanvas
  → allPages = [reportCanvas, ...G.pdfCanvases]
  → pdf-lib: A4 가로 (841.89×595.28pt), 마진20, 갭12
  → 2개씩 spread 페이지
  첨부 PDF 전처리: 상단 5% + 하단 6% 크롭
  → Blob → <a> 클릭 다운로드
  파일명: {학생명}_{날짜}_리포트.pdf
```

## 8. 엑셀 저장

```
saveToExcel()
  → saveTabData()       현재 학생 데이터 보존
  → G.students 순회: tabData → G.hwRec (items 배열 포함), G.rates 등 갱신
  → await saveAppDataNow()  즉시 DB 저장
  → XLSX 워크북 생성:
    수업정보 시트: [날짜, 교재, 단원, 상세진도, 과제1~N] (동적 열)
    날짜별 시트: [이름, 성적(공란), 오답, 이행률, 과제1~N(숫자상태), 추가과제1~M(extraHw), 비고]
      비고 열: 이월과제 자동 요약 `(전·M.D)과제명→상태, ...` + 사용자 메모 (`자동요약 | 메모`)
      추가과제 열: 이번 주차 학생별 추가 과제 텍스트 (hwRec.extraHw)
    이월과제 시트: [학생, 확인날짜, 과제내용, 원본날짜, 상태] (▼ 날짜 블록 구분)
    설정 시트: 스티커 등 앱 설정 + 마지막 저장 시각 (▼ 섹션 구분)
  → 다운로드

## 9. 캐리오버 시스템

```
autoFillAll()
  → computeCarryover(student, date)
    → hwRec[student||prevDate].items에서 미완료/부분완료 항목 수집
    → 레거시 호환: items 없으면 과제N_상태 + 2단계 전 레슨 과제 텍스트로 재구성
  → G.hwItems = baseItems + carryItems
  → G.hwItemTypes = [{type:'base'}, ..., {type:'carry', fromDate}]
  → 상태 로드: hwRec[key].items 매칭 또는 레거시 과제N_상태

cycleHwStatus()
  → updateNoticeWithCarry()
    → 이번 주차 과제 = 현재 레슨 base hw + 현재 미완료 항목
    → 리포트카드 #rNoticeList 갱신

saveTabData()
  → syncHwRecItems()
    → G.hwItems/hwStatus/hwItemTypes → hwRec[key].items 배열 동기화
    → base 항목에 ref 자동 부여 (`${date}-hw${baseIdx}`) — 이월 추적용
```
