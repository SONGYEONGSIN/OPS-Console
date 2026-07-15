# 개발 탭 원서제어 수동 분석 (웹 트리거 → PC 폴러) 설계

날짜: 2026-07-15 · 승인: 사용자 (브레인스토밍 Q&A 완료) · 상태: 설계 확정

## 목적

개발 탭의 원서제어 분석은 현재 매일 08:30 PC cron(전체 서비스)만 존재한다. 운영자가
특정 서비스를 **지금 재분석**하고 싶을 때 웹에서 트리거할 수 있게 한다.

분석 작업 자체는 원서GEN 로그인(MOA 계정) + `claude -p`(이 PC의 OAuth 구독)가 필요해
Vercel에서 실행 불가 → 서비스 마감 스크랩(PR #549)과 동일한 **풀(pull) 방식 원격 트리거**를
사용한다: 웹은 요청만 적재하고, 회사 PC 폴러가 claim해서 실행한다.

## 확정된 결정 (브레인스토밍 Q&A)

| 결정 | 선택 |
|---|---|
| 트리거 위치·범위 | 웹 개발탭 버튼 → **특정 서비스** 단위 |
| 권한 | **모든 운영자** (로그인 사용자) — 중복은 pending/running 가드로 방지 |
| 실행 경로 | PC 폴러(closing과 동일 풀 방식) |

## 데이터 흐름

```
웹 개발탭 인스펙터 '지금 분석' 버튼 (로그인 운영자)
  → server action requestDevControlAnalyze(serviceId)
      · 동일 service_id의 pending/running 존재 시 거부
      · dev_control_analyze_requests(status='pending') insert
  → PC 폴러 (작업 스케줄러 OPS-Console-DevControl-Poll, 5분 간격)
      → GET  /api/dev-controls/analyze-request  (Authorization: Bearer CRON_SECRET)
          · 가장 오래된 pending 1건 원자적 claim (→running)
      → node scripts/dev-control-analyze.mjs <serviceId>  실행
      → POST /api/dev-controls/analyze-request { id, ok, message }  (→done/failed)
  → 개발탭이 요청 상태를 배지로 표시 (pending/running/failed)
```

## 컴포넌트

### 1. DB — `dev_control_analyze_requests` (신규)

```sql
create table public.dev_control_analyze_requests (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null,
  requested_by text,
  status text not null default 'pending'
    check (status in ('pending','running','done','failed')),
  requested_at timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  message text
);
alter table public.dev_control_analyze_requests enable row level security;
create policy "dev_control_analyze_requests_select"
  on public.dev_control_analyze_requests for select to authenticated using (true);
grant select on public.dev_control_analyze_requests to authenticated;
grant all on public.dev_control_analyze_requests to service_role;
create index dev_control_analyze_requests_service_status_idx
  on public.dev_control_analyze_requests (service_id, status);
```

- write는 service_role(action의 admin client / API)만. authenticated는 read만(상태 표시용).
- 마이그레이션은 대시보드 수동 적용 + service_role 스모크 검증 (프로젝트 규칙).

### 2. API — `src/app/api/dev-controls/analyze-request/route.ts`

- `closing/scrape-request/route.ts`를 그대로 미러링:
  - GET → 가장 오래된 pending 1건 원자적 claim(`update … eq status pending` → running). 없으면 `{ request: null }`.
  - POST `{ id, ok, message }` → done/failed + finished_at.
  - `Authorization: Bearer ${CRON_SECRET}` 인증, service_role write.
- **proxy.ts `PUBLIC_PATHS`에 `/api/dev-controls/analyze-request` 등록 필수** — 누락 시
  세션 없는 폴러 호출이 /login HTML(200)로 리다이렉트돼 조용히 실패(선례의 대표 함정).

### 3. Server action — `requestDevControlAnalyze(serviceId)` (features/dev-controls/actions.ts)

- 로그인 확인(`getCurrentOperator`) — 미로그인 `{ ok:false, error }`.
- 입력 zod 검증 (serviceId: number).
- 동일 service_id에 status in (pending, running) 있으면 `{ ok:false, error:"이미 분석 대기/진행 중입니다" }`.
- admin client로 insert (requested_by = 로그인 이름/이메일). `revalidatePath("/dashboard/dev-test")`.

### 4. 폴러 — `scripts/dev-control/poll-local.ps1` + `register-poll-task.ps1`

- `scripts/moa-closing/`의 두 스크립트를 복사해 치환:
  - 엔드포인트 `/api/dev-controls/analyze-request`
  - 실행 커맨드 `node scripts/dev-control-analyze.mjs <claimed service_id>` (claim 응답의 service_id 사용)
  - 태스크명 `OPS-Console-DevControl-Poll`, 5분 간격
- 기존 `dev-control-analyze.cmd`(08:30 전체 실행)와 독립. 폴러는 claim된 단일 service_id만 실행.
- `run-local` 없이 poll-local이 직접 node를 호출(단일 스크립트라 run-local 분리 불요).

### 5. UI — 개발탭 인스펙터 (dev-control View)

- View 상단(요약 위)에 '지금 분석' 버튼 — `useTransition`으로 `requestDevControlAnalyze` 호출.
- 최근 요청 상태를 ListRow에 실어 전달: pending/running이면 버튼 비활성 + 배지("분석 대기"/"분석 중"),
  failed면 재시도 가능 + message 노출.
- 상태는 페이지 로드 시점 스냅샷(실시간 폴링 없음 — YAGNI). 사용자가 새로고침으로 갱신.

## 에러 처리

- 중복 요청 → action이 거부 메시지 반환(버튼도 in-flight면 비활성이라 이중 방어).
- 폴러 claim 경합 → closing과 동일 원자적 update(다른 폴러가 가져가면 null → 종료).
- run 실패 → message에 exit code, status=failed, UI failed 배지.
- CRON_SECRET 미설정/오인증 → 500/401 (기존 route 패턴).
- 폴러가 죽어 요청이 running에 고착 → 후속(비범위): stale running 타임아웃. 지금은 수동 재요청으로 대응.

## 테스트

- action: 중복 가드(pending 존재 시 거부) / 정상 insert / 미로그인 거부 (supabase admin mock).
- API route: GET 원자적 claim / POST done·failed 전이 / 미인증 401 (closing route 테스트 관례 복사).
- UI: 버튼 클릭 → action 호출 인자(serviceId) / pending 상태 시 버튼 disabled.
- 폴러(.ps1)는 단위 테스트 대상 아님 — 라이브 검증(웹 요청 → 폴러 claim → 실행 → done)으로 확인.

## 비범위 (YAGNI)

- 전체 서비스 웹 트리거 (08:30 cron 담당)
- 실시간 진행률/자동 새로고침 (배지 스냅샷으로 충분)
- 요청 취소 / stale running 자동 회수 (후속 필요 시)
- 요청 이력 목록 UI (요청 테이블은 상태 표시용, 이력 조회는 비범위)
