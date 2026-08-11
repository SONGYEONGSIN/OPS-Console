# AI TIP — GitHub 급상승 리포 자동 수집 설계

- 작성일: 2026-08-11
- 대상: `/dashboard/ai-tips` (분석 · AI > AI & 자동화 > AI TIP)
- 상태: 승인 대기

## 배경

TIP을 전부 손으로 채우고 있다. 부담은 두 군데다 — **공유할 만한 걸 찾는 일**과 **재사용 프롬프트를
쓰는 일**. 둘 다 자동화한다. GitHub에서 최근 뜨는 자동화·AI 리포를 주 1회 긁어와 claude로 TIP 초안까지
만들어 후보로 쌓고, 보다가 괜찮은 걸 한 번 눌러 TIP으로 올린다.

## 결정된 것

| 항목 | 결정 | 이유 |
|---|---|---|
| 수집 대상 | 최근 90일 내 생성 + 스타 200 이상 | 스타 1만짜리 유명 리포는 이미 아니까 반복해도 소용없다. '새로 뜨는 것'이 공유거리에 가깝다 |
| 적재 위치 | 별도 후보 테이블 | 기계가 만든 글이 검토 없이 팀 전체에 보이면 안 된다 |
| 초안 생성 | 회사 PC + `claude -p` | 프롬프트까지 만들어야 '쓰는 부담'이 없어진다. claude 구독 인증은 로그인 세션에서만 유효해 서버 크론으로는 불가 |
| 노출 위치 | TIP 페이지 안 후보 패널 | 후보는 TIP을 쓰기 위한 재료지 따로 관리할 대상이 아니다. 새 메뉴·새 variant를 만들지 않는다 |

## 흐름

```
회사 PC (주 1회, Windows 작업 스케줄러)
  scripts/ai-tips/collect-local.mjs
    1. GET /api/ai-tips/candidates  → 이미 본 repo_full_name 목록
    2. GitHub Search API            → 조건 맞는 리포, 이미 본 것 제외
    3. 상위 5건만: README 앞부분 → claude -p → TIP 초안
    4. POST /api/ai-tips/candidates → ai_tip_candidates 적재
                                       └ recordAutomationRun 호출

웹 (/dashboard/ai-tips)
  후보 패널 → [TIP으로 등록] → ai_tips 생성 + 후보 promoted
            → [숨김]        → 후보 hidden
```

## 수집 조건

```
q = "{topic} created:>{today-90d} stars:>=200"
sort = stars, order = desc
```

토픽은 상수 배열로 둔다: `automation`, `ai-agent`, `llm`, `workflow-automation`, `mcp`, `rpa`.
회차당 **상위 5건**만 처리한다 — claude 호출이 리포당 1회라 여기서 시간과 비용이 정해진다.

**임계값·토픽은 몇 회차 돌려보고 조정한다.** 노이즈가 많으면 스타를, 건질 게 없으면 토픽을 손본다.
처음부터 맞추려 해도 실제 결과를 봐야 안다.

### 중복 제외

`repo_full_name`이 유일 키다. `promoted`·`hidden`도 제외 대상에 포함한다 — 한 번 거른 리포가
다음 주에 다시 올라오면 거르는 의미가 없다.

## 데이터

`supabase/migrations/20260811_ai_tip_candidates.sql` (신규)

```sql
create table if not exists public.ai_tip_candidates (
  id                  uuid primary key default gen_random_uuid(),
  repo_full_name      text not null unique,      -- "owner/name"
  repo_url            text not null,
  stars               integer not null default 0,
  repo_description    text,
  draft_title         text,
  draft_summary_md    text,
  draft_reuse_prompt  text,
  draft_tags          text[] not null default '{}',
  draft_ai_tool       text,
  draft_category      text,
  status              text not null default 'pending'
                      check (status in ('pending', 'promoted', 'hidden')),
  collected_at        timestamptz not null default now()
);
```

`draft_*`가 전부 nullable인 것은 의도다 — claude가 실패해도 리포 정보만으로 후보를 남긴다(아래 참조).

RLS: read는 authenticated 전원, insert는 service_role(수집 API), update는 authenticated
(승인·숨김은 웹에서 사람이 누른다). `ai_tips` 본체는 **스키마 변경 없다.**

## 승인 동작 — 설계 변경 1건

구두로는 "폼이 초안으로 채워진 채 열리고 고쳐서 저장"이라고 했는데, **바꾼다.**

`ListPattern`은 새 행을 variant 레지스트리의 `blank()`에서 만든다(`ListPattern.tsx:948-954`).
후보 값을 그 자리에 밀어넣으려면 공용 컴포넌트에 seed 배선을 새로 내야 하고, 인스펙터를 자동으로
여는 장치도 따로 필요하다. 31개 도메인이 함께 쓰는 파일이라 이 기능 하나로 건드릴 만한 곳이 아니다.

대신 **[TIP으로 등록]이 초안 그대로 TIP을 만들고**(작성자 = 누른 사람), 목록에 뜬 그 TIP을 평소처럼
클릭해서 고친다. 검토는 이미 후보 패널에서 초안을 읽고 누르는 시점에 끝났으므로, 검토 없이 올라가는
것은 아니다. 공용 파일 무변경으로 같은 결과에 도달한다.

## 화면

`ai-tips/page.tsx`가 `ListPattern`에 넘기는 `header`에 후보 패널을 얹는다 —
`header={<><PageHeader …/><TipCandidatePanel …/></>}`. `ListPattern`에 새 prop을 만들지 않는다.

후보 0건이면 패널 자체를 렌더하지 않는다. 있을 때만 "수집된 후보 N건"으로 뜬다.

각 후보에 표시할 것: 리포명(링크) · 스타 · 리포 설명 · 초안 제목/요약/프롬프트 미리보기 ·
[TIP으로 등록] / [숨김].

## 실패 처리

| 상황 | 처리 |
|---|---|
| claude 초안 생성 실패 | **초안 없이 리포 정보만 저장한다.** 수집을 통째로 버리면 그 주 리포를 영영 놓친다. 패널에는 "초안 없음"으로 뜨고, 등록하면 빈 폼에서 직접 쓰면 된다 |
| GitHub API rate limit | 그 회차는 수집 0건으로 종료. `automation_runs`에 실패로 남아 일일 보고에 잡힌다 |
| README가 없거나 너무 김 | 앞부분 8000자만 claude에 넘긴다. 없으면 description만으로 생성 시도 |
| 같은 리포 재등장 | unique 제약 → upsert 대신 무시. 이미 promoted/hidden이어도 마찬가지 |

`AI_TIPS_COLLECT_DRY_RUN=true`면 적재 없이 판정만 한다.

## 환경 변수와 배선

스크립트(회사 PC)가 쓰는 것 — 팀 뉴스레터 발행기와 같다:

- `OPS_CONSOLE_BASE_URL` · `CRON_SECRET` — 서버 API 호출용 (이미 있음)
- `GITHUB_TOKEN` — GitHub Search API 인증. 미인증은 분당 10회, 인증은 30회다.
  기존 `GITHUB_DISPATCH_TOKEN`은 워크플로 dispatch 용도라 스코프가 다를 수 있으니 **재사용하지 않고
  읽기 전용 토큰을 새로 넣는다.** 없으면 미인증으로 동작하되 회차당 5건이라 한도에 걸리지 않는다
- `AI_TIPS_COLLECT_DRY_RUN`

**`/api/ai-tips/candidates`는 `proxy.ts`의 `PUBLIC_PATHS`에 등록해야 한다.** 이 프로젝트의 프록시는
미인증 요청을 `/login`으로 돌리는데, CRON_SECRET으로 인증하는 엔드포인트는 세션이 없다. 등록하지 않으면
스크립트가 200 대신 로그인 페이지 HTML을 받아 조용히 실패한다. 마감 스크랩 엔드포인트를 만들 때
같은 데서 걸렸다.

## 자동화 등록

`registry.ts`에 `localOnly: true` 잡으로 1줄 추가한다. 실행 자체는 회사 PC가 하지만,
등록해두면 자동화 페이지에서 마지막 실행이 보이고 **PC가 꺼져 며칠 안 돌면 일일 보고가
'미실행'으로 잡아준다**(`cadence: "weekly"`). 수집 API가 `recordAutomationRun`을 호출해야
그 경로에 잡힌다 — `/api/closing/run-log`와 같은 구조다.

## 범위 밖

- TIP 본체(`ai_tips`) 스키마·RLS 변경
- 후보 전용 메뉴·사이드바 항목·list variant
- GitHub 외 소스(트렌딩 페이지 스크랩, star한 리포, 우리 조직 리포)
- 후보 자동 만료·정리 — 몇 회차 쌓여봐야 필요 여부를 안다

## 검증

- 순수 함수 단위 테스트: 검색 쿼리 조립, 중복 제외, claude 응답 파싱, 초안 없는 후보 처리
- API 라우트: CRON_SECRET 인증, 중복 무시, `recordAutomationRun` 호출
- 패널 렌더: 후보 0건이면 미표시 / 초안 없는 후보 표기 / 버튼 존재
- 승인 액션: TIP 생성 + 후보 promoted 전이
- 실경로 1회: `--dry`로 스크립트를 돌려 GitHub 조회와 claude 생성이 실제로 되는지 확인.
  단위 테스트는 둘 다 목이라 여기서만 드러난다
