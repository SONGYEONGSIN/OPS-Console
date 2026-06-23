# 메일함 위임 (Phase 2) 설계

> 메일함 Phase 1(2026-06-22-mailbox-feature-design.md) §9의 위임 열람을 구체화한다.
> 요구사항 5: "A가 B에게 본인 메일함 열람 권한 위임".

## 1. 목표 / 범위

운영자 A가 본인 메일함을 다른 운영자 B에게 **위임**하면, B가 본인 메일함 화면에서 A의 메일함으로 전환해 **열람 + A 명의 회신 발송**을 할 수 있다.

확정 결정(2026-06-23 brainstorm):
- **권한 범위 = 열람 + 발송** — B는 A 메일·초안을 보고 A 명의로 회신 가능(`sent_by_email=B` 감사).
- **관리 주체 = 운영자 셀프** — A 본인이 자기 메일함에서 B를 위임 지정·해제(주인 동의 명확).
- **설정 UI = 메일함 페이지 내 패널** — 상단 `[내 메일함 ▼]` 옆 "위임 관리" → 표준 ModalShell.

비범위(YAGNI): admin 일괄 관리, 위임 만료시각, 위임 세분 권한(읽기/쓰기 분리), 알림.

## 2. 데이터 — `mailbox_delegations`

```sql
create table public.mailbox_delegations (
  id           uuid primary key default gen_random_uuid(),
  owner_email  text not null,         -- 메일함 주인 A (operators.email)
  grantee_email text not null,        -- 위임받는 대리 B (operators.email)
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz,           -- 해제 시각(soft). null = 활성
  unique (owner_email, grantee_email)
);
```

- **재위임**: 해제(`revoked_at` set) 후 다시 위임 시 unique 충돌 → `upsert(onConflict: owner_email,grantee_email)` 로 `revoked_at=null, granted_at=now()` 복구.
- **RLS**: SELECT authenticated using(true)(운영부 공개) / INSERT·UPDATE·DELETE 정책 없음 → service_role(서버 액션)만 쓰기. worklog/news와 동일 패턴. GRANT 필요(42501 회피).
- 마이그: `supabase/migrations/2026XXXX_mailbox_delegations.sql`(테이블) + `_rls.sql`(RLS+GRANT). 컨트롤러가 프로덕션 적용.

## 3. 권한 헬퍼 — `canAccessMailbox(viewer, owner)`

`src/features/mailbox/delegation.ts`(server-only 아닌 순수 쿼리 모듈) 또는 queries.ts:
- `viewer === owner` → true (본인).
- 아니면 `mailbox_delegations`에서 `owner_email=owner AND grantee_email=viewer AND revoked_at IS NULL` 존재 → true.
- 그 외 false.
- 단일 지점에서 **열람 가드(페이지)** 와 **발송 가드(액션)** 가 공용.

순수 분기 + DB 조회 분리: `isOwnerOrActiveDelegate(viewer, owner, rows)` 순수 함수로 TDD, DB 조회는 얇은 래퍼.

## 4. 메일함 페이지 — `[내 메일함 ▼]` 전환

- `mailbox/page.tsx`: `searchParams.owner?` 추가. `owner = sp.owner ?? me.email`.
- **가드**: `owner !== me.email` 이면 `canAccessMailbox(me, owner)` 검사 → 실패 시 본인 메일함(`owner=me`)으로 폴백.
- `listMailbox(owner)` / `getAutoDraftEnabled(owner)` 그대로 재사용(owner 파라미터화).
- **드롭다운 옵션** = "내 메일함"(me) + `listMailboxesDelegatedTo(me)`(나에게 위임한 owner 목록, 활성). 클라이언트 컴포넌트 `MailboxOwnerSwitcher`가 `?owner=` 네비게이션.
- **`ensureMailboxSettings`는 본인(me) 메일함에만** 호출 — 위임 열람은 settings 등록과 무관(타인 메일함을 내가 등록하지 않음).

## 5. 발송 가드 확장

- `sendMailReply(messageId, body)`: 현재 `owner_email !== me.email` 차단을 **`!await canAccessMailbox(me.email, msg.owner_email)`** 로 교체.
- 발신 명의 = `owner_email`(A), `sent_by_email = me.email`(B). 이미 구현됨 — 가드만 확장.

## 6. 위임 관리 패널 (셀프)

- 메일함 상단 "위임 관리" 버튼(client) → `ModalShell` 모달(표준 모달 셸 규칙).
- 내용: **내가 준 위임 목록**(`listMyDelegations(me)` = owner=me, 활성) — grantee 이름/이메일 + 해제 버튼. + **추가 폼**(B 이메일 입력 → 운영자 검증).
- 서버 액션(`actions.ts`):
  - `grantMailboxDelegation(granteeEmail)` — owner=me 고정. zod 검증 + B가 실 operators인지 + B≠me. `mailbox_delegations` upsert(revoked_at=null). `revalidatePath`.
  - `revokeMailboxDelegation(granteeEmail)` — owner=me 고정. `revoked_at=now()` update.
- 권한: 항상 **본인(me) 메일함만** 위임 관리(owner=me 고정, grantee 검증).

## 7. 에러 / 엣지

- B가 미존재 운영자 → 액션 거부("등록되지 않은 운영자").
- B==me → 거부("본인에게 위임할 수 없습니다").
- 위임 없는 owner로 `?owner=X` 직접 접근 → 가드가 본인 메일함 폴백(403 노출 대신 안전 폴백).
- 해제된 위임 owner 선택 → 드롭다운에 안 뜸 + 가드 폴백.

## 8. 테스트 (TDD)

- `isOwnerOrActiveDelegate` 순수: 본인 / 활성위임 / 해제된위임(revoked_at) / 타인 → 4 케이스.
- `grantMailboxDelegation`: upsert 호출(onConflict + revoked_at=null) / 미존재 운영자 거부 / 본인 거부.
- `revokeMailboxDelegation`: revoked_at update 호출.
- `sendMailReply`: 위임받은 B가 A 메일 발송 허용(canAccessMailbox=true) / 무관 타인 거부.
- 페이지 가드는 통합 성격 — 단위는 헬퍼로 커버.

## 9. 영향 범위 / 변경 등급

신규: 마이그 2 + `delegation.ts`(+test) + `MailboxOwnerSwitcher.tsx` + 위임관리 모달 컴포넌트.
수정: `mailbox/page.tsx`(owner 파라미터·가드·switcher) / `queries.ts`(listMailbox owner화는 이미 owner 인자, 드롭다운 쿼리 추가) / `actions.ts`(가드 확장 + grant/revoke 액션) / `schemas.ts`(delegation zod).
→ 6~12 파일, **간략 설계** 등급. 인증/권한 로직 수정이라 신중 — 가드 단일화로 위험 격리.

## 10. 운영 선행

- 마이그 적용(컨트롤러). cron ingest는 무변경(여전히 settings row 운영자 수집). 위임은 **열람 권한**만 — 수집과 독립.
