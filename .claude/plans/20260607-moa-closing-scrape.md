# 설계 문서 — Moa 서비스조회 스크래핑 → 서비스마감(closing) 자동화

작성: 2026-06-07 (planner) · HARD-GATE: **전체 설계 (20+ 파일)**
전제: `.claude/memory/brainstorms/20260607-132803-moa-closing-scrape.md` (대안 A 확정, 결정 업데이트 1·2 포함). 본 문서의 모든 결정은 brainstorm을 변경 없이 구체화한 것이다.

---

## 1. 설계 개요

- **목표**: Moa 관리자(ServiceSearch)를 격주 무인 스크래핑하여 "작성마감이 지난 서비스"만 추출, OPS-Console `/dashboard/closing`에 표시한다. SMS 2FA를 make.com 웹훅 GET 폴링으로 자동 통과한다.
- **제약**:
  - Next 서버리스/cron 런타임에 브라우저 없음 → **GitHub Actions + Python/Selenium** (SmileEDI 인프라 재사용).
  - **SMS 2FA**가 최대 난점 — 외부 의존(Tasker→make→Data Store), 신선도/타임아웃 필요.
  - 표준 cron으로 2주 격주 불가 → 주간 트리거 + **ISO주 패리티 게이트**.
  - Moa DOM 변경 리스크, make/Tasker 단절 시 2FA 실패.
- **접근 방식 A (확정)**: GH Actions Python/Selenium 스크래퍼 → OPS 신규 인제스트 API(`POST /api/closing/ingest`, Bearer CRON_SECRET) → `closing_services` 멱등 적재 → closing 페이지(list-variant). SmileEDI workflow_dispatch / setup-python+chrome / cron-job.org / 시크릿 패턴 그대로.
  - 장점: 방금 구축한 인프라 재사용 → 신규 비용 최소. 중간 파일(SharePoint) 없이 데이터 소유·zod 검증이 깔끔. closing 메뉴 이미 등록됨.
  - 단점: Python 스크래퍼 신규 작성(2FA 폴링 포함). 외부 의존(make/Tasker) 운영 부담.
- **접근 방식 B (기각)**: TS/Playwright 스크래퍼. SmileEDI(Python)와 스택 이원화 → 유지보수 부담. 동일 외부 의존이라 언어 이득 없음.
- **선택**: **A** — brainstorm 추천. SmileEDI 패턴 2회 적용으로 사내 스크래핑 표준화.
- **검증 전략**:
  - 단위: fiscal-year(학년도 경계/윤년/시각 포맷), closing 필터(작성마감<scraped_at), ISO주 패리티 게이트, zod 인제스트 스키마, row-mapper. RED→GREEN.
  - 통합: 인제스트 API 멱등성(동일 payload 2회 → row 수 동일), 인증(잘못된 Bearer → 401).
  - 수동/E2E: closing 페이지 렌더(빈 상태/데이터), RLS(member select OK / authenticated insert 차단), 스크래퍼 dry-run(`CLOSING_DRY_RUN=true` → API 미전송, 추출 결과 로그만), 워크플로 `workflow_dispatch` 1회 격주 게이트 통과/스킵 확인.

---

## 2. Phase 분해 (의존 순서)

```
Phase 0 (설계 산출물 — 본 문서)
   └─ Phase 1: OPS 측 (DB + 인제스트 API + closing 페이지 + variant)  ← 독립 머지 가능
         └─ Phase 2: 스크래퍼 + 워크플로 + SMS 2FA  ← Phase 1 인제스트 API에 의존
```

**Phase 1을 먼저 완성·머지**하면 스크래퍼 없이도 closing 페이지가 동작(수동 insert로 검증 가능)하고, Phase 2는 완성된 인제스트 계약에 맞춰 작성한다. brainstorm "가역성 높음"과 일치.

---

## 3. closing_services 스키마 초안

```sql
create table if not exists public.closing_services (
  id              uuid primary key default uuid_generate_v4(),
  service_id      integer not null unique,   -- Moa 서비스ID (멱등 upsert 키)
  university_name text not null,             -- 대학명
  region          text,                      -- 지역
  service_name    text not null,             -- 서비스명
  university_type text,                       -- 대학구분
  category        text,                       -- 카테고리
  operator_name   text,                       -- 운영자 (Moa 표기 문자열)
  developer_name  text,                       -- 개발자
  write_start_at  timestamptz,                -- 작성시작
  write_end_at    timestamptz not null,       -- 작성마감 (마감 필터 기준)
  solo            boolean not null default false, -- 단독여부
  scraped_at      timestamptz not null,       -- 스크래핑 시각 (배치 식별 + 마감판정 기준시각)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists closing_services_write_end_at_idx on public.closing_services (write_end_at desc);
create index if not exists closing_services_scraped_at_idx on public.closing_services (scraped_at desc);
```

- 11컬럼 + scraped_at + id/created/updated = 15컬럼. service_id `unique` → upsert 키.
- 운영자/개발자는 Moa 표기 문자열 그대로(email 매핑 안 함 — brainstorm 11컬럼에 email 없음). 향후 operators 조인은 별도 작업.
- `updated_at` 자동 갱신 트리거는 다른 테이블 관례 확인 후 동일 적용(대부분 앱 레벨 갱신이면 생략 — 일관성 우선).

### RLS (insight_videos 패턴 그대로)
- `select`: `to authenticated using (true)` — 운영부 전체 read (admin/member/viewer 모두). brainstorm "표시" 요구가 read 한정이라 menu-guard(`requireMenu("closing")`)가 메뉴 노출을 통제, RLS는 전원 read.
- `insert/update/delete`: 정책 없음 → authenticated 차단. **service_role(RLS bypass)만 쓰기** = 인제스트 API.
- GRANT: `grant select ... to authenticated; grant all ... to service_role;` (42501 함정 회피).

### 멱등 전략 — **전체 대체(delete-all + insert)** 권장
- 근거: 격주 배치가 "현재 마감된 전체 스냅샷"을 적재. 지난 배치에서 마감이었으나 이번에 사라진 건(데이터 정정 등)을 제거하려면 전체 대체가 정확. service_id upsert만 하면 stale row가 남는다.
- 구현: 인제스트 API가 단일 트랜잭션으로 `delete from closing_services` 후 새 batch insert. 동일 `scraped_at` 부여로 배치 일관.
- 대안(upsert)은 "삭제 추적 불요"일 때만. brainstorw 성공기준(5) "재실행 시 멱등(대체 적재)"이 **대체**를 명시 → 전체 대체 채택.
- 안전장치: 빈 배열 payload는 거부(전체 삭제 사고 방지) — `rows.length === 0`이면 400. (스크래퍼가 0건이면 애초에 호출하지 않거나 명시 플래그 필요. T 분해에서 처리.)

---

## 4. 인제스트 API 계약 (`POST /api/closing/ingest`)

- **인증**: `Authorization: Bearer ${CRON_SECRET}` — `/api/automations/run`과 동일 검증 로직(secret 미설정 500 / 불일치 401). cron 전용.
- **요청 body (zod)**:
  ```ts
  // src/features/closing/schemas.ts
  const closingRowSchema = z.object({
    service_id: z.number().int().positive(),
    university_name: z.string().min(1),
    region: z.string().nullable().optional(),
    service_name: z.string().min(1),
    university_type: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    operator_name: z.string().nullable().optional(),
    developer_name: z.string().nullable().optional(),
    write_start_at: z.string().datetime({ offset: true }).nullable().optional(),
    write_end_at: z.string().datetime({ offset: true }),
    solo: z.boolean(),
  });
  const closingIngestSchema = z.object({
    scraped_at: z.string().datetime({ offset: true }),
    rows: z.array(closingRowSchema).min(1), // 빈 배열 거부
  });
  ```
- **처리**: 검증 통과 → `createAdminClient()`(service_role) → 트랜잭션으로 delete-all + insert(scraped_at 주입). zod 에러는 `parsed.error.issues[0].message`.
- **응답**: `{ ok: true, inserted: N }` / 실패 `{ ok: false, error }` (400/401/500).
- **참고 패턴**: `src/app/api/worklog/log/route.ts`(POST+zod), `src/app/api/automations/run/route.ts`(Bearer 검증).
- **날짜 정규화**: 스크래퍼는 Moa 표시값(예: `2026-03-01 18:00`)을 **KST(+09:00) 포함 ISO8601**로 보내 timestamptz 일관. 마감 필터는 스크래퍼가 이미 수행(작성마감<scraped_at)하므로 API는 재필터 안 함(신뢰 경계는 zod 형식 검증까지).

---

## 5. 학년도 date util 규칙 (closing 전용)

SmileEDI `fiscal-year.ts`와 **다른 경계**(회계연도 4/1 아님) → 신규 `src/features/closing/academic-year.ts`.

- 규칙: start = `{startYear}-03-01 00:01`, end = `{startYear+1}-02-{말일} 23:59` (KST).
- startYear: KST 월 ≥ 3 → 올해, 1~2월 → 작년.
- 윤년: 익년 2월 말일(28 또는 29) 동적 산출.
- **반환 포맷**: Moa 검색 폼 입력 형식에 맞춤. SmileEDI는 `YYYYMMDD`였으나 closing은 시각 포함 → 실제 Moa 폼 포맷(날짜/시각 분리 input인지 단일 input인지)은 Phase 2 DOM 조사로 확정. util은 우선 구조화 반환(`{ start: {date, time}, end: {date, time} }`)으로 설계해 포맷 변환을 스크래퍼가 담당.
- **테스트 케이스** (RED):
  | now (KST) | startYear | start | end |
  |---|---|---|---|
  | 2026-06-07 | 2026 | 2026-03-01 00:01 | 2027-02-28 23:59 |
  | 2026-01-15 | 2025 | 2025-03-01 00:01 | 2026-02-28 23:59 |
  | 2027-06-01 | 2027 | 2027-03-01 00:01 | 2028-02-29 23:59 (윤년) |
  | 2026-03-01 00:00 | 2026 | 2026-03-01 00:01 | 2027-02-28 23:59 (3월 경계) |
  | 2026-02-28 23:59 | 2025 | 2025-03-01 00:01 | 2026-02-28 23:59 |
  - UTC↔KST 경계: `2026-02-28T15:30:00Z`(=KST 3/1 00:30) → startYear 2026 (SmileEDI 테스트 동일 기법).
- TS util은 페이지/문서용 단일 소스이되, **스크래퍼(Python)는 동일 규칙을 Python으로 재구현**(언어 경계). 두 구현의 동치성은 테스트 케이스 표를 양쪽에 적용해 보장.

---

## 6. SMS 2FA 폴링 로직 설계 (최고 위험 — 상세)

흐름: 스크래퍼가 로그인 폼 제출 → Moa가 휴대폰으로 SMS 발송 → Tasker가 SMS 수신 → make 웹훅(POST)로 코드+수신시각 전달 → make Data Store 저장 → 스크래퍼가 **GET `MAKE_SMS_CODE_URL`** 폴링으로 최신 코드 회수 → 신선도 판별 후 입력 → 확인.

### 6.1 신선도(freshness) 판별
- **문제**: Data Store에 직전 로그인의 옛 코드가 남아있을 수 있음 → 옛 코드 입력 시 실패.
- **기준 시각**: 스크래퍼가 로그인 제출 **직전** `submit_ts = now()`(UTC)를 기록.
- **판별**: make GET 응답에 코드의 **수신 타임스탬프**(Tasker가 SMS 받은 시각 또는 make 저장 시각)가 포함돼야 함. `code_ts > submit_ts - skew` 인 코드만 유효.
  - `skew`(허용 오차) = 약 -10초 (시계 차이 보정). 너무 크면 옛 코드 오입력 위험 → 보수적으로 작게.
  - **make 응답 계약 요구**: `{ code: "123456", received_at: "ISO8601" }`. received_at 없으면 신선도 판별 불가 → make 시나리오에서 타임스탬프 필드 추가 필수(Phase 2 선결).
- **폴백 대안**(타임스탬프 미제공 시): "GET 직전 Data Store 비우기(make에 reset 엔드포인트) → 로그인 제출 → 새 코드만 들어오므로 가장 최근 것 사용". 단 reset 엔드포인트 신설 필요. 1차는 타임스탬프 방식, 불가 시 reset 방식.

### 6.2 폴링 타임아웃·재시도
- 파라미터(전부 env, 하드코딩 금지):
  - `MOA_SMS_POLL_TIMEOUT_SEC` 기본 **120초** (SMS 도착 지연 대비).
  - `MOA_SMS_POLL_INTERVAL_SEC` 기본 **5초** (≈24회 폴링).
  - `MOA_SMS_CODE_MIN_TS_SKEW_SEC` 기본 **10초**.
- 루프: interval마다 GET → 신선 코드 있으면 break → 없으면 sleep. 타임아웃 도달 시 **명시적 실패**(에러 raise, 코드 입력 시도 안 함). 폴백 로직 금지(donts) — 실패는 워크플로 실패로 노출.
- **재시도**: 코드 입력 후 Moa가 "코드 불일치" 표시 시 → 신선도 재확인 후 **최대 N회(기본 2)** 재폴링. 그래도 실패면 abort.

### 6.3 실패 처리 (관측 가능성)
- 단계별 `print("[FAIL] ...")` 로그(SmileEDI 동일 컨벤션) + non-zero exit → GH Actions job 실패 → 알림(워크플로 실패 알림은 GH 기본 또는 후속).
- **시크릿 마스킹**: SMS 코드는 로그에 평문 노출 금지(마지막 2자리만 등). MOA_PASSWORD 미출력.
- **인제스트 미전송**: 2FA 실패 시 부분 데이터 전송 안 함(전체 대체 멱등이라 부분 전송이 더 위험). 성공 경로에서만 1회 POST.
- 타임존: submit_ts/code_ts 비교는 UTC 통일(Python `datetime.now(timezone.utc)`).

### 6.4 위험 요약 (이 절이 프로젝트 최대 리스크)
- 외부 의존 3중(휴대폰·Tasker·make) 중 하나라도 끊기면 2FA 실패 → 격주 배치 누락. 누락은 다음 격주까지 미감지 가능 → **실패 알림 필수**.
- Moa가 SMS 2FA 정책/문구를 바꾸면 셀렉터·플로우 깨짐 → DOM 셀렉터를 다중 후보로(SmileEDI `start_date_selectors` 패턴) 작성.

---

## 7. ISO주 패리티 격주 게이트

- cron-job.org가 **매주 월 10:00** workflow_dispatch 호출 → 워크플로/잡이 격주만 실제 실행.
- 게이트 로직: "이번 주 월요일"의 **ISO week number 패리티**로 판정.
  - Python: `iso_week = date.today().isocalendar()[1]` → `iso_week % 2 == TARGET_PARITY` 이면 실행, 아니면 skip(exit 0).
  - `TARGET_PARITY`(0 또는 1) = env. 기준주(brainstorm 선결: "어느 월요일부터")를 보고 패리티 값 결정 → **열린 질문 Q1**.
- **ISO week 연말 경계 주의**: ISO week 52→53→1 전환 시 연속 2주가 같은 패리티가 될 수 있음(53주 해). 단순 `week % 2`는 해 경계에서 한 번 어긋날 수 있다.
  - 보정안: 패리티 기준을 "고정 기준일(anchor Monday)로부터의 경과 주 수"로 계산 → `floor((thisMonday - anchorMonday).days / 7) % 2`. 이 방식이 연 경계에 강건 → **권장**.
  - util화: `src/features/closing/biweekly-gate.ts`(TS, 테스트용 단일 소스) + Python 동일 재구현. 테스트로 동치 보장.
- **게이트 배치 위치**: 워크플로 첫 스텝(또는 스크래퍼 진입 직후). skip이면 후속 스텝 안 함. brainstorm "워크플로/잡이 게이트"와 일치 — 워크플로 스텝 if 조건 + 스크래퍼 내부 이중 가드 권장(워크플로 if는 GH expression 한계로 anchor 계산 어려움 → **스크래퍼 진입 시 Python 게이트가 1차, exit 0 skip**이 단순·강건).

---

## 8. 시크릿 / 환경변수 목록

### GH Actions Secrets (스크래퍼 런타임)
| 변수 | 용도 | 비고 |
|---|---|---|
| `MOA_USERNAME` | Moa 로그인 ID | 신규 |
| `MOA_PASSWORD` | Moa 로그인 PW | 신규 |
| `MAKE_SMS_CODE_URL` | SMS 코드 GET 폴링 URL | 신규 (`https://hook.eu2.make.com/enfpm5...`) |
| `CRON_SECRET` | 인제스트 API Bearer | **기존 재사용** |
| `OPS_CONSOLE_BASE_URL` | 인제스트 API base | **기존 재사용** |

### GH Actions env (비밀 아님, 워크플로 inline)
| 변수 | 기본 | 용도 |
|---|---|---|
| `HEADLESS_MODE` | true | 헤드리스 |
| `MOA_SMS_POLL_TIMEOUT_SEC` | 120 | 폴링 타임아웃 |
| `MOA_SMS_POLL_INTERVAL_SEC` | 5 | 폴링 간격 |
| `MOA_SMS_CODE_MIN_TS_SKEW_SEC` | 10 | 신선도 허용오차 |
| `MOA_SMS_MAX_RETRY` | 2 | 코드 재시도 |
| `CLOSING_BIWEEKLY_ANCHOR` | (Q1 확정) | 격주 기준 월요일 |
| `CLOSING_DRY_RUN` | false | true 시 API 미전송(추출만) |

### OPS-Console env (Vercel)
| 변수 | 비고 |
|---|---|
| `CRON_SECRET` | 기존 — 인제스트 API 검증 |
| `SUPABASE_SERVICE_ROLE_KEY` | 기존 — admin client 적재 |
| `NEXT_PUBLIC_SUPABASE_URL` | 기존 |

- settings 환경 스냅샷(`settings/_env.ts`)에 `CLOSING_DRY_RUN` 노출 검토(기존 MAIL_*_DRY_RUN 관례). Phase 1 선택 태스크.

---

## 9. closing 페이지 — list 패턴 재사용 + variant 신설

- closing 메뉴는 `src/app/dashboard/_data.ts`에 slug `closing`, pattern `list`로 **이미 등록**(페이지·variant 미구현).
- **list 패턴 재사용 가능**: `ListPattern` + `requireMenu("closing")` + `resolvePageMeta` 그대로. services 페이지가 정확한 템플릿.
- **신규 variant 비용**(CLAUDE.md "신규 도메인 추가 비용" = 1 폴더 + registry 1줄 + types union 1줄):
  - `list-variants/closing/` 폴더: `View.tsx`(인스펙터 읽기 — 11컬럼 표시), `Table.tsx`(목록 11컬럼), `filters.ts`(지역/카테고리/대학구분 chip 또는 `Filters: []`). EditForm **불필요**(읽기 전용 — 스크래핑 소스, 수기 편집 없음 → worklog/assignments variant처럼 View+Table만).
  - `types.ts` Variant union에 `"closing"` 추가.
  - `registry.ts`에 `closing: { View, Table, Filters }` 추가.
- **읽기 전용 결정**: 데이터 출처가 자동 스크래핑이므로 사용자가 편집/생성하지 않음 → `readOnly`, `canCreate=false`. (services와 달리 onPersist 불필요.)
- **row-mapper**: `src/app/dashboard/closing/_row-mapper.ts` — `ClosingRow`(DB) → `ListRow`. services row-mapper가 템플릿. ListRow에 closing 전용 필드가 이미 있는지 확인 필요(serviceIdNum/universityName/serviceName/category/region/universityType/operatorName/developerName/writeStartAt/writeEndAt/solo 대부분 존재 → 재사용, scraped_at만 신규 필드 추가 검토).
- **queries**: `src/features/closing/queries.ts` — `listClosing(filter)` (server client, select). 정렬 기본 `write_end_at desc`. 페이지네이션(ListPagination) 30/페이지.

### designer 필요 여부 판단
- **불필요**. 신규 디자인 토큰·색상·레이아웃 없음. services list-variant의 기존 시각 언어를 그대로 따르는 표/인스펙터이며, 11컬럼은 정보 밀도만 다름. status 배지도 `status.ts` 기존 상수 활용(또는 마감=단일 상태). 디자인 토큰 위반 가능성 낮고 `hooks/design-lint.sh`가 Write 시 자동 점검. → **planner+coder로 충분, designer 위임 생략.** (단 11컬럼 가로 스크롤 UX가 어색하면 그때 designer 호출.)

---

## 10. 영향 파일 (전체)

### Phase 1 — OPS (DB + API + 페이지 + variant)
| 파일 | 유형 | 설명 |
|---|---|---|
| `supabase/migrations/202606XX_closing_services_table.sql` | 신규 | 테이블 15컬럼 + 인덱스 |
| `supabase/migrations/202606XXb_closing_services_rls.sql` | 신규 | RLS select-all + GRANT |
| `src/features/closing/schemas.ts` | 신규 | zod(closingRow/closingIngest) + `ClosingRow` 타입 |
| `src/features/closing/queries.ts` | 신규 | `listClosing(filter)` server select |
| `src/features/closing/academic-year.ts` | 신규 | 학년도 범위 util(TS, 문서/검증 소스) |
| `src/features/closing/biweekly-gate.ts` | 신규 | anchor 기반 격주 게이트 util(TS) |
| `src/features/closing/__tests__/academic-year.test.ts` | 신규 | 경계/윤년/시각 케이스 |
| `src/features/closing/__tests__/biweekly-gate.test.ts` | 신규 | 패리티/연경계 |
| `src/features/closing/__tests__/schemas.test.ts` | 신규 | zod 통과/거부(빈 배열) |
| `src/app/api/closing/ingest/route.ts` | 신규 | POST Bearer + zod + 전체대체 적재 |
| `src/app/api/closing/ingest/__tests__/route.test.ts` | 신규 | 인증/멱등/검증(가능 범위) |
| `src/app/dashboard/closing/page.tsx` | 신규 | list 패턴 페이지(읽기 전용) |
| `src/app/dashboard/closing/_row-mapper.ts` | 신규 | ClosingRow→ListRow |
| `src/app/dashboard/_components/inspector/list-variants/closing/View.tsx` | 신규 | 인스펙터 읽기 |
| `src/app/dashboard/_components/inspector/list-variants/closing/Table.tsx` | 신규 | 11컬럼 목록 |
| `src/app/dashboard/_components/inspector/list-variants/closing/filters.ts` | 신규 | filter 옵션(또는 []) |
| `src/app/dashboard/_components/inspector/list-variants/closing/__tests__/Table.test.tsx` | 신규 | 렌더/컬럼 |
| `src/app/dashboard/_components/inspector/list-variants/types.ts` | 수정 | Variant union에 `"closing"` |
| `src/app/dashboard/_components/inspector/list-variants/registry.ts` | 수정 | `closing` 엔트리 1줄(+import) |
| `src/app/dashboard/_components/patterns/ListPattern.tsx` | 수정(검토) | ListRow에 `scrapedAt` 필드 필요 시만 |
| `src/app/dashboard/settings/_env.ts` | 수정(선택) | CLOSING_DRY_RUN 스냅샷 노출 |

### Phase 2 — 스크래퍼 + 워크플로
| 파일 | 유형 | 설명 |
|---|---|---|
| `scripts/moa-closing/scrape.py` | 신규 | 로그인→SMS2FA폴링→검색→페이지네이션→마감필터→인제스트 POST |
| `scripts/moa-closing/requirements.txt` | 신규 | selenium/requests/python-dotenv |
| `scripts/moa-closing/README.md` | 신규 | 운영/시크릿/dry-run 가이드 |
| `.github/workflows/moa-closing-scrape.yml` | 신규 | workflow_dispatch + setup-python+chrome + 게이트 + 스크래퍼 |
| (선택) `scripts/moa-closing/academic_year.py` | 신규 | TS util Python 미러 |
| (선택) `scripts/moa-closing/biweekly_gate.py` | 신규 | 게이트 Python 미러 |

합계 ≈ 27 파일 → 20+ 전체 설계 확정. **`git worktree` 격리 권장**(`../OPS-Console-feat-moa-closing`).

---

## 11. 태스크 분해 (bite-sized)

### Phase 1

**T1: closing_services 마이그레이션 (테이블)** (3분)
- 파일: `supabase/migrations/202606XX_closing_services_table.sql`
- 변경: §3 DDL(15컬럼 + 2 인덱스 + notify pgrst). insight_videos sql 템플릿.
- 검증: `\d public.closing_services` → 15컬럼, service_id unique. (db-migration-apply 메모리 방식으로 적용)
- 의존: 없음

**T2: closing_services RLS + GRANT** (3분)
- 파일: `...XXb_closing_services_rls.sql`
- 변경: enable RLS + select-all 정책 + grant select(authenticated)/all(service_role). insight_videos rls 템플릿.
- 검증: `select policyname,cmd from pg_policies where tablename='closing_services'` → select 1개. `has_table_privilege('authenticated',...,'INSERT')` → f.
- 의존: T1

**T3: closing zod 스키마 + 타입 (RED→GREEN)** (5분)
- 파일: `src/features/closing/schemas.ts` + `__tests__/schemas.test.ts`
- 변경: §4 closingRow/closingIngest 스키마, `ClosingRow` DB 타입. 테스트: 정상 통과 / write_end_at 누락 거부 / rows 빈 배열 거부.
- 검증: `npm test -- closing/schemas` RED→GREEN.
- 의존: 없음(T1 병행 가능)

**T4: academic-year util (RED→GREEN)** (5분)
- 파일: `src/features/closing/academic-year.ts` + 테스트
- 변경: §5 규칙 구현. 테스트 표 5케이스(윤년/3월경계/UTC변환).
- 검증: `npm test -- academic-year` 전 케이스 GREEN.
- 의존: 없음

**T5: biweekly-gate util (RED→GREEN)** (5분)
- 파일: `src/features/closing/biweekly-gate.ts` + 테스트
- 변경: §7 anchor 기반 `shouldRunThisWeek(now, anchorMonday, parity)`. 테스트: 같은주 재실행 동일결과 / 다음주 반전 / 연말 53주 경계.
- 검증: `npm test -- biweekly-gate` GREEN.
- 의존: 없음

**T6: 인제스트 API route (RED→GREEN)** (5분)
- 파일: `src/app/api/closing/ingest/route.ts` + `__tests__/route.test.ts`
- 변경: Bearer 검증(automations/run 복사) → zod(T3) → admin client 전체대체 적재. 테스트: 잘못된 Bearer 401 / 빈 배열 400 / 정상 ok+inserted.
- 검증: `npm test -- closing/ingest`. (admin client mock)
- 의존: T2, T3

**T7: closing queries** (4분)
- 파일: `src/features/closing/queries.ts`
- 변경: `listClosing(filter)` server client select + 정렬(write_end_at desc) + 페이지네이션. services/queries 패턴.
- 검증: 타입체크 통과 + (가능 시 통합). 의존: T1

**T8: closing variant 폴더 (View/Table/filters)** (5분 × 분할 권장)
- 파일: `list-variants/closing/{View,Table,filters}.tsx` + Table 테스트
- 변경: 11컬럼 Table, View 읽기, filters(지역/카테고리/대학구분 또는 []). services variant 템플릿.
- 검증: `npm test -- closing/Table` 렌더 + 컬럼 헤더.
- 의존: 없음(T9 전 작성)

**T9: variant 등록 (types + registry)** (2분)
- 파일: `types.ts`(union +closing), `registry.ts`(+import +엔트리)
- 변경: Variant에 `"closing"`, registry에 `closing: { View, Table, Filters }`.
- 검증: `npm run typecheck` (registry `satisfies Record<Variant,...>` 통과).
- 의존: T8

**T10: closing 페이지 + row-mapper** (5분)
- 파일: `src/app/dashboard/closing/page.tsx` + `_row-mapper.ts`
- 변경: requireMenu + listClosing + ListPattern(variant="closing", readOnly, canCreate=false). ListRow에 scrapedAt 필드 추가 시 ListPattern.tsx 수정.
- 검증: dev 서버 `/dashboard/closing` 렌더(빈/데이터). E2E smoke.
- 의존: T7, T9

### Phase 2

**T11: Python 스크래퍼 골격 (드라이버+로그인)** (5분)
- 파일: `scripts/moa-closing/scrape.py`, `requirements.txt`
- 변경: SmileEDI setup_driver/random_wait 재사용. Moa 로그인(id/pw 입력→제출). env 로드(하드코딩 금지).
- 검증: 로컬 headful 로그인 폼 도달 로그(2FA 전까지).
- 의존: 없음(API 계약 T6 확정 후 권장)

**T12: SMS 2FA 폴링** (5분 × 분할)
- 파일: scrape.py (2FA 함수)
- 변경: §6 submit_ts 기록 → MAKE_SMS_CODE_URL GET 폴링 → 신선도(received_at>submit_ts-skew) → 코드 입력 → 재시도/타임아웃. 코드 로그 마스킹.
- 검증: make 응답 mock 또는 실 1회 — 신선 코드만 입력, 옛 코드 무시 로그.
- 의존: T11, **make received_at 필드 선결(Q2)**

**T13: 검색조건 + 페이지네이션 + 추출** (5분 × 분할)
- 파일: scrape.py
- 변경: ServiceSearch 이동 → 학년도 오픈일 범위 입력(academic_year) → 검색 → 페이지 전체 순회 → 11컬럼 추출. 다중 셀렉터 후보.
- 검증: 로컬 추출 row 수/컬럼 로그(CLOSING_DRY_RUN=true).
- 의존: T11

**T14: 마감 필터 + 인제스트 POST** (4분)
- 파일: scrape.py
- 변경: write_end_at<scraped_at 필터 → ISO8601(+09:00) 직렬화 → `POST /api/closing/ingest` Bearer. dry-run 시 미전송.
- 검증: dry-run 추출 로그 + 1회 실전송 → DB row 확인.
- 의존: T6, T13

**T15: 격주 게이트 (Python)** (3분)
- 파일: scrape.py (또는 biweekly_gate.py) 진입부
- 변경: §7 anchor 기반 게이트 → skip이면 exit 0. TS util과 동치.
- 검증: anchor 기준 이번주 실행/스킵 로그.
- 의존: T5(규칙 동치)

**T16: 워크플로** (4분)
- 파일: `.github/workflows/moa-closing-scrape.yml`
- 변경: smileedi-scrape.yml 복제 → workflow_dispatch + setup-python+chrome + deps + 스크래퍼(시크릿 §8). 체이닝 불필요(인제스트 자체가 종착).
- 검증: `workflow_dispatch` 수동 1회 — 게이트 통과 시 적재, 스킵 시 exit 0.
- 의존: T11–T15

**T17: README + dry-run 가이드** (3분)
- 파일: `scripts/moa-closing/README.md`
- 변경: 시크릿/env/dry-run/2FA 운영/장애 대응(make 단절). smileedi README 템플릿.
- 검증: 문서 정합성. 의존: T16

---

## 12. 리스크 / 롤백

| 리스크 | 영향 | 완화 / 롤백 |
|---|---|---|
| **SMS 2FA 외부의존 단절**(휴대폰/Tasker/make) | 격주 배치 누락(다음 격주까지 미감지) | 신선도+타임아웃 명시 실패 → GH job 실패 알림 필수. 운영: 수동 Moa 조회 폴백(데이터는 read-only라 무해). |
| **make 응답에 received_at 없음** | 신선도 판별 불가 → 옛 코드 오입력 | Q2 선결. 없으면 Data Store reset 방식으로 설계 변경(§6.1). |
| **Moa DOM/2FA 플로우 변경** | 스크래퍼 깨짐 | 다중 셀렉터 후보(SmileEDI 패턴). job 실패로 즉시 노출. |
| **ISO week 연말 패리티 어긋남** | 격주 1회 오작동 | anchor 경과주 방식 채택(§7) → 연경계 강건. util 테스트. |
| **전체 대체 중 빈 payload** | 전체 삭제 사고 | rows.min(1) zod 거부 + API 400. 스크래퍼 0건 시 미전송. |
| **CRON_SECRET 누출** | 임의 데이터 주입 | 기존 secret 보안 정책. read-only 표시라 영향 한정(데이터 위변조 한정). |
| **20+ 파일 동시 작업 충돌** | 머지 복잡 | `git worktree` 격리 + Phase 1/2 분리 머지(Phase 1 단독 머지 가능). |

**롤백**: Phase 1은 신규 테이블/라우트/페이지/variant 추가뿐(기존 수정은 types/registry 2줄) → revert 안전. Phase 2는 워크플로/스크립트 신규 → 파일 삭제로 롤백. closing 메뉴는 placeholder였으므로 페이지 revert 시 빈 상태 복귀.

---

## 13. 열린 질문 / 선결 사항

- **Q1 (게이트 anchor)**: 격주 기준 월요일(어느 주부터 실행). `CLOSING_BIWEEKLY_ANCHOR` 값 확정 필요. — 사용자 확인.
- **Q2 (make received_at)**: make GET 응답에 코드 수신 타임스탬프 포함 여부. 없으면 §6.1 reset 방식 + make 시나리오 수정 선결. — **2FA 신선도의 핵심, 가장 먼저 확인.**
- **Q3 (Moa 폼 포맷)**: ServiceSearch 오픈일 입력이 날짜/시각 분리인지 단일 input인지, 시각 입력 가능 여부. academic-year 반환 포맷 확정에 필요. — Phase 2 DOM 조사.
- **Q4 (운영자/개발자 매핑)**: Moa 표기 문자열을 operators와 조인할지(이번 범위 제외 권장 — brainstorm 11컬럼에 email 없음).
- **Q5 (실패 알림 채널)**: 2FA/배치 실패 시 알림 경로(GH 기본 / Teams / 메일). 운영 안정성상 권장하나 본 범위 밖 — 후속.
- **Q6 (closing filters)**: 지역/카테고리/대학구분 chip 노출 여부 또는 `Filters: []`(handover 방식). — 사용자 선호.

---

## 14. 검증 게이트 (완료 기준)
- `npm run lint` / `npm run typecheck` / `npm test` 무경고.
- 인제스트 API: 인증 401 / 빈배열 400 / 멱등(2회 동일 → row 동일) 증거.
- RLS: member select OK, authenticated insert 차단 증거.
- closing 페이지: 빈/데이터 렌더, E2E smoke.
- 스크래퍼: dry-run 추출 로그 + 실전송 1회 DB 적재 확인.
- 워크플로: workflow_dispatch 1회 — 게이트 실행/스킵 + (실행 시) 적재 확인.

## 결정 업데이트 (Q1/Q2 확정)
- Q1 격주 anchor = **2026-06-08(월)**, 14일 간격. (오늘 기준 (today - 2026-06-08) % 14 == 0 인 월요일만 실행)
- Q2 SMS 코드 회수: GET `MAKE_SMS_CODE_URL` 응답 = **수신 SMS 문자 본문(text)**. 본문에서 정규식 `\[(\d+)\]`로 인증번호 추출.
- **신선도 판별(타임스탬프 불요)**: 로그인 제출 전 GET → baseline 코드 저장. 제출 후 폴링하며 응답 코드가 baseline과 **달라지면** 새 SMS로 간주해 사용. 타임아웃 ~90초(2~3초 간격). 빈/동일 지속 시 실패 처리.

## 결정 업데이트 2 (스크래핑 방식 변경 — HTML 테이블 → 엑셀 다운로드)
- 검색 결과 테이블을 HTML 파싱/페이지네이션 순회하지 않고, **'엑셀저장' 버튼 클릭 → xlsx 다운로드 → openpyxl/pandas 파싱** (SmileEDI 동일 방식).
- 장점: 페이지네이션 불필요, 전건 일괄 확보, HTML DOM 변경에 덜 취약.
- Phase 2 영향: scrape.py가 '엑셀저장' 클릭 → 다운로드 파일 읽기 → 11컬럼 매핑 → 작성마감<scraped_at 필터 → 인제스트 POST. (페이지네이션 로직 제거)
- **Phase 1 영향 없음** — 데이터 형태(11컬럼) 동일, 인제스트 계약/DB/페이지 그대로.
- 확인 필요: 엑셀 컬럼 헤더명/순서가 화면 11컬럼과 동일한지 (Phase 2 시 실제 다운로드로 검증).

## 결정 업데이트 3 (자동화 메뉴 등록 — 트리거형 잡 추가, 2026-06-07)

사용자 결정: closing 스크래핑을 `/dashboard/automations` 메뉴에 **트리거형 잡으로 등록**한다. SmileEDI(워크플로→OPS 메일 잡)와 **반대 방향** — OPS 잡이 GitHub 워크플로를 깨운다.

- **신규 잡 `closing-scrape`**: `AUTOMATION_JOBS`에 등록. `run()`은 **순수 디스패처** — GitHub `workflow_dispatch` API를 호출해 `moa-closing-scrape.yml`을 깨우기만 한다. 격주 게이트/스크래핑/필터/적재는 워크플로(스크래퍼)가 담당.
- **격주 게이트 위치 = 스크래퍼만**(plan T15 유지). `run()`은 매번 무조건 dispatch → Python 스크래퍼가 off주 exit 0. cron/수동 구분 불가 문제를 회피(단일 게이트 소스). off주 GH Actions는 즉시 exit이라 분 소모 무시.
- **트리거 흐름**: cron-job.org 매주 월 10:00 → `POST /api/automations/run?jobId=closing-scrape` (Bearer CRON_SECRET) → 토글 ON이면 `run()` → GitHub dispatch → 스크래퍼 격주 게이트. (기존: cron-job.org가 GitHub 직접 호출 → **변경**: OPS 경유 단일 관제점.)
- **수동 실행**: 토글 OFF + admin "수동 실행" → `run()` → dispatch (off주면 스크래퍼가 skip). off주 강제 실행은 GitHub UI에서 워크플로 직접 dispatch가 override.

### 하드 선행조건 (운영자 영역 — 코드 외)
- **OPS에 GitHub PAT 신규 필요**: 현재 OPS 코드/​env에 GitHub dispatch 수단 전무(cron-job.org만 보유). Fine-grained PAT(해당 repo, **Actions: read/write**) 발급 → Vercel env 등록.
- 신규 env: `GITHUB_DISPATCH_TOKEN`(PAT), `GITHUB_DISPATCH_REPO`(`owner/repo`), `GITHUB_DISPATCH_WORKFLOW`(기본 `moa-closing-scrape.yml`). 누락 시 `run()` 즉시 실패(폴백 금지).

### 신규/수정 파일 (결정3 추가분)
| 파일 | 유형 | 설명 |
|---|---|---|
| `src/lib/github/dispatch-workflow.ts` | 신규 | OPS→GitHub `workflow_dispatch` POST 헬퍼(env 로딩+fetch). lib/microsoft 패턴 |
| `src/lib/github/__tests__/dispatch-workflow.test.ts` | 신규 | env 누락 실패 / 정상 호출 URL·헤더 / 비-2xx 에러 (fetch mock) |
| `src/features/automations/jobs/closing-scrape.ts` | 신규 | `run()` = dispatch 헬퍼 호출 → AutomationRunResult |
| `src/features/automations/jobs/__tests__/closing-scrape.test.ts` | 신규 | dispatch 성공/실패 매핑 (헬퍼 mock) |
| `src/features/automations/registry.ts` | 수정 | `closing-scrape` 엔트리 + import 1줄 |
| `.env.example` | 수정 | GITHUB_DISPATCH_* 3개 |
| `src/app/dashboard/settings/_env.ts` | 수정(선택) | GITHUB_DISPATCH_TOKEN configured boolean 스냅샷 |

### 이번 세션 검증 경계 (정직성)
- ✅ TDD 완결: dispatch 헬퍼 + closing-scrape 잡 + registry (fetch/헬퍼 mock으로 단위 검증).
- 🟡 라이브 검증 필요(운영자): GitHub PAT 발급·Vercel 등록, 실제 dispatch 1회, cron-job.org를 GitHub 직접→OPS 경유로 재설정.

## 결정 업데이트 4 (Moa DOM 라이브 디스커버리 — 2026-06-07)

Playwright로 실 로그인(SMS 코드 수동 주입)하여 셀렉터·흐름 전부 확정. scrape.py 반영 완료.

- **로그인**(SSR/ASP.NET): URL `/User/Login`. `#txtUserID`/`#txtPassWord`/SMS코드 `#txtSANum`/버튼 `#btnLogin`(이중용도: 1차=Validate() SMS발송, 2차=인증확인). 폼 POST `/User/LoginProcess` + `__RequestVerificationToken`(CSRF).
- **⚠️ 캡차**(`#secCaptcha`/`#txtCaptchaCode`, img `/User/Captcha`): 평소 display:none, **로그인 실패(Status<0) 후에만** 노출 → 헤드리스 1회 실패 시 잠김. 스크래퍼는 캡차 감지 시 abort.
- **ServiceSearch** = `/Foundation/ServiceSearch`. 오픈일 input `#txtOpenFromTime`/`#txtOpenToTime`(flatpickr, **포맷 `YYYY-MM-DD HH:MM`** ← 학년도 util `00:01`/`23:59`과 정합). 마감일 `#txtCloseFromTime`/`#txtCloseToTime`(미사용).
- **⚠️ 운영자 기본 선택 함정**: `ddlManager`가 로그인 운영자(예: 송영신)로 **기본 selected** → 검색이 본인 담당만 반환. **`ddlManager`/`ddlDeveloper`/`ddlMOACategoryName`을 ''(선택=전체)로 비워야** 전체 마감 서비스 확보. (운영자 비우니 다운로드 10.7KB→41KB로 증가 확인.)
- **엑셀저장** = JS `GetUnivServiceListToExcel()` → `#searchForm` POST `/Foundation/GetUnivServiceListToExcel` → 응답 `data.Message`=다운로드 URL. (버튼 클릭 대신 `execute_script` 직접 호출이 robust.)
- **⚠️ 엑셀 암호화**(CDFV2/OLE): 다운로드 xlsx가 비밀번호 보호. **`MOA_EXCEL_PASSWORD` + msoffcrypto-tool 복호 필요**(SmileEDI 동일). 로그인 PW·SmileEDI 엑셀 PW 모두 불일치 → 별도 값.

### ✅ 선결 2건 모두 해결 + 전체 플로우 라이브 검증 (2026-06-07)
- **A. 엑셀 복호 = `VelvetSweatshop`** (서버 생성 엑셀 표준 기본키, 비밀 아님 — 운영자 비번 아님). 스크래퍼 기본값 내장, `MOA_EXCEL_PASSWORD` 입력 불필요(비워둠).
- **B. SMS 웹훅 해결**: make 시나리오 수정으로 GET이 **최신 SMS 본문 반환**. Moa 포맷 = `[Web발신][내부관리자] 본인확인 인증번호는 [123456] 입니다.` → 기본 정규식 `\[(\d+)\]` 정확 매치(한글 브라켓 불매치).
- **라이브 검증(Playwright 실세션)**:
  - 자동 2FA 성공: baseline(NHN 장애문자)→Moa 인증문자 3초 감지→코드 추출→로그인 (수동 입력 0).
  - 엑셀: 오픈일 `2026-03-01 00:01`~`2027-02-28 23:59` + 운영자 비움 → 다운로드 → VelvetSweatshop 복호 → **실제 14컬럼**(plan 11 + 접수구분/결제시작/결제마감) 중 11개 매핑 → **430건 파싱**(현재 마감 279건). parse_excel(복호+매핑+날짜KST+필터+직렬화) 실데이터 검증.

### 신규 env (scrape.py)
- `MOA_EXCEL_PASSWORD`(선택 — 기본 VelvetSweatshop), `SEL_*`/`SERVICE_SEARCH_URL`(기본 내장, override용), `MOA_SMS_CODE_REGEX`(기본 `\[(\d+)\]`).

### 운영 전 남은 것 (코드 완료 — 운영 설정만)
- GH Secrets: MOA_USERNAME/MOA_PASSWORD/MAKE_SMS_CODE_URL/OPS_CONSOLE_BASE_URL/CRON_SECRET (엑셀 비번 불요).
- OPS Vercel: GITHUB_DISPATCH_TOKEN/REPO/WORKFLOW (트리거 잡 PAT).
- `workflow_dispatch` 1회 → 인제스트 실전송 → closing 페이지 데이터 확인. cron-job.org를 `/api/automations/run?jobId=closing-scrape` 경유로 설정.

## 결정 업데이트 5 (14컬럼 전부 적재 — 사용자 결정, 2026-06-07)

엑셀 실제 14컬럼을 전부 DB 적재(기존 11 + 접수구분/결제시작/결제마감). 적용 완료:
- 마이그 `20260607e_closing_services_add_columns.sql`: `admission_type`/`pay_start_at`/`pay_end_at` 추가(nullable, IF NOT EXISTS). **DB 적용·검증 완료**(closing_services 18컬럼).
- `schemas.ts`: closingRowSchema + closingServicesRowSchema에 3필드(+테스트 2케이스 RED→GREEN).
- 인제스트 route insertRows + `_row-mapper`(pay→payStartAt/payEndAt 매핑) + scrape.py(EXCEL_COLUMN_MAP + parse_excel) 3필드.
- **표시**: closing은 services variant 재사용 → services Table은 카테고리/작성마감만 표시(공유라 미수정). 결제기간은 ListRow에 실려 인스펙터 노출 가능, 접수구분은 ListRow 대응 필드 없어 **DB 저장만**(표시 필요 시 별도 작업). cron-job.org 스케줄 = `0 10 * * 1`(매주 월 KST) 확인 — 격주는 스크래퍼 게이트.
