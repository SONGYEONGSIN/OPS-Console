# 상태 배지 색 공통 규칙 — 설계

- 작성일: 2026-08-11
- 대상: 대시보드 전 메뉴의 **상태 배지**
- 상태: 승인 대기 (초안 승인 후 전수 조사에서 규칙 2건 보강 — 아래 '승인본에서 바뀐 것' 참조)

## 배경

상태 배지 색이 화면마다 제각각이다. 같은 뜻인데 색이 다르고(완료가 어디선 그레이, 어디선 검정,
어디선 초록), 반대로 다른 뜻인데 색이 같다. 원인은 색을 **상태 enum**에 묶어놨기 때문이다 —
`approved`가 피드백에선 "처리완료", 공지에선 "종료", 서비스에선 "정상"인데 색은 하나다.

색을 **라벨의 의미**에 묶어 전 화면 공통 규칙으로 만든다.

## 규칙

라벨 문자열 하나로 톤을 정한다. 위에서부터 먼저 맞는 것을 적용한다.

| 순서 | 버킷 | 조건 | 클래스 |
|---|---|---|---|
| 1 | **주의** | `긴급` / `실패` 포함 / `반려` / `중단` / `정지` | `bg-vermilion-deep text-cream` |
| 2 | **진행** | 라벨이 `중`으로 끝남(앞뒤 공백 무시) 또는 `확인`·`진행` | `bg-vermilion text-cream` |
| 3 | **완료** | `완료` 또는 `종료` 포함, 또는 `수주` — **단 `예약완료`는 제외** | `bg-ink text-cream` |
| 4 | **대기** | 그 외 전부 | `bg-line-soft text-muted` |

사용자 지시 3건이 그대로 살아 있다: 완료류=검정, `~중`=빨강, 요청=그레이.

### 승인본에서 바뀐 것 (전수 조사 중 발견)

초안은 "긴급만 예외, 나머지 전부 그레이"였다. 라벨을 전부 훑고 두 곳을 고쳤다.

**1. 이상 상태를 그레이에 두면 안 된다 → '주의' 버킷 신설.**
`발송 실패`(백업요청 메일), `반려`(경위서), `중단`, `정지`가 전부 그레이로 떨어졌다.
실패한 메일이 대기 중인 메일과 같은 색이면 사람이 못 찾는다. 지금은 빨강 틴트로 눈에 띄는데
그레이로 내리는 건 명백한 후퇴다. 긴급과 같은 `vermilion-deep`으로 묶어 **"봐야 할 것"**
한 버킷으로 만든다. 톤 개수는 4개 그대로다.

**2. `예약완료`는 완료가 아니다.**
`완료` 포함 규칙에 걸려 검정이 되는데, 실제로는 아직 발송 전 대기 상태다. 문자열 규칙의
구멍이라 명시적으로 제외해 대기(그레이)로 보낸다. 같은 함정이 될 라벨은 현재 이것 하나뿐이다.

## 구현

`src/app/dashboard/_components/inspector/list-variants/badge-tone.ts` (신규)

```ts
export const BADGE_TONE = {
  attention: "bg-vermilion-deep text-cream",
  progress: "bg-vermilion text-cream",
  done: "bg-ink text-cream",
  idle: "bg-line-soft text-muted",
} as const;

export function statusBadgeTone(label: string): string;
```

두 가지 쓰임이 있다.

- **라벨이 런타임에 정해지는 곳** — `statusBadgeTone(LABEL[status])`. 같은 enum이 variant마다
  다른 라벨을 갖는 공용 `status.ts` 경로가 여기 해당한다.
- **enum 키 색맵** — 맵의 값만 `BADGE_TONE.done` 식으로 바꾼다. 문자열 매칭을 런타임에 돌릴
  이유가 없고, 각 도메인이 자기 상태의 버킷을 코드로 선언하는 편이 읽기 쉽다.

두 경로 모두 클래스 문자열의 출처는 `BADGE_TONE` 하나다. 색을 조정할 일이 생기면 이 파일 한 곳만 고친다.

## 전체 매핑

조사한 모든 상태 라벨의 최종 버킷이다. 구현은 이 표를 따른다.

| 버킷 | 라벨 |
|---|---|
| **주의** (vermilion-deep) | 긴급, 장애, 발송 실패, 반려, 중단, 정지 |
| **진행** (vermilion) | 진행중, 진행 중, 진행, 처리중, 점검중, 작성중, 작성 중, 실행 중, 발송 중, 분석 중, 확인 |
| **완료** (ink) | 처리완료, 완료, 종료, 작성완료, 인계완료, 승인완료, 발송완료, 수주 |
| **대기** (line-soft) | 요청, 활성, 정상, 보류, 예약, 예약완료, 삭제, 미작성, 미처리, 취소, 계획, 대기, 검토, 승인대기, 발송, 실주, 테스트 |

### enum 키 맵의 버킷 배정

라벨이 코드에 따로 있는 맵은 추측 여지가 없도록 여기서 못박는다.

| 맵 | 배정 |
|---|---|
| 공용 `STATUS_COLOR` | urgent 주의 / review·inactive 진행 / approved·active·suspended·deleted 대기 |
| `handover/Table` | none 대기 / draft 진행 / ready·published 완료 |
| `HandoverHistory` | in_progress 진행 / completed 완료 / cancelled 대기 |
| `incidents` ×2 (한글 키) | 미처리·보류 대기 / 처리중 진행 / 처리완료 완료 |
| `incident-reports` | draft 진행 / pending_approval 대기 / approved·sent 완료 / rejected 주의 |
| `meetings` | draft 진행 / sent 완료 |
| `quotes` | draft 진행 / sent·lost 대기 / won 완료 |
| `cohort` | planned 대기 / in_progress 진행 / completed 완료 |
| `backup` `MAIL_STATUS_TONE` | pending·scheduled·dry_run 대기 / sending 진행 / sent 완료 / mail_failed 주의 |
| `ProjectPattern` | run 진행 / rev·wait 대기 |

공용 `STATUS_COLOR`의 `approved`가 대기인 점에 주의한다. 기본 라벨이 "정상"이라 대기가 맞지만,
피드백은 이 값을 "처리완료"로 갈아끼운다 — 그래서 `post/Table.tsx`는 enum 맵을 쓰지 않고
`statusBadgeTone(라벨)` 경로를 쓴다. 이 갈림이 라벨 기준 설계를 택한 이유 그 자체다.

### 판단 근거가 필요한 배정

- **`활성` → 대기(그레이).** 지금은 초록 틴트다. 진행으로 넣으면 서비스 목록·공지 목록이
  통째로 빨개져서 못 쓴다. 활성은 굴러가는 정상 상태지 진행 중인 작업이 아니다.
  **이번 변경에서 시각적으로 가장 크게 달라지는 지점이다.**
- **`확인`·`진행` → 진행.** `중`으로 안 끝나지만 이미 손을 댄 단계다. 피드백 흐름이
  요청 → 확인 → 처리중 → 처리완료인데 확인이 그레이면 요청과 구분이 안 된다.
- **`수주` → 완료 / `실주` → 대기.** 둘 다 종결이지만 성과와 비성과다. 같은 색이면
  견적 목록에서 결과를 못 읽는다.
- **`검토`(개선안 목록) → 대기.** 진행에 넣을 여지가 있으나 목업 데이터 화면이라 규칙을
  단순하게 두는 쪽을 택했다.

## 범위

**한다** — 상태 배지 색맵 12개.

| 파일 | 맵 |
|---|---|
| `list-variants/status.ts` | `STATUS_COLOR` (공용) |
| `list-variants/post/Table.tsx` | 피드백·공지 라벨별 |
| `list-variants/handover/Table.tsx` | `STATUS_TONE` |
| `list-variants/incidents/Table.tsx` · `View.tsx` | `STATUS_TONE` ×2 |
| `list-variants/incident-reports/status.ts` | `STATUS_TONE` |
| `list-variants/meetings/status.ts` | `MEETING_STATUS_TONE` |
| `list-variants/quotes/Table.tsx` | `STATUS_TONE` |
| `list-variants/cohort/Table.tsx` | `COHORT_STATUS_COLOR` |
| `list-variants/backup/View.tsx` | `MAIL_STATUS_TONE` |
| `dashboard/handover/HandoverHistory.tsx` | `STATUS_TONE` |
| `_components/patterns/ProjectPattern.tsx` | `STATUS_COLOR` |

**안 한다** — 상태가 아닌 배지는 건드리지 않는다: `PRIORITY_COLOR`, `LEVEL_COLOR`,
`SCHEDULE_TYPE_COLOR`, `PERMISSION_COLOR`, `DOMAIN_TONE`, `AI_TOOL_TONE`, `CATEGORY_TONE`,
`LED_COLOR`, `DOT_COLOR`. 같은 색으로 통일하면 오히려 상태와 분류가 섞인다.

`STATUS_RING`(공용, 점 표시)도 이번 범위 밖이다 — 배지 배경이 아니라 도트 색이고, 규칙이 다르다.

### 조사 누락 (2026-08-11 구현 중 발견, 보강)

위 목록은 `_COLOR`/`_TONE` 이름으로만 훑어 만든 것이라 **`STATUS_BADGE` 계열 4곳을 빠뜨렸다.**
그대로 두면 같은 상태가 목록과 상세에서 다른 색이 되어, 이 설계가 없애려던 문제를 새로 만든다.
계획의 Task 4b가 닫는다.

| 파일 | 맵 | 문제 |
|---|---|---|
| `backup/Table.tsx` | `MAIL_STATUS_BADGE` | `backup/View.tsx`와 같은 6개 상태인데 옛 톤 유지 → 목록·상세 불일치 |
| `default/View.tsx` | `STATUS_BADGE` | 공용 `status.ts`를 안 쓰고 자체 복제본 보유 |
| `post/View.tsx` | `STATUS_BADGE` | 같음. 목록은 라벨 기준으로 옮겼는데 상세만 남음 |
| `team/View.tsx` | `STATUS_BADGE` | 같음 |

세 `View.tsx`는 전부 `statusLabel`을 바로 위에서 계산하고 있어, 로컬 맵을 **지우고**
`statusBadgeTone(statusLabel)`로 바꾸는 게 맞다. 값만 갈아끼우면 중복이 남는다.

**`장애` 라벨이 규칙에 없었다.** `default`·`team` 상세가 `urgent`를 "장애"로 부르는데
주의 집합에 없어 그레이로 떨어진다. `ATTENTION`에 추가한다.

**`cohort/Table.tsx`의 `inviteBadgeClass`(수락됨/수락 대기/미초대)는 범위 밖으로 둔다** —
초대 진행도라는 다른 축이고, 세 라벨 모두 4버킷에서는 `idle` 하나로 뭉쳐 구분이 사라진다.

## 선례

`incidents/Table.tsx`는 이미 한글 라벨을 키로 쓰고 `처리완료 → bg-ink text-cream`을 적용하고
있다. 이번 규칙은 그 화면을 전 메뉴로 넓히는 것이지 새 발명이 아니다.

## 검증

- `badge-tone.ts` 단위 테스트 — 매핑 표의 전 라벨(총 40여 개)이 기대 버킷을 돌려주는지.
  `중단`이 `중`으로 끝나지 않아 진행으로 안 새는지, `예약완료`가 완료로 안 새는지 포함
- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`
- 실화면: 의견·건의(피드백), 사고 기록, 인수인계, 경위서, 견적, 백업요청, 서비스 목록에서
  배지 색이 표대로 나오는지. 특히 **서비스 목록의 `활성`이 그레이로 바뀐 모습**을 눈으로 확인

## 위험

긴급(`#8e2412`)과 진행(`#b8331e`)이 둘 다 짙은 빨강이라 나란히 놓이면 구분이 약할 수 있다.
실물에서 안 갈리면 진행을 틴트(`bg-vermilion/15 text-vermilion`)로 내리는 게 대안이지만,
"~중은 빨간 배경"이라는 원래 지시에서 멀어진다. 일단 둘 다 솔리드로 가고 화면을 보고 정한다.
