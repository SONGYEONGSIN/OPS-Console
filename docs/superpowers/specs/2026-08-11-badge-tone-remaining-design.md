# 규칙 밖에 남은 상태 배지 전환 — 설계

- 작성일: 2026-08-11
- 선행: `2026-08-11-status-badge-tone-design.md` (PR #953, 머지됨)
- 상태: 승인 대기

## 배경

PR #953이 상태 배지 색을 라벨 의미 기준 4버킷으로 통일했다. 그런데 조사를 **식별자 이름**
(`_COLOR` / `_TONE` / `STATUS_BADGE`)으로만 해서, **인라인 삼항식과 함수 형태의 배지를 못 찾았다.**
최종 리뷰가 세 화면을 짚었고, 이번에 그 셋을 마저 전환한다.

셋을 한 PR로 묶는 이유: 전부 `badge-tone.ts`의 규칙 집합에 빠진 라벨을 넣는 것부터 시작한다.
쪼개면 같은 파일을 세 번 건드리고 CI를 세 번 돌린다.

## 규칙 보강

`badge-tone.ts`의 집합 두 곳에 라벨 3개를 추가한다. 전부 정확일치(`Set.has`)라 다른 라벨에 영향이 없다.

| 라벨 | 화면 | 버킷 | 지금 |
|---|---|---|---|
| `오류` | dev-test | 주의 | 규칙이 모름 → idle로 떨어짐 |
| `미수` | 미수채권 | 주의 | 규칙이 모름 |
| `수금` | 미수채권 | 완료 | 규칙이 모름 |

```ts
const ATTENTION = new Set(["긴급", "장애", "반려", "중단", "정지", "오류", "미수"]);
const DONE_EXTRA = new Set(["수주", "수금"]);
```

`오류`는 `장애`와 같은 계열의 누락이다. 없으면 dev-test를 전환하는 순간 `오류`가 회색으로 떨어져
바로 옆 `실패`(짙은 빨강)와 갈라진다 — 지금보다 나빠진다.

## 화면별 전환

세 화면 모두 배지 라벨을 바로 옆에서 렌더하고 있다. 색의 입력은 **그 라벨 표현 그대로**여야 한다.

### 1. 경위서 편집 화면 (우선순위 1)

`src/app/dashboard/incident-reports/[id]/_components/ReportEditorWorkspace.tsx:252-258`

인라인 삼항식이 `draft`만 빨강, 나머지 전부 회색으로 칠한다. 목록(`incident-reports/status.ts`,
PR #953에서 전환됨)과 어긋난다.

**지금 나고 있는 손해**: 반려된 경위서가 목록에서는 `bg-vermilion-deep`(봐야 할 것)인데,
열어서 편집 화면에 들어가면 **회색**이다. 결재가 반려됐다는 신호가 사라진다. 승인완료·발송완료도
목록은 검정, 편집 화면은 회색이다.

삼항식을 지우고 이미 렌더 중인 라벨을 그대로 넘긴다:

```tsx
className={`inline-block px-2 py-0.5 text-2xs ${statusBadgeTone(REPORT_STATUS_LABEL[report.status])}`}
```

### 2. dev-test (개발 테스트)

- `dev-test/Table.tsx:29-33` — `statusTone(status)` 함수
- `dev-test/View.tsx:35-40` — `StatusBadge` 안의 삼항식

라벨은 두 파일 모두 동일: 대기 / 실행 중 / 완료 / 실패 / 오류.
`실행 중`은 **설계의 진행 버킷 표에 있는데 이 화면에만 존재한다** — 표를 만들 때 라벨은 훑고
파일은 목록에 안 넣은 것이다.

현재 색: 완료 `bg-line-soft text-ink`(회색) / 실패·오류 `bg-vermilion text-paper` / 나머지 `bg-cream`.
같은 완료가 기수·인수인계·회의록에서는 검정, 여기서는 회색이다.

`statusTone` 함수와 `StatusBadge`의 삼항식을 **삭제**하고 `statusBadgeTone(STATUS_LABEL[status])`로
바꾼다. 값만 갈아끼우면 분기 로직이 남는다.

결과 배정: 대기 대기 / 실행 중 진행 / 완료 완료 / 실패 주의 / 오류 주의.

### 3. 미수채권

- `receivables/Table.tsx:69-75` — 인라인 삼항식
- `receivables/View.tsx:53-60` — 인라인 삼항식 ('입금여부' 항목)

라벨은 `row.status === "approved" ? "수금" : "미수"`. 라벨 계산을 상수로 빼고 색과 텍스트가
**같은 값**을 쓰게 한다:

```tsx
const paidLabel = row.status === "approved" ? "수금" : "미수";
```
```tsx
<span className={`inline-block px-2 py-0.5 text-xs ${statusBadgeTone(paidLabel)}`}>
  {paidLabel}
</span>
```

**미수는 일괄 주의(짙은 빨강)로 한다.** 경과일수 기준(독려 메일과 같은 10일 선)도 검토했으나
채택하지 않았다 — 색이 라벨이 아니라 경과일수에 달리면 "라벨로 색을 정한다"는 이번 설계의
단일 원칙에 예외가 생긴다. 미수 비율이 높아 열이 통째로 빨개지면 그때 경과일수 기준으로
바꾼다(`badge-tone.ts` 밖의 화면 로직 변경 1건).

## 범위 밖

- `cohort/Table.tsx`의 `inviteBadgeClass` — 초대 진행도라는 다른 축. 4버킷에서 셋 다 idle로 뭉친다
- `STATUS_RING`(도트), `PRIORITY_COLOR`, `LEVEL_COLOR`, `SCHEDULE_TYPE_COLOR`, `PERMISSION_COLOR`,
  `DOMAIN_TONE`, `AI_TOOL_TONE`, `CATEGORY_TONE`, `LED_COLOR`, `DOT_COLOR` — 상태 배지가 아니다
- **배지 테스트 커버리지 보강은 별도 PR** — 전환한 맵 대부분이 모듈 로컬 상수라 아는 맵에
  테스트를 붙이는 방식으로는 '모르는 화면'을 못 잡는다. 렌더 지점 스캔 방식이 필요하고,
  그건 이 PR과 성격이 다르다

### 명시적 이연 — 아직 규칙 밖인 상태 배지 3화면

최종 리뷰가 **렌더 지점 훑기**(식별자 이름이 아니라 `className`의 `bg-*`+`text-*` 조합, 삼항식,
클래스 문자열 반환 헬퍼)로 찾아냈다. 이 PR에 넣지 않고 후속으로 미룬다 —
리뷰가 끝난 브랜치를 넓히지 않기 위해서다. **앱이 전부 전환됐다고 오해하지 않도록 여기 남긴다.**

| 화면 | 위치 | 지금 상태 |
|---|---|---|
| 자동화 실행 로그 | `automations/_components/AutomationLogPanel.tsx` — `StatusBadge`(L89) / `WeeklyStatusBadge`(L292) / `ClosingStatusBadge`(L357) / `RunStatusBadge`(L454) | 삼항식 4개. 이 PR이 지운 옛 미수채권 팔레트(`bg-vermilion/20 text-vermilion-deep` 등)를 그대로 씀 → 같은 `실패`가 자동화 화면은 연빨강, 개발 테스트는 짙은 빨강 |
| 개발 제어 | `list-variants/dev-control/View.tsx:145-154` | `분석 중`이 `bg-ink text-cream` — **완료 색**이다. 검정은 앱 전체에서 '끝남'인데 실행 중인 작업이 그 색이다. 형제 변형인 개발 테스트는 `실행 중`을 빨강으로 칠한다 |
| 인수인계 위저드 | `list-variants/handover/CollapsibleField.tsx:35-40` | `미작성`이 `bg-vermilion text-cream`(진행). 같은 기능의 목록(`handover/Table.tsx`)은 `미작성`을 대기(회색)로 칠한다 |

**후속 PR의 함정 — `성공`을 먼저 규칙에 넣어야 한다.** 자동화 로그의 라벨(성공 / 발송 / 스킵 /
off주 / DRY-RUN / 생성)은 현재 규칙이 전부 모른다. `성공`을 완료 규칙에 넣지 않고 전환하면
바로 옆 짙은 빨강 `실패` 옆에서 회색으로 떨어진다 — `오류` 때와 똑같은 실수를 반복하게 된다.
배정 제안: 성공·발송 → 완료 / 스킵·off주·DRY-RUN·생성 → 대기.

`_components/Content.tsx`의 장애·정상·주의 배지는 **importer가 없는 데모 코드**라 제외한다.

## 검증

- `badge-tone.test.ts` — 새 라벨 3개(오류·미수·수금)가 기대 버킷을 돌려주는지. `장애` 때와 동일 패턴
- 각 화면의 기존 테스트가 깨지지 않는지 (`dev-test`, `receivables`, `incident-reports`에 테스트 존재)
- `npm run typecheck` / `npm run lint` / CI 전체
- 실화면: 경위서 목록에서 반려 건을 열어 편집 화면 배지가 목록과 같은 색인지 /
  미수채권 목록에서 미수 열이 통째로 빨개지지 않는지

## 근본 원인 기록

다음에 이런 전면 교체를 할 땐 **식별자 이름이 아니라 렌더 지점으로 훑는다.** 배지는
`className={...bg-*}` 형태로 어디에나 인라인으로 존재할 수 있고, 이름 있는 맵으로만 검색하면
이번처럼 두 번 놓친다.
