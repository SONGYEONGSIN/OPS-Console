---
plan_id: 20260510-141234-posts-db-integration
status: in_progress
created: 2026-05-10T14:12:34Z
hard_gate: full
source: brainstorm:.claude/memory/brainstorms/20260510-140732-posts-db-integration.md
worktree: ../Folio-feat-posts-db (branch feat/posts-db)
---

# Plan: feedback/notices 게시판 DB 영구 저장 (단일 posts 테이블)

## Goal

mock으로 표시 중인 feedback(4건) / notices(3건)를 단일 `posts` 테이블 + `domain` enum + RLS로 영구 저장. ListPattern `onPersist` callback으로 작성·수정·삭제를 server action 경유 DB 반영, 새로고침 후에도 유지.

성공 기준:
1. admin이 새 공지 작성 → DB row insert → 새로고침 시 유지
2. member feedback 작성/본인 글 수정 OK
3. member 타인 feedback update → RLS 차단
4. member notice 작성 시도 → RLS + server action 차단
5. 모두 select 통과 (read 자유)
6. 시드 7건 (feedback 4 + notice 3) DB 적재

## Approach

대안 A — 단일 `posts` 테이블 + `domain text check ('feedback','notice')`. RLS 정책 안 case 분기 또는 도메인별 정책 둘로 분리(가독성 우선 시).
- 시드: 현재 mock 7건을 마이그레이션 INSERT로 이전
- author_email + author_id (병기, id는 nullable)
- hard delete (audit 요구 없음)
- 시드 mock id `FB-001` 등은 `slug text` 컬럼으로 보존하거나 uuid로 변환

team-permission 풀스택 패턴 그대로 답습.

## Out of Scope

- 댓글 / 마크다운 / 첨부 / 카테고리 / 태그
- soft delete (audit 요구 시 후속 epic)
- author_id가 auth.users(id)와 강한 FK (현재는 nullable로 best-effort)

## 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `supabase/migrations/20260512_posts_table.sql` | 추가 | 테이블 + 시드 + 인덱스 + 트리거 |
| `supabase/migrations/20260512b_posts_rls.sql` | 추가 | RLS + GRANT + notify pgrst |
| `src/features/posts/schemas.ts` | 추가 | postRow/Create/Update + Domain/Status enum |
| `src/features/posts/__tests__/schemas.test.ts` | 추가 | RED |
| `src/features/posts/queries.ts` | 추가 | listPosts(domain) |
| `src/features/posts/actions.ts` | 추가 | createPost/updatePost/deletePost + 권한 가드 |
| `src/features/posts/__tests__/actions.test.ts` | 추가 | 권한 분기 RED |
| `src/app/dashboard/feedback/page.tsx` | 수정 | mock → listPosts + onPersist |
| `src/app/dashboard/notices/page.tsx` | 수정 | mock → listPosts + onPersist |
| `src/app/dashboard/_data/patterns.ts` | 수정 | feedbackMockRows/noticesMockRows 제거 + 분기 제거 |
| `e2e/posts-board.spec.ts` | 추가 | admin/member 시나리오 + 새로고침 유지 |
| `scripts/inspect-posts.mjs` | 추가 (선택) | 운영 디버깅 |

## 단계

### T1: 마이그레이션 SQL — posts 테이블 + 시드
- 상태: pending
- 파일: `supabase/migrations/20260512_posts_table.sql`
- 변경: 테이블 + slug text(글번호 보존) + author_email/author_id + status check + 인덱스 + set_updated_at 트리거 + 시드 INSERT 7건
- DoD: SQL Editor 실행 후 `select count(*), domain from posts group by domain` → feedback 4 / notice 3
- 의존: 없음

### T2: RLS + GRANT + reload
- 상태: pending
- 파일: `supabase/migrations/20260512b_posts_rls.sql`
- 변경: enable RLS / posts_select(true) / posts_admin_or_author_insert / update / delete (domain 분기 case) / GRANT to authenticated + service_role / notify pgrst
- DoD: 수동 — admin 모든 도메인 OK, member feedback 본인 OK, member notice insert 0
- 의존: T1

### T3: schemas RED
- 상태: pending
- 파일: `src/features/posts/__tests__/schemas.test.ts`
- 변경: domain enum, status enum, row/update/create 검증
- DoD: RED
- 의존: 없음

### T4: schemas GREEN
- 상태: pending
- 파일: `src/features/posts/schemas.ts`
- 변경: postDomainSchema/postStatusSchema/postRowSchema/postUpdateSchema/postCreateSchema
- DoD: T3 GREEN
- 의존: T3

### T5: queries.ts
- 상태: pending
- 파일: `src/features/posts/queries.ts`
- 변경: listPosts(domain) — select * + order created_at desc + safeParse 루프
- DoD: typecheck 통과 + e2e에서 통합 검증
- 의존: T4

### T6: actions RED
- 상태: pending
- 파일: `src/features/posts/__tests__/actions.test.ts`
- 변경: createPost — viewer 차단 / member feedback OK / member notice 차단 / admin 모두 OK. updatePost — 본인 글 OK / 타인 글 차단(feedback) / admin 모두 OK. deletePost — 동일.
- DoD: RED
- 의존: T4

### T7: actions GREEN — createPost
- 상태: pending
- 파일: `src/features/posts/actions.ts`
- 변경: createPost — getCurrentOperator + canEditOperators(notice 분기) + author_email 자동 채움 + supabase insert + revalidatePath
- DoD: T6 RED 일부 GREEN
- 의존: T6

### T8: actions GREEN — updatePost / deletePost
- 상태: pending
- 파일: `src/features/posts/actions.ts` (T7 동일)
- 변경: 본인 author_email + admin 분기 가드. 두 액션 모두 revalidatePath
- DoD: T6 모두 GREEN
- 의존: T7

### T9: feedback/page.tsx 통합
- 상태: pending
- 파일: `src/app/dashboard/feedback/page.tsx`
- 변경: listPosts('feedback') 호출 + PostRow → ListRow 매핑 + onPersist server action wrapper
- DoD: dev에서 페이지 진입 시드 4건 표시 + 새 글 작성 → 새로고침 유지
- 의존: T5, T7, T8

### T10: notices/page.tsx 통합
- 상태: pending
- 파일: `src/app/dashboard/notices/page.tsx`
- 변경: listPosts('notice') + isAdmin 가드 유지 + onPersist
- DoD: admin 작성 / member read-only
- 의존: T5, T7, T8

### T11: mock 제거
- 상태: pending
- 파일: `src/app/dashboard/_data/patterns.ts`
- 변경: feedbackMockRows/noticesMockRows 상수 제거 + getPatternMockData 분기 제거
- DoD: typecheck 통과 / dev 페이지 정상
- 의존: T9, T10

### T12: e2e — posts-board.spec.ts
- 상태: pending
- 파일: `e2e/posts-board.spec.ts`
- 변경: admin/member 토글 + 시나리오 (작성→유지, 본인글 수정 OK, 타인글 차단, notice member 차단). afterEach test-prefix 글 cleanup.
- DoD: `npm run test:e2e -- --workers=1` 통과
- 의존: T9, T10

### T13: 최종 verify
- 상태: pending
- 파일: 없음
- 변경: typecheck + lint + test + e2e
- DoD: 0 errors / 회귀 없음
- 의존: T1~T12

## 단계 의존성 그래프

```
T1 ──→ T2 ───────────────────────────────┐
T3 → T4 ──┬→ T5 ──┐                       │
          ├→ T6 → T7 → T8 ─→ T9 ──┐        │
                                  ├→ T11 ──┤
                            T10 ──┘        │
                            ↑              ↓
                            └─ T9, T10 → T12 (e2e)
                                              ↓
                                          T13 (verify)
```

## 리스크

1. mock id 손실 — `slug text` 컬럼으로 보존
2. author_email vs jwt email 정합성 — RLS 의존, 사용자 email 변경 시 글 소유 깨짐
3. RLS case 분기 가독성 — 도메인별 정책 분리도 가능
4. revalidatePath 도메인 분기 — actions에서 정확한 path invalidate
5. e2e row 누적 — afterEach test-prefix cleanup
6. dev 계정 (operators 미존재) — server action 명시 거부 + RLS fallback
7. PostgREST cache reload — 학습 함정
8. timezone — toLocaleDateString('ko-KR') 적용

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-10T14:12:34Z | - | plan_created | full gate, 13 steps |
