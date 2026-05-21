# 자료 요청 발송 (data-requests) — 설계

작성일: 2026-05-22
브랜치: (구현 시 신규 `feat/data-requests`)
범위: **Phase 1 = 즉시 HTML 발송**. Phase 2(예약 발송)는 본 문서 말미에 설계만, 구현은 차기 spec.

## 배경 / 목적

운영자가 담당 서비스(대학)에 대해 학교 담당자에게 **자료 요청 메일**을 보내는 화면이 필요하다.
현재 `data-requests` 사이드바 항목(고객 응대 그룹)은 슬롯만 있고 페이지가 없다.

요구:
- 본인 담당 서비스 목록 → 서비스 클릭 → 인스펙터에서 그 서비스 건으로 자료요청 작성·발송
- 발신자 = 로그인한 운영자 **본인 메일박스** (operators.email)
- 수신자 = **대학연락처(contacts)** 에서 검색 (단일 수신자 + CC 다중)
- 메일 본문 = **HTML** (브랜드 템플릿)
- 즉시 발송(Phase 1) + 예약 발송(Phase 2)

## 기존 자산 (재사용)

- `src/lib/microsoft/sendmail.ts` → `sendGraphMail({ senderUserId, toEmail, toName, cc[], subject, html, attachments })` — HTML 본문 + 발신자 지정(`/users/{senderUserId}/sendMail`) + `saveToSentItems`. handover/backup/receivables 메일이 동일 패턴 사용.
- `src/features/contacts` — `ContactRow { customer_name, university_name, department_name, contact_phone, contact_email(nullable) }`. 수신자 검색 소스.
- `src/features/services` / services 쿼리 — 본인 담당(operator_email/developer_email=me) 필터.
- `src/features/auth/queries` `getCurrentOperator()` — 발신자 이메일.
- 메일 이력 테이블 패턴: `receivables_mail_sends`, `backup_request_mail_sends`.
- `MAIL_DRY_RUN` 안전장치 (true 시 미발송 + status='dry_run').
- 인스펙터 list-variant 패턴 (`registry.ts`, View/EditForm/Table 슬롯). ai-work View처럼 client 상호작용(폼) 가능.

## 아키텍처

**접근 A 채택**: ListPattern + 신규 list-variant `data-request`. 좌측 목록 = 본인 담당 services, 인스펙터 본문 = 자료요청 작성 폼. 인스펙터 chrome/레이아웃 재사용, 작성 UX는 variant 컴포넌트에 캡슐화.

### 페이지 `src/app/dashboard/data-requests/page.tsx`
- `requireMenu("data-requests")` (멤버는 allowed_menus 기반, admin bypass — 별도 admin-only 아님)
- `getCurrentOperator()` → 발신자/본인 식별
- 본인 담당 services 조회 → `ListRow[]`로 매핑
- 본인 담당 대학들의 contacts 조회(수신자 검색 범위 한정) → client에 전달
- `<ListPattern variant="data-request" readOnly liveData ... />`
  - `liveData` (Demo 안내문 숨김 — 실데이터)
  - 인스펙터 open 시 작성 폼 표시

### list-variant `src/app/dashboard/_components/inspector/list-variants/data-request/`
- `Table.tsx`: 본인 담당 services 목록 — 컬럼 대학명 / 서비스명 / 운영자 / 개발자. 행 클릭 → 인스펙터(작성 폼).
- `View.tsx` (client 작성 폼):
  - 선택 서비스 헤더(대학명·서비스명)
  - **수신자**: 그 대학 contacts에서 검색 select(단일). `contact_email` 있는 연락처만. 표시 "고객명 (부서) · email"
  - **CC**: 동일 소스에서 다중 선택(칩 추가/제거)
  - **제목** input
  - **본문** textarea (plain text)
  - **발송** 버튼 — `useActionState(sendDataRequestAction)`. pending/결과 메시지 표시
  - 발송 결과(성공 N / 실패 사유) 인라인 표시
- `filters.ts`: 필터 칩 없음(`Filters: []`) + blank 행 factory 불필요(readOnly)
- `registry.ts`에 `data-request` 1줄 + `types.ts` Variant union 1줄 추가

### features `src/features/data-requests/`
- `schemas.ts`:
  ```ts
  sendDataRequestInputSchema = z.object({
    serviceId: z.string().nullable().optional(),
    universityName: z.string().min(1),
    toEmail: z.string().email(),
    toName: z.string().optional(),
    cc: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).default([]),
    subject: z.string().min(1),
    body: z.string().min(1),
  });
  ```
- `mail-template.ts`: `renderDataRequestHtml({ subject, body, universityName, serviceName }): string`
  - `[운영부 상황실]` 브랜드 HTML (헤더 + 본문 + "자동 발송" 푸터). 기존 메일 톤 일치, 배경색 제거(메일 클라이언트 테마).
  - **본문 escape 후 줄바꿈 → `<br>`** (운영자 plain text → 안전하게 HTML화, 주입 방지). 순수 함수 → 단위 테스트.
- `actions.ts` (`"use server"`):
  - `sendDataRequestAction(prev, formData)`:
    1. `getCurrentOperator()` — 없으면 ok:false(인증). 발신자 = `me.email`
    2. zod 검증 (cc는 JSON 파싱)
    3. `renderDataRequestHtml(...)`
    4. `MAIL_DRY_RUN==='true'` → 실제 발송 생략, status='dry_run'
       else `sendGraphMail({ senderUserId: me.email, toEmail, toName, cc, subject, html })`
    5. `data_request_sends` insert (createAdminClient): status sent|failed|dry_run, sender_email, to/cc/subject/body, service_id, university_name, created_by_email
    6. `revalidatePath("/dashboard/data-requests")`
    7. 결과 반환 `{ ok, message }`
- `queries.ts`:
  - `getMyDataRequestServices(meEmail)` — 본인 담당 services → 행
  - `getContactsForUniversities(universityNames[])` — 본인 대학들의 contacts(이메일 보유분) 반환 (수신자 검색 범위)
  - (Phase 2) 예약 목록/이력 조회

### 수신자 검색 데이터 흐름
- 서버(page)가 본인 담당 services의 대학명 집합 → 그 대학들의 contacts(이메일 보유)만 fetch → client 전달 (범위 한정, 바운디드)
- client 인스펙터: 선택 서비스의 university_name으로 1차 필터 + 검색어로 2차 필터 → 수신자/CC 후보

## DB 마이그레이션 (수동 적용 필요)

`supabase/migrations/20260522_data_request_sends_table.sql`:
```sql
begin;
create table if not exists public.data_request_sends (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete set null,
  university_name text not null,
  sender_email text not null,
  to_email text not null,
  to_name text,
  cc jsonb not null default '[]'::jsonb,
  subject text not null,
  body text not null,
  status text not null default 'sent', -- sent | scheduled | failed | dry_run
  scheduled_at timestamptz,            -- Phase 2 예약
  sent_at timestamptz,
  error text,
  created_by_email text not null,
  created_at timestamptz not null default now()
);
create index if not exists data_request_sends_created_by_idx
  on public.data_request_sends (created_by_email, created_at desc);
create index if not exists data_request_sends_scheduled_idx
  on public.data_request_sends (status, scheduled_at);

alter table public.data_request_sends enable row level security;

drop policy if exists "data_request_sends_select_own_or_admin" on public.data_request_sends;
create policy "data_request_sends_select_own_or_admin"
  on public.data_request_sends for select to authenticated
  using (public.is_admin() or created_by_email = (auth.jwt() ->> 'email'));

grant select on public.data_request_sends to authenticated;
grant all on public.data_request_sends to service_role;
commit;
notify pgrst, 'reload schema';
```
- write는 server action이 `createAdminClient()`(service_role)로만. authenticated write 정책 없음(읽기만).
- `scheduled_at`/status는 Phase 1에선 sent/failed/dry_run만 사용, Phase 2 예약에서 scheduled 사용.

## 에러 처리

- 수신자 미선택 / 제목·본문 빈값 → zod 검증 차단, 폼 인라인 에러.
- `sendGraphMail` 실패(401/429/기타) → status='failed' + error 저장, UI에 사유 노출(에러 삼키지 않음).
- `MAIL_DRY_RUN` → 발송 없이 'dry_run' 이력만, UI에 "테스트(미발송)" 표시.
- contacts에 이메일 없는 대학 → 수신자 후보 0 → "등록된 연락처 이메일 없음" 안내.

## 테스트 (TDD)

- `__tests__/schemas.test.ts` — sendDataRequestInputSchema (정상/이메일형식/빈제목·본문/cc 배열).
- `__tests__/mail-template.test.ts` — renderDataRequestHtml: 브랜드 문자열 포함, 본문 escape(`<script>`→텍스트), 줄바꿈→`<br>`.
- `__tests__/actions.test.ts` — sendDataRequestAction 분기: 미인증→ok:false / 검증실패 / dry-run(미발송+dry_run insert) / 정상(sendGraphMail 호출+발신자=me.email+insert sent). Graph/DB/auth mock.
- `__tests__/queries.test.ts` — 수신자 후보 필터 순수함수(대학+검색어), 이메일 없는 연락처 제외.
- 컴포넌트: `data-request/View.test.tsx`(수신자 select·CC 칩·발송 버튼 렌더), `Table.test.tsx`(서비스 행 렌더).

## 검증

- `npm run lint` / `npm run typecheck` / `npm test` 통과.
- **마이그레이션 수동 적용** (Supabase SQL editor) — 적용 전엔 insert 실패.
- dev: 운영자 로그인 → /dashboard/data-requests → 본인 서비스 클릭 → 수신자 검색·선택 → 제목/본문 작성 → 발송 → (MAIL_DRY_RUN 권장) dry_run 이력 확인. 실발송 1건 스모크.

## 롤아웃

- 마이그레이션 적용 + 코드 배포. `Mail.Send` Application 권한(기존 메일 기능과 동일)·`AZURE_AD_*` 필요.
- 비-admin 노출: 멤버 allowed_menus에 `data-requests` 부여 시 노출(기존 메뉴 권한 체계). 별도 admin-only 아님.

## Phase 2 — 예약 발송 (차기 spec, 설계만)

- `data-request/View`에 **예약 시각** 입력 + "예약" 버튼 → status='scheduled' + scheduled_at insert (발송 안 함).
- GitHub Actions cron(저빈도, 예: 시간당) `scripts/data-requests-dispatch.mjs`:
  - `data_request_sends`에서 `status='scheduled' AND scheduled_at <= now()` 조회
  - 각 건 Graph app token(client_credentials, `/users/{sender_email}/sendMail`)으로 발송 → status='sent'+sent_at, 실패 시 'failed'+error
  - automation_settings 토글로 on/off (기존 패턴) — 선택
- 저빈도라 분 단위 정밀도는 보장 안 함("몇 시 발송" 수준). UI에 그 한계 명시.
- 인스펙터/목록에 예약 건 상태 표시.
