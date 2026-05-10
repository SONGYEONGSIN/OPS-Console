# Brainstorm: feedback/notices 게시판 DB 영구 저장

작성: 2026-05-10 / 사용자: 송영석

## 의도

- **산출물**:
  - `posts` 테이블 (단일 + domain enum: `feedback` / `notice`) + RLS + GRANT + 시드 (현재 mock 7개)
  - zod schema (`postRowSchema` / `postUpdateSchema` / `postCreateSchema`)
  - server-side queries (`listPosts(domain)`) + actions (`createPost` / `updatePost` / `deletePost`)
  - `feedback/page.tsx`, `notices/page.tsx` — DB 데이터 + onPersist 연동 (mock 제거)
  - mock data(`feedbackMockRows` / `noticesMockRows`)는 마이그레이션 시드로 이전 후 코드에서 제거
  - e2e — 작성→새로고침→유지 + RLS 권한 시나리오
- **사용자**:
  - admin: 두 도메인 모두 작성/수정/삭제
  - member: feedback 작성/본인 글 수정·삭제 가능 / notice는 read-only
  - viewer: 모두 read-only
- **트리거 (왜 지금)**: mock 단계 끝(PR #14 후속). 게시판 본질이 영구 저장 — 새로고침 시 사라지는 mock은 운영 불가.
- **성공 기준** (검증 가능):
  1. admin이 새 공지 작성 → DB row insert → 새로고침 시 유지
  2. member가 새 개선 요청 작성 → 자기 글 → 수정 가능
  3. member가 다른 사람 feedback 글 update 시도 → RLS 차단
  4. member가 notice 작성 시도 → RLS 차단 (server action도 명시 에러)
  5. 모두 select 통과 (read 자유)
  6. 시드 7개(feedback 4 + notice 3) DB에 들어감

## 제약

- **기술**:
  - 단일 `posts` 테이블 + `domain text not null check (domain in ('feedback','notice'))` 컬럼
  - RLS — domain별 정책 분기. notice는 `is_admin()` 우선, feedback은 author 본인 + admin
  - `notify pgrst, 'reload schema'` 강제
  - `service_role` GRANT 포함 (학습된 함정)
  - `auth.users.email` ↔ `posts.author_email` 또는 `auth.uid()` ↔ `posts.author_id`
- **비즈니스**:
  - 댓글 / 마크다운 / 첨부 / 카테고리 / 태그는 본 epic 외 (out of scope)
  - 작성자 정보 = email (단순 매핑) — 시드는 mock owner 매핑
- **코드베이스**:
  - team-permission epic 풀스택 패턴 재사용 (schemas/queries/actions/RLS)
  - ListPattern post-feedback/post-notice variant + InspectorListBody PostForm 그대로 활용 (이번 epic에서 구조 변경 없음)
  - 기존 mock data(`patterns.ts`의 feedbackMockRows/noticesMockRows)는 마이그레이션 시드로 이전 후 제거

## 대안 비교

| 항목 | 대안 A: 단일 posts + domain | 대안 B: 별도 테이블 | 대안 Z: do-nothing |
|------|-------------|---------|-------|
| 비용 | 1 테이블 + RLS 분기 (~10 파일) | 2 테이블 + 중복 RLS/queries (~14 파일) | 0 |
| 위험 | RLS 정책 분기가 복잡해질 가능성 | 도메인 추가 시 매번 신규 테이블 | mock 새로고침 시 데이터 손실 |
| 가역성 | domain enum 확장으로 새 도메인 흡수 | 도메인별 schema migration 필요 | n/a |
| 학습 효과 | RLS 분기 패턴 + Postgres CHECK enum | 정규화 강제 패턴 | 없음 |

## 추천 + 근거

**추천: 대안 A (단일 posts + domain enum)**

근거:
1. 사용자 명시 추천
2. Folio 운영 시스템에 게시판 도메인이 향후 추가될 가능성 (사고보고/FAQ 등) — 단일 모델이 확장 용이
3. RLS 분기는 `case domain when 'notice' then is_admin() else (...) end` 같은 패턴으로 한 정책 안에서 처리 가능 — 정책 갯수 폭증 안 함
4. UI는 ListPattern variant로 이미 분리됨 — 백엔드도 단일 모델이 frontend 패턴과 대칭

**기각 — 대안 B**: 도메인이 2개로 고정되고 미래에 도메인별 고유 필드(예: feedback의 priority/severity)가 명확해지면 B로 분리. 현 시점은 over-normalization.

**기각 — 대안 Z**: 사용자 명시 거부 + 게시판 본질이 영구 저장.

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260510-140732-posts-db-integration.md`
- 영향 파일 ~10개 → HARD-GATE 간략 + DB+RLS+auth 보정 → **전체 설계 등급** → **/plan 권장**
- planner 에이전트 분석 후 단계 분해
- worktree 격리 권장: `feat/posts-db`

## 미해결 — plan 단계에서 결정

1. **author 식별** — `author_email text` (단순) vs `author_id uuid → auth.users` (정규화). team operators는 email 기반.
2. **수정/삭제 권한** — feedback의 본인 글 수정 정책 (admin도 가능?), notice는 admin만 수정.
3. **시드** — 마이그레이션에서 mock 7개 INSERT vs 사용자가 admin으로 첫 등록.
4. **mock 제거 시점** — DB 적용 후 즉시 vs 단계적.
5. **e2e fixture** — TEST_USER admin/member 토글로 시나리오 검증.
6. **soft delete vs hard delete** — operators처럼 status='deleted'? 게시판은 단순 hard delete OK?
