# 아키텍처 설계 노트 (Architecture)

> 이 문서는 학습리포트 시스템의 아키텍처를 **현재 상태 점검 → 후보 비교 → 채택 결정 → 단계별 로드맵** 순으로
> 정리한다. "수석 아키텍트 관점"에서 다양한 설계 패러다임을 조사·비교한 결과와, 이 코드베이스의
> 제약(빌드도구 금지·CDN 전용·IndexedDB·순수 프론트엔드)에 가장 적합한 방향을 기록한다.

---

## 1. 현재 상태 점검 (As-Is)

| 항목 | 현황 |
|---|---|
| 규모 | JS ~4천 줄 (v1.80 기준) / 전체 ~6천 줄 (중소 규모) |
| 실행 환경 | 빌드도구·npm 금지, CDN 전용, 순수 프론트엔드 — 배포 https://report-system-nine.vercel.app (Vercel, main 자동), 로컬 개발 `start.bat` → localhost:8000 |
| 상태 | 전역 단일 스토어 `G` (state.js) |
| 영속화 | **Excel 파일**(주 저장소, excel.js) + **IndexedDB**(`appData` 자동 백업·복구, db.js/session.js) |
| 코드 구성 | **기능별 파일 분리**(feature-sliced): state/utils/db/excel/ui/session/autofill/report/pdf/init |
| UI | 명령형 DOM 조작 + `innerHTML` 템플릿 (가상 DOM·바인딩 라이브러리 없음) |
| 유지보수 | 1인 + AI 에이전트 협업 (CLAUDE.md 프로토콜 기반) |

**강점**: 의존성 0, 즉시 실행, 파일이 기능 단위로 잘 쪼개져 있어 "자연어 → 파일" 라우팅이 가능.

**약점(개선 포인트)**:
- 순수 비즈니스 규칙(출결 판정·이월·이행률·과제 ON/OFF)이 표현 계층(report/pdf/ui)과 인프라(excel)에 **흩어져 중복**됨.
  → 예: "출석/결석"을 판정하는 로직이 excel.js·pdf.js·report.js·ui.js에 제각기 존재했음(이번 작업의 발단).
- 같은 규칙이 여러 곳에 복제되어 **한 곳만 고치면 불일치**가 발생(출결을 이행률로 추정하던 버그가 대표 사례).

---

## 2. 검토한 아키텍처 후보 (Candidates)

| 패턴 | 핵심 | 이 프로젝트 적합성 |
|---|---|---|
| **MVC** | Model–View–Controller 분리 | 친숙하나, View/Controller 경계가 명령형 DOM에서 흐려짐. 부분 채용 가능 |
| **MVVM** | View ↔ ViewModel(상태/바인딩) ↔ Model | UI 중심 앱에 적합. `G`를 ViewModel-스토어로 보면 이미 유사. **표현 계층 정리에 강점** |
| **Clean Architecture** | 의존성 역전·계층(엔티티/유스케이스/인터페이스/프레임워크) | 대규모·복잡 도메인용. 전면 도입은 과설계(over-engineering) 위험 |
| **Hexagonal (Ports & Adapters)** | 코어를 기술로부터 격리, 어댑터로 입출력 | 입출력이 여러 개(Excel·IndexedDB·PDF·html2canvas)라 **어댑터 관점은 유효**. 단, 포트 추상화 전면화는 유지비↑ |
| **DDD** | 도메인 모델 중심 설계 | 도메인 복잡도가 "중간"(이월·출결·이행률 규칙)이라 **경량 도메인 계층**만 취하는 게 합리적 |
| **Feature-Sliced Design** | 기능 단위 슬라이스 + 계층 | 현재 파일 구조가 이미 이 사상에 가까움 |

> 핵심 판단: Clean/Hexagonal/DDD를 **교과서 그대로 전면 도입**하면, 빌드도구 없는 ~6천 줄 앱에는
> 어댑터·인터페이스 보일러플레이트만 늘어 **유지보수 부담이 이득을 초과**한다(여러 입출력이 "자주 바뀌는"
> 상황이 아니므로 포트/어댑터의 비용 정당화가 약함). 반대로 아무 계층도 없으면 규칙 중복이 계속된다.

---

## 3. 채택 결정 (To-Be)

**채택: "중앙 스토어 기반의 경량 계층형(Layered) 아키텍처 — MVVM 지향 + 명시적 도메인 계층"**

이 코드베이스는 사실상 **Feature-Sliced + 전역 스토어(MVVM의 ViewModel 역할)** 구조를 이미 갖고 있다.
따라서 "새 아키텍처로 갈아엎기"가 아니라, **현 구조를 그 사상에 맞게 *형식화(formalize)* 하고
누락된 도메인 계층을 분리**하는 것이 위험 대비 효과가 가장 크다(기존 기능 100% 유지가 최우선 제약이므로).

채택 근거:
1. **제약 부합**: 빌드도구·모듈 번들러가 없어도 `<script>` 전역 로드만으로 계층 분리가 가능.
2. **규모 적합**: 중소 규모엔 Clean/Hexagonal 전면 도입보다 경량 계층형이 가성비 우위.
3. **문제 정조준**: 약점(규칙 중복·불일치)의 근원은 "도메인 계층 부재"이므로, 도메인 계층 추가가 정확한 처방.
4. **안전성**: 순수 함수 추출은 호출부 시그니처를 바꾸지 않아 **무중단·검증 가능**(node 문법검사 + 호출부 grep).

### 목표 계층과 파일 매핑

```
┌─ Presentation (표현)        report.js · ui.js(렌더) · index.html · css/
│    DOM 렌더링·이벤트. 도메인/인프라 규칙을 "호출"만 한다.
├─ Application (유스케이스)    autofill.js · ui.js(흐름) · session.js(오케스트레이션)
│    화면 전환·자동채우기·저장 흐름 조율.
├─ Domain (도메인 규칙) ★신설  domain.js
│    DOM·저장소에 무관한 순수 비즈니스 규칙(출결·과제 ON/OFF 등). G를 읽기만 함.
├─ State/Store (상태)          state.js(전역 G) · utils.js(헬퍼)
└─ Infrastructure (인프라)     db.js(IndexedDB) · excel.js(Excel I/O) · pdf.js(PDF/이미지 출력) · cloud.js(학원 저장소 API)
     외부 기술 어댑터. 입출력 담당.
```

---

## 4. 이번 리팩토링에서 한 일 (Phase 1 — 완료)

도메인 계층(`js/domain.js`)을 신설하고, **이번 수정과 직접 맞닿은 비즈니스 규칙**을 순수 함수로 추출했다.
(추출 범위를 "지금 고치는 규칙"으로 한정해 변경 폭과 위험을 최소화)

- **출결 규칙**: `attOf` / `isAbsent` / `isReportEligible` / `attendCategory` (v1.80에서 -1 '제외' 개념과 `isExcluded`·미사용 `isPresent` 제거)
  → 출결은 **이행률이 아니라 "실제 선택한 값"** 으로만 판정. 흩어져 있던 추정 로직을 한 곳으로 통일.
- **이번 주차 과제 ON/OFF 규칙**: `hwOffSet` / `isHwOff`
  → OFF한 과제를 리포트·다음 주차 체크목록에서 일관되게 제외.

표현/인프라 계층(report.js·pdf.js·ui.js·excel.js)은 이제 이 규칙들을 **호출**한다(중복 제거).

> 효과: "출석/결석을 어디서 어떻게 판정하나?"라는 질문의 답이 `domain.js` 한 곳으로 모였다.
> 규칙 변경 시 한 파일만 고치면 전 화면이 일관되게 반영된다.

---

## 5. 단계별 로드맵 (점진적·무중단)

각 단계는 독립적으로 머지 가능하며, 매 단계 "기존 기능 100% 유지 + 문서 동기화"를 만족시킨다.

| 단계 | 내용 | 비고 |
|---|---|---|
| **P1 (완료)** | 도메인 계층 신설, 출결·과제ON/OFF 규칙 추출 | v1.72 |
| **P2 (일부 완료)** | 이행률 계산·등급(`calcRate`·`RATE_TIER`)과 미니테스트(`miniResult`) 규칙을 domain.js로 이전. 출결 -1(제외) 개념 폐기 | v1.80 — 이월(carryover) 규칙은 아직 autofill.js |
| P3 | 스토어 형식화: `setState/subscribe` 도입해 MVVM 양방향성 강화 | 수동 `update*()` 호출 감소 |
| **P4 (일부 완료)** | pdf.js 공용 헬퍼 추출(`_captureReportCard`·`_captureOffscreen`·`_addReportPages`·`_eachStudentCapture`·`_downloadBlob`), 중복 출력물 제거 → 1,573줄 → 약 1,170줄 | v1.80 — 파일 분할은 다음 단계 |
| **P5 (완료)** | IndexedDB `appData` 자동 백업 + 시작 시 '지난 작업 이어하기' 배너(`checkRecovery`·`restoreFromBackup`) | v1.80 |
| **P6 (완료)** | 학원 저장소(`cloud.js`) — 구글 로그인, 리포트 전체를 학원 단위로 저장·공유(rev 충돌 안내), 문제 노트 과제 채점. 서버는 문제 노트 Worker(이 앱엔 서버 코드 없음) | v1.83 |
| **P7 (완료)** | 숙제 + 학생별 문제 기록(두 앱 같은 채점 규칙), 엑셀 바로 올리기, 문제 노트와 로그인 넘김 이동, ☁ 버튼 상시 표시 | v1.84 |
| **P8 (완료)** | 강사 사용성 재설계(note-pro docs/CLASSROOM_UX.md): 숙제는 나눠 준 수업의 '다음 수업까지 과제'·검사하는 수업의 카드로, 반 전체 채점 창, 틀린 문제 → '오답 다시 풀기' 자동(다른 날 두 번 맞혀야 해결), 안 해 옴 이월, 숙제 결과는 '지난 수업 과제'·수업 일지표로(미니 테스트는 직접 입력만). 규칙은 cloud.js "공통 규칙" 블록 = 문제 노트 `classroomRules.js` | v1.85 |

### v1.83 학원 저장소 연결 방식
- `cloud.js`는 인프라 어댑터다. 기존 파일은 **`typeof 함수==='function'` 확인 후 호출하는 연결점**만 가진다
  (saveAppData→`cloudOnChange`, _appSnapshot→`cloudSnapshotTag`, _curHwOnOffItems→`noteNextItems`,
  updateHwDisplay·수업 일지표→`noteCheckRows`·`noteWrongTally`, confirmMissingInputs→`noteUngradedNames`,
  autoFillAll·toggleSec→`renderNotePanel`, loadExcel·_clearAllData→`cloudDetach`, Ctrl+S→`cloudSaveNow`, onload→`cloudInit`).
  cloud.js를 빼도 앱은 예전 그대로 동작한다.
- 도메인 규칙(`miniResult`)은 저장소를 모른다 — v1.85부터 미니 테스트는 직접 입력만, 숙제 결과는 과제 섹션에 어댑터가 붙인다.
- 엑셀 시트 구조는 바꾸지 않았다. 학원 저장소는 같은 데이터(`DATA_KEYS`)를 JSON으로 저장하고, 엑셀 저장은 백업으로 그대로 쓴다.

### v1.80 대대적 리팩토링 (검수팀 QA·수학강사·개발팀 2라운드)
- **데이터 무결성**: 날짜 키 데이터 일괄 이동/삭제(`renameDateData`·`removeDateData`), 과제 삭제 시 ref 재매핑, 재구성 시 ref 우선 상태 매칭, 학생 삭제·이름 변경 시 모든 키 저장소 처리, 엑셀 파싱 실패 롤백, 저장 결과 반환, IndexedDB 오류 처리.
- **저장 필드 단일화**: `DATA_KEYS`(state.js) 하나로 백업·복구·파싱 롤백이 같은 필드 목록을 사용.
- **죽은 코드 제거**: 숨김 input 우회(`fp`)·뷰탭·날짜 사이드바·페이지 네비·비고 모달·빈 함수·PDF IndexedDB 저장 등 약 500줄 삭제.
- **검증**: 번들 ESLint(no-undef/no-redeclare) + Playwright 회귀 하네스(실사용 엑셀로 36개 시나리오, 왕복·복구 포함).

---

## 6. 설계 원칙 (불변)

1. **빌드도구·npm 금지** — 모든 계층은 전역 `<script>` 로드로 성립.
2. **최소 폭발 반경** — 리팩토링은 한 번에 한 계층/규칙씩, 호출부 시그니처 보존.
3. **기능 동등성** — 동작은 그대로, 구조만 개선. 검증: `node --check` + 호출부 grep.
4. **문서 동기화** — 구조 변경 시 본 문서와 docs/* 동시 갱신(CLAUDE.md 프로토콜).

---

## 참고 자료 (References)

- [Clean Architecture vs. MVVM: A Complete Guide](https://victor-25.medium.com/clean-architecture-vs-mvvm-a-complete-guide-for-developers-85aeb7229593)
- [The Complete Guide to Frontend Architecture Patterns in 2026 (DEV)](https://dev.to/sizan_mahmud0_e7c3fd0cb68/the-complete-guide-to-frontend-architecture-patterns-in-2026-3ioo)
- [MVVM as a complementary pattern for Clean Architecture (Spaceteams)](https://www.spaceteams.de/en/insights/mvvm-as-a-complementary-pattern-for-clean-architecture-applications)
- [You Might Not Need a Framework: Vanilla JS modern web apps (DEV)](https://dev.to/abanoubkerols/you-might-not-need-a-framework-building-modern-web-apps-with-vanilla-javascript-37dd)
- [Hexagonal Architecture in frontend (juanm4, GitHub)](https://github.com/juanm4/hexagonal-architecture-frontend)
- [Understanding Software Architecture: DDD, Clean, Hexagonal (Medium)](https://medium.com/@ignatovich.dm/understanding-software-architecture-ddd-clean-architecture-and-hexagonal-architecture-13758e59c951)
- [Clean Architecture in Frontend (Feature-Sliced Design)](https://feature-sliced.design/blog/frontend-clean-architecture)
