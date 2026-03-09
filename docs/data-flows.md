# 데이터 흐름

> 구현 세부값(좌표, 슬라이스 수 등)은 코드 변경 시 drift될 수 있음.
> 알고리즘 원리는 여기서, 정확한 값은 해당 함수에서 직접 확인.

---

## 1. 엑셀 파싱

```
loadExcel() → XLSX.read(arrayBuffer) → parseWB(wb)
  [1] '수업정보' 시트 → G.lessons[]
      열: 날짜(0) 강사명(1) 교재(2) 단원(3) 상세진도(4) 과제1~5(5~9)
      날짜 오름차순 정렬 / 전체문제수 기본값 5
  [2] '성적' 시트 → G.students[], G.corrects, G.wrong
      헤더: 이름 | 날짜_맞힌... | ▼오답 | 날짜_오답...
      [전체문제수] 특수행: 날짜별 전체문제수 → G.lessons[i].전체문제수
  [3] 학생별 시트 → G.hwRec, G.rates
      열: 날짜(0) 이행률(1) 과제1_내용(2) 과제1_상태(3) ... 과제5_상태(11)
      키: "학생명||날짜"
→ saveAppData() → populateSels() + showGroups()
```

**날짜 정규화 (`toDS`):**
- `YYYY-MM-DD` / `YYYY/MM/DD` → 슬래시 치환, 10자 슬라이스
- 5자리 숫자(엑셀코드) → `XLSX.SSF.parse_date_code()` 변환

---

## 2. IndexedDB 초기화·복원

```
window.onload()
  → openDB()
  → dbGet('appData') → G 복원 → populateSels() + showGroups()
  → dbGet('session') → restoreSession()
      → autoFillCommon() 또는 autoFillAll()
```

**저장 시점:**

| 함수 | 저장 대상 | 시점 |
|---|---|---|
| `saveAppData()` | IndexedDB `'appData'` | 엑셀 로드/저장 후 |
| `saveSession()` | IndexedDB `'session'` | 날짜·학생 전환, 토글 변경 시 |
| `saveTabData()` | **메모리 G.tabData만** (DB 아님) | 탭 전환 직전 |

> `saveTabData()`는 G.tabData에만 쓴다. DB 반영은 이후 `saveAppData()` 호출 시.

---

## 3. 학생 탭 전환

```
switchTab(name)
  → saveTabData()       현재 학생 입력값 → G.tabData[현재학생] (메모리)
  → G.selStudent = name
  → renderTabs()        활성 탭 UI 업데이트
  → autoFillAll()
      → autoFillCommon() 진도·과제 자동채우기
      → restoreTabData() 이전 입력값 복원 (tabData에 있으면 우선)
      → hwRec에서 과제 상태 불러오기 (tabData 없을 때)
      → calcScore(), updateWrongTags(), rebuildGraph()
  → saveSession()
```

---

## 4. 미니테스트 점수

```
공식 (autofill.js:calcScore): 20 + ceil(min(정답,전체)/전체 × 30), 최대 50점
예) 0/5 → 20점 | 3/5 → 38점 | 5/5 → 50점
```

> 공식 변경 시 `js/autofill.js:calcScore()` 참조.

---

## 5. 이행률 그래프

```
rebuildGraph()  (js/report.js)
  → G.rates[학생][날짜] 중 선택 날짜 이하 + 유효값만 필터
  → 첫 번째 수업 날짜 제외 (비교 기준 없음)
  → 수동입력값(inputRate)이 있으면 해당 날짜 값 덮어씀
  → 최근 4개만 표시 (slice(-4))
  → SVG polyline + circle + 라벨 텍스트 렌더링
```

> 표시 개수나 좌표 공식은 코드 변경으로 바뀔 수 있음.
> 정확한 값은 `js/report.js:rebuildGraph()` 직접 확인.

---

## 6. PDF 생성

```
dlPdf()  (js/pdf.js)
  → html2canvas(#reportCard, scale:2) → reportCanvas
  → allPages = [reportCanvas, ...G.pdfCanvases]
  → pdf-lib: A4 가로 배치, 마진·갭 적용
  → 2개씩 spread 페이지 (좌/우)
  → Blob → <a> 클릭 다운로드
  파일명: {학생명}_{날짜}_리포트.pdf
```

> 마진·갭 수치는 `js/pdf.js:dlPdf()` 참조.
