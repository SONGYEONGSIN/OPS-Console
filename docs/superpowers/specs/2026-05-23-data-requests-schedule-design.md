# 자료요청 예약 발송 (data-requests Phase 2 — Supabase pg_cron) — 설계

작성일: 2026-05-23
브랜치: (구현 시 신규 `feat/data-requests-schedule`)
전제: Phase 1(즉시 평문 발송 + `data_request_sends` 이력)이 main에 머지·동작 중.

## 배경 / 목적

자료요청을 즉시 발송뿐 아니라 **예약 발송**할 수 있게 한다. 스케줄러는 **GitHub Actions cron을 쓰지 않는다** (무료분 소진 시 멈추는 문제를 이미 겪음 — insights-fetch). 대신 **Supabase pg_cron**이 주기적으로 **Next.js dispatch API 라우트**를 호출해 만료된 예약 메일을 발송한다.

## 결정 (확정)

- 스케줄러: **Supabase pg_cron**, **15분 주기**.
- dispatch 위치: **Next.js API 라우트** `/api/data-requests/dispatch` (기존 `sendGraphMail`/`createAdminClient` 재사용).
- 발송 실패: **`status='failed'` 기록만** (자동 재시도 없음, 목록 확인 후 수동 재발송).
- 발신: 기존 Phase 1과 동일하게 **앱 토큰(client_credentials)** 으로 `/users/{sender_email}/sendMail` → 로그인 세션 없이 운영자 본인 명의 발송 가능 (Mail.Send Application 권한, 기존 메일 기능과 동일).
- 본문: Phase 1과 동일 **평문(plain text)**. dispatch도 `sendGraphMail({ text: body })`.
- 이력 화면 표시(예약/발송 상태 뷰)는 **본 spec 범위 외** — 예약→발송 동작에 집중.

## 기존 자산 (재사용)

- `sendGraphMail({ senderUserId, toEmail, toName, cc, subject, text })` — 앱 토큰 발송, 평문 지원 (Phase 1에서 추가).
- `createAdminClient()` — service_role (RLS bypass), dispatch에서 row 조회/갱신.
- `data_request_sends` 테이블 — `status` / `scheduled_at` / `sent_at` / `error` 컬럼 이미 존재 (Phase 1 마이그). **테이블 마이그레이션 불필요.**
- API 라우트 패턴: `src/app/api/worklog/log/route.ts` (POST + NextResponse).
- 작성 폼: `data-request/View.tsx` (수신자/CC/제목/본문 + "발송").

## 아키텍처 / 데이터 흐름

```
[운영자] 작성 폼에서 예약 시각 선택 + "예약 발송"
   → scheduleDataRequestAction (server action)
   → data_request_sends INSERT { status:'scheduled', scheduled_at, 수신/제목/본문/발신자 }  (발송 X)

[Supabase pg_cron] 15분마다
   → net.http_post( https://<prod>/api/data-requests/dispatch , header: x-cron-secret )

[/api/data-requests/dispatch] (POST)
   1) x-cron-secret 검증 (불일치 → 401)
   2) 원자적 claim:
        UPDATE data_request_sends SET status='sending'
        WHERE status='scheduled' AND scheduled_at <= now()
        RETURNING *           ← 다음 run과 중복 발송 방지
   3) claim된 각 행:
        sendGraphMail({ senderUserId: sender_email, toEmail: to_email, toName: to_name, cc, subject, text: body })
        성공 → UPDATE status='sent', sent_at=now()
        실패 → UPDATE status='failed', error=...
   4) { ok, dispatched, sent, failed } 반환
```

## 구성 (파일)

### UI — `src/app/dashboard/_components/inspector/list-variants/data-request/View.tsx`
- 기존 "발송"(즉시) 유지. 추가:
  - **예약 시각** `<input type="datetime-local">` (KST 기준, 운영자 로컬). 빈 값이면 예약 버튼 비활성.
  - **"예약 발송"** submit 버튼 — 별도 server action 호출. 같은 hidden inputs(서비스/수신자/CC/제목/본문) + `scheduledAt`.
- `scheduleDataRequestAction`을 `useActionState`로 연결 (즉시 발송 action과 별개 또는 단일 action에 `mode` 분기 — 구현 시 결정, 단일 action + hidden `mode` 권장: 폼 1개 유지).
- 토큰 색만, sharp, useEffect 금지.

### Server action — `src/features/data-requests/actions.ts`
**단일 action `sendDataRequestAction`을 확장**한다 (별도 action 신설 X — 폼/`useActionState` 하나 유지). 폼의 두 submit 버튼이 `mode`를 전달:
- "발송"(즉시) 버튼: `<button name="mode" value="now">`
- "예약 발송" 버튼: `<button name="mode" value="schedule">` + datetime 값을 `scheduledAt` hidden/필드로 전송

`sendDataRequestAction(prev, formData)` 흐름:
  1. `getCurrentOperator()` — 없으면 ok:false. 발신자 = me.email
  2. zod 검증 (기존 입력) + `mode` 읽기
  3. **mode='schedule'**: `scheduledAt`(datetime-local 문자열) 필수 + **미래 시각** 검증(과거/빈값 → ok:false). `data_request_sends` INSERT `status='scheduled'`, `scheduled_at=<UTC>`, 발송 **안 함** → `{ ok:true, message:"예약되었습니다 (…)" }`
  4. **mode='now'** (기본): 기존 즉시 발송 흐름 그대로 (sendGraphMail text + status='sent'/'failed'/'dry_run' insert)
  5. 두 경로 모두 `revalidatePath("/dashboard/data-requests")`
- `scheduledAt`/`mode`는 schema에 추가 (mode: enum `now|schedule` 기본 now; scheduledAt: optional string, schedule일 때 필수+미래는 action에서 검증).

### Dispatch 라우트 — `src/app/api/data-requests/dispatch/route.ts` (신규)
- `POST` (또는 GET — pg_net은 POST 사용):
  - 헤더 `x-cron-secret` !== `process.env.CRON_SECRET` → `401`.
  - `createAdminClient()`로 claim UPDATE (status='sending', RETURNING). Supabase JS로 atomic claim이 단일 쿼리로 어려우면 **RPC(SQL 함수) `claim_due_data_requests()`** 를 만들어 호출 (UPDATE ... RETURNING). → claim용 SQL 함수는 수동 설정 SQL에 포함.
  - claim된 각 행 `sendGraphMail(...)` → 상태 갱신.
  - 결과 JSON 반환. 에러는 삼키지 않고 status='failed'+error 기록.
- 라우트 로직 중 순수 분류(due 판정/요약 집계)는 헬퍼로 분리해 단위 테스트.

### env
- `CRON_SECRET` — dispatch 인증용. Vercel 환경변수 + pg_cron SQL 헤더에 동일 값.

### DB (수동 설정 SQL — 사용자 적용)
1. 확장 활성화 (Supabase 대시보드 Database > Extensions): **`pg_cron`**, **`pg_net`**.
2. claim 함수 (원자적):
```sql
create or replace function public.claim_due_data_requests()
returns setof public.data_request_sends
language sql
as $$
  update public.data_request_sends
  set status = 'sending'
  where status = 'scheduled' and scheduled_at <= now()
  returning *;
$$;
grant execute on function public.claim_due_data_requests() to service_role;
```
3. pg_cron job (15분):
```sql
select cron.schedule(
  'data-requests-dispatch',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROD_DOMAIN>/api/data-requests/dispatch',
    headers := jsonb_build_object('content-type','application/json','x-cron-secret','<CRON_SECRET>')
  );
  $$
);
```
- `<PROD_DOMAIN>` / `<CRON_SECRET>`는 실제 값으로 치환. 본 spec/plan은 SQL 템플릿 제공, 적용은 수동.
- (대안) dispatch 라우트가 claim 함수 대신 직접 select+update 2단계로 처리 가능하나, 중복 발송 방지를 위해 claim 함수(단일 UPDATE RETURNING)를 권장.

## 에러 / 동시성

- **중복 발송 방지**: claim 단계에서 `status='scheduled'→'sending'` 원자적 전환. 다음 cron run은 'sending'/'sent'를 다시 잡지 않음.
- **발송 실패**: `status='failed'` + `error`. 자동 재시도 없음.
- **dispatch 미인증**: 401, 아무 동작 없음.
- **'sending'에서 멈춘 행**(라우트 크래시 등): v1은 수동 처리(목록에서 확인). (후속: 'sending' 오래된 행 'scheduled' 되돌리는 reaper — 범위 외)
- **과거 예약 시각**: action에서 거부.

## 테스트 (TDD)

- `actions.test.ts`: `sendDataRequestAction` mode='schedule' — 과거/빈 scheduledAt 거부 / 정상 예약 insert(status='scheduled', scheduled_at, sendGraphMail 호출 X). mode='now'(기존 즉시) 회귀 유지.
- `dispatch` 라우트: 시크릿 불일치→401 / 시크릿 일치 시 claim된 행에 sendGraphMail 호출 + 상태 sent/failed 갱신 (Graph·admin client·claim RPC mock). 순수 요약 헬퍼(sent/failed 집계) 단위 테스트.
- `View.test.tsx`: 예약 시각 input + 예약 발송 버튼 렌더 / 시각 미입력 시 예약 버튼 비활성.
- 기존 즉시 발송 테스트 회귀 없음.

## 검증

- `npm run lint` / `npm run typecheck` / `npm test` 통과.
- **수동 설정 필요**: pg_cron·pg_net 확장 활성화 + claim 함수 + cron.schedule + `CRON_SECRET`(Vercel & SQL). 미설정 시 예약 INSERT는 되지만 dispatch가 안 돌아 발송 안 됨.
- dev 검증: 예약 시각=1~2분 후로 INSERT → (로컬에선 pg_cron 미동작) → `curl -X POST localhost:3000/api/data-requests/dispatch -H 'x-cron-secret: <local>'` 수동 호출 → 발송 + status='sent' 확인. (로컬 .env.local에 CRON_SECRET 설정)

## 롤아웃

1. 코드 배포 (Vercel).
2. Vercel 환경변수 `CRON_SECRET` 설정.
3. Supabase: pg_cron·pg_net 활성화 → claim 함수 생성 → cron.schedule 등록 (PROD_DOMAIN/CRON_SECRET 치환).
4. 예약 1건 테스트 → 15분 내 발송 확인.

## 비범위 (후속)

- 예약/발송 이력 화면(목록·상태 뱃지), 예약 취소/수정 UI.
- 'sending' 멈춤 reaper, 자동 재시도.
- 분 단위 정밀 스케줄(15분 주기 한계).
