# 데이터 흐름

## 1. 엑셀 파싱

```
loadExcel() → XLSX.read(arrayBuffer) → parseWB(wb)
  [1] '수업정보' 시트 → G.lessons[]
      열: 날짜(0) 강사명(1) 교재(2) 단원(3) 상세진도(4) 과제1~5(5~9)
      날짜 오름차순 정렬, 전체문제수 기본값 5
  [2] '성적' 시트 → G.students[], G.corrects, G.wrong
      헤더: 이름 | 날짜_맞힌... | ▼오답 | 날짜_오답...
      [전체문제수] 특수행: 날짜별 전체문제수 → G.lessons[].전체문제수
  [3] 학생별 시트 → G.hwRec, G.rates
      열: 날짜(0) 이행률(1) 과제1_내용(2) 과제1_상태(3) ... 과제5_상태(11)
      키: "학생명||날짜"
→ saveAppData() → populateSels() + showGroups()
```

**날짜 정규화 (`toDS`):**
- `YYYY-MM-DD` / `YYYY/MM/DD` → 슬래시 치환, 10자 슬라이스
- 5자리 숫자(엑셀코드) → `XLSX.SSF.parse_date_code()` 변환

## 2. IndexedDB 초기화·복원

```
window.onload()
  → openDB()
  → dbGet('appData') → G 복원 → populateSels() + showGroups()
  → dbGet('session') → restoreSession()
      → autoFillCommon() 또는 autoFillAll()
```

저장 시점:

| 함수 | 키 | 시점 |
|---|---|---|
| `saveAppData()` | `'appData'` | 엑셀 로드/저장 후 |
| `saveSession()` | `'session'` | 날짜·학생 전환, 토글 변경 시 |
| `saveTabData()` | `'appData'` 내 포함 | 탭 전환 시 |

## 3. 학생 탭 전환

```
switchTab(name)
  → saveTabData()       현재 학생 입력값 → G.tabData
  → G.selStudent = name
  → renderTabs()        활성 탭 UI
  → autoFillAll()
      → autoFillCommon() 진도·과제 자동채우기
      → restoreTabData() 이전 입력값 복원
      → calcScore(), updateWrongTags(), rebuildGraph()
  → saveSession()
```

## 4. 미니테스트 점수

```
공식: 20 + ceil(정답률 × 30), 최대 50점
예) 0/5 → 20점 | 3/5 → 38점 | 5/5 → 50점
```

## 5. 이행률 그래프

```
rebuildGraph()
  → G.rates[학생][날짜] (현재 날짜 이하만)
  → 수동입력값 반영, 최근 6개 slice
  → SVG polyline + circle + text
     Y: 88-(v/100×72), X: 30+i×120
     최신: circle.active (초록), 과거: .clbl.past (회색)
```

## 6. PDF 생성

```
dlPdf()
  → html2canvas(#reportCard, scale:2) → reportCanvas
  → allPages = [reportCanvas, ...G.pdfCanvases]
  → pdf-lib: A4 가로 (841.89×595.28pt), 마진20, 갭12
  → 2개씩 spread 페이지 (좌/우 각 400pt)
  → Blob → <a> 클릭 다운로드
  파일명: {학생명}_{날짜}_리포트.pdf
```
