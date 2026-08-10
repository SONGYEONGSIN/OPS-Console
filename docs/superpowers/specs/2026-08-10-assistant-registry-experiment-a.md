# 실험 A — 레지스트리가 진짜 도메인을 담는가

**질문**: 아직 등록되지 않은 도메인 3개를 `DomainEntry` 선언형 필드만으로 채울 수 있는가?
**판정 기준**: 3개 모두 `kind: "custom"` 예외 없이 채워지면 성공. **2개 이상이 예외를 요구하면 추상이 틀린 것 → 0단계를 접는다.**
**날짜**: 2026-08-10 / 코드 변경 0줄

실제 컬럼은 DB에서 조회했고, `deepLink`의 메뉴 slug·라우트 실재도 확인했다(추측 없음).

---

## 1. `news` — 운영부 뉴스 (1,010행)

실 컬럼: `id, link, title, source, published_at, summary, keyword, collected_at`

```ts
{
  kind: "table",
  domain: "news",
  label: "운영부 뉴스",
  table: "news",
  columns: ["id", "title", "source", "summary", "keyword", "published_at", "link"],
  orderBy: { column: "published_at", ascending: false },
  searchFields: ["title", "summary", "keyword", "source"],
  snippetFields: ["summary", "title"],
  deepLink: "/dashboard/news",
  title: (r) => `${r.source ?? "—"} — ${r.title}`,
}
```

**판정: ✅ 선언형으로 채워짐.**

## 2. `automation_runs` — 자동화 실행 이력 (7,721행)

실 컬럼: `id, job_id, ran_at, ok, skipped, message, duration_ms, created_at`

```ts
{
  kind: "table",
  domain: "automation-run",
  label: "자동화 실행 이력",
  table: "automation_runs",
  columns: ["id", "job_id", "ran_at", "ok", "skipped", "message", "duration_ms"],
  orderBy: { column: "ran_at", ascending: false },
  searchFields: ["job_id", "message"],
  snippetFields: ["message"],
  deepLink: "/dashboard/automations",
  title: (r) => `${getJob(String(r.job_id))?.label ?? r.job_id} — ${r.ok ? "성공" : "실패"}`,
}
```

**판정: ✅ 선언형으로 채워짐.** 단 아래 결함 A에 걸린다.

## 3. `schedule_events` — 운영부 일정 (55행)

실 컬럼: `id, type, title, description, start_at, end_at, all_day, assignee_email, created_by_email, created_at, updated_at`

```ts
{
  kind: "table",
  domain: "schedule",
  label: "운영부 일정",
  table: "schedule_events",
  columns: ["id", "type", "title", "description", "start_at", "end_at", "all_day", "assignee_email"],
  orderBy: { column: "start_at", ascending: false },
  searchFields: ["title", "description", "type", "assignee_email"],
  snippetFields: ["description", "title"],
  deepLink: "/dashboard/schedule",
  title: (r) => String(r.title ?? "(제목 없음)"),
}
```

**판정: ✅ 선언형으로 채워짐.** 단 결함 A·C에 걸린다.

---

# 결과: 성공 (3/3, `custom` 예외 0개)

**판정 기준을 통과했다. 0단계를 진행한다.**

다만 채워보는 과정에서 결함 3개가 드러났다. 셋 다 `custom` 탈출구를 요구하지 않으므로 실험은 성공이지만, **1개는 0단계 설계를 고쳐야 한다.**

---

## 결함 A — 코드값이 한국어 질문과 안 맞는다 (0단계에 반영 필요)

`automation_runs.job_id`는 `"ratio-audit"`이고 `schedule_events.type`은 `"leave"`다. 사용자는 **"경쟁률 점검 실패했어?"**, **"다음 주 휴가 누구야?"** 라고 묻는다.

현재 `searchFields`는 **컬럼 이름만** 나열할 수 있어 haystack에 영어 코드값만 들어간다. `"경쟁률"` 토큰은 `"ratio-audit"`에 걸리지 않는다 → **에러 없이 검색이 0건이 된다.** 가장 나쁜 실패 형태다.

기존 6도메인에는 이 문제가 없었다(전부 한국어 텍스트 컬럼). 새 도메인을 붙이면서 처음 드러난 것이다.

**해결**: `DomainEntry`에 파생 필드를 연다.

```ts
/** 컬럼값이 코드(job_id·type)라 한국어 질문에 안 걸릴 때, haystack에 더할 텍스트 */
derivedSearchText?: (row: Record<string, unknown>) => string;
```

`automation_runs`면 `getJob(job_id)?.label`, `schedule_events`면 `SCHEDULE_TYPE_LABEL[type]`을 돌려준다. `custom` 탈출구와 다르다 — 데이터를 **가져오는** 방식은 그대로 선언형이고, haystack에 텍스트 한 줄을 **더할** 뿐이다.

> **0단계 계획 수정**: `types.ts`에 이 옵셔널 필드를 추가하고, 러너가 `searchFields` 결과 뒤에 이어 붙인다. 기존 6도메인은 이 필드를 쓰지 않으므로 **동작 변화 0 원칙은 유지된다.** 특성화 테스트도 그대로 통과한다.

## 결함 B — `Source`에 외부 링크 자리가 없다 (1단계로 미룸)

뉴스는 기사 원문 URL(`news.link`)이 핵심인데 `Source`에는 `deepLink`(콘솔 내부 경로)만 있다. 지금 구조로는 "이 기사 원문 보기"를 줄 수 없다.

`Source`에 `externalUrl?: string`을 더하면 되지만, **`Source`는 6도메인이 공유하는 공개 타입**이라 0단계(동작 변화 0)에서 건드리면 원칙이 깨진다. **1단계에서 news 도메인을 등록할 때 함께 한다.**

## 결함 C — 토큰 매칭으로는 날짜 질문을 못 푼다 (설계 한계, 별도 과제)

**"다음 주 누가 휴가야?"** 는 `schedule_events`를 날짜 범위로 걸러야 하는데, 현재 검색은 문자열 토큰 매칭이라 `"다음"`·`"주"`가 텍스트에 있는지만 본다. 레지스트리를 어떻게 채워도 안 된다.

이건 레지스트리의 결함이 아니라 **검색 모델 자체의 한계**다(`search.ts` 주석의 "MVP: 단순 token 매칭, 추후 임베딩"이 가리키는 지점). 0단계·1단계 범위 밖이며, 4단계(검색 품질)의 실제 근거가 된다.

**당분간의 정직한 처리**: 날짜 조건이 붙은 질문은 답을 지어내지 말고 **"일정은 *이번 달 > 운영부 달력*에서 기간으로 보시는 게 정확합니다"** 로 메뉴 안내에 착지시킨다 — 요구사항 3(얼버무리지 않기)과 같은 원칙이다.

## 부수 관찰 — `FETCH_LIMIT_PER_DOMAIN = 200`

`automation_runs`는 7,721행인데 최신 200건만 검색 대상이다. "지난달 실패한 잡"류 질문은 범위 밖으로 조용히 빠진다. 0단계는 상수를 바꾸지 않으므로(동작 변화 0) 그대로 두되, **1단계에서 도메인별 상한을 레지스트리 필드로 열지 검토**한다.

---

## 다음 행동

1. **0단계 계획에 `derivedSearchText` 추가** — Task 2(타입·러너)와 Task 4(구조 불변식 테스트)에 반영
2. 결함 B·C·부수 관찰은 1단계·4단계 근거로 이 문서에 남긴다
3. 실험 B(시스템 지식 15문항)는 0단계와 독립이므로 병행 가능
