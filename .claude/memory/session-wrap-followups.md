# Session Wrap Followups — 2026-05-13

## 이번 세션 요약

- vibe-flow setup.sh 동기화 (PR #89)
- 백업 요청 메뉴 epic PR-1 (PR #90): DB + UI 등록·조회
- 세션 정리: CLAUDE.md 수치 갱신 + Variant union 통합 + cross-env build script

## 다음 세션 우선 작업

### 1. PR 머지 + DB 적용 (필수)
- [ ] PR #89 (vibe-flow chore sync) 머지
- [ ] PR #90 (backup PR-1) 머지
- [ ] `supabase db push` — 4 마이그레이션 적용 (`20260519_*`, `20260519b_*`, `20260519c_*`, `20260519d_*`)
- [ ] 로컬 `npm run dev` → /dashboard/backup 등록 1건 → DB select 검증
- [ ] RLS 검증: 다른 운영자 계정으로 SELECT 가능 / 본인 행만 UPDATE 가능

### 2. backup epic PR-2 — PDF + 메일 발송 (T16~T22)
plan: `.claude/plans/20260513-020933-backup-request-handover.md`

- [ ] T16: `@react-pdf/renderer` 설치 + Pretendard 한글 폰트(SIL OFL) 배치
- [ ] T17: `src/lib/pdf/backup-request-pdf.tsx` + `renderToBuffer` — 한글 케이스 실측
- [ ] T18: `src/features/backup-requests/mail-template.ts` — 제목 + HTML 빌더
- [ ] T19: `src/features/backup-requests/mail-actions.ts` — sendBackupRequestMail (CC 산출 + dry_run + 이력 적재)
- [ ] T20: `src/lib/microsoft/sendmail.ts` attachments 시그니처 확장 (필요 시)
- [ ] T21: EditForm 메일 hook + 재발송 버튼
- [ ] T22: `MAIL_DRY_RUN=true` 환경에서 mail_status='dry_run' row 실증

## 후속 follow-up (선택)

### 자동화 후보 (automation-scout 제안)
- [ ] **`add-list-domain` 스킬 신설** — 마이그레이션 + features + list-variants 4슬롯 + registry 자동화. 다음 list 도메인 추가 시 ~2시간 → ~30분 절감. 우선순위 medium
- [ ] **post-like dispatcher 중앙화** — `variant: "post-feedback" | "post-notice"` 분기가 InspectorListBody에 하드코딩. registry에 `dispatchOverride` 슬롯 추가. 우선순위 low

### 작업 부채
- [ ] backup PR-2의 onPersist 수정·삭제 지원 (현재 명시적 에러 반환)
- [ ] 사이드바 count "1" 동적화 — 백업 도메인 실 row 수 반영 (Out of Scope였음)
- [ ] backup mail_sends 운영 메모 — CLAUDE.md에 receivables_mail_sends와의 차이 (트리거/대상자/RLS 권한)

### instinct 후보 (learning-extractor 제안 — 기록만, 다음 세션에 검토)
- `list-variants-variant-union-sync-3-places` → 이번 세션에서 통합 완료. instinct 불필요 (해결됨)
- `tdd-enforce-strict-non-domain-bypass` (confidence 0.75) — types/registry/page 파일의 type-level 테스트 우회 패턴
- `brainstorm-question-format-preference` (confidence 0.85) — 사용자별 4문항 vs 1문항 선호 다양성

## 회고

### 잘 된 점
- list-variants 신아키텍처 ROI 검증 — backup 도메인 추가 비용 "1폴더+1줄+ListRow 확장" 약속 거의 지킴 (dispatcher 로직 0줄 변경)
- tdd-enforce hook이 RED 선행 강제 — TDD 규율 자동 보장
- brainstorm → plan → PR-1 흐름 매끄럽게 진행

### 마찰 지점
- `NODE_ENV=development` leak 함정 재발견 → 이번 세션에 `cross-env` 추가로 영구 해결
- Variant union 3 곳 분산 → 이번 세션에 단일화
- brainstorm AskUserQuestion 첫 시도 거부 (4문항 한꺼번에) → 사용자 선호 파악에 1턴 추가 소요

## 권장 다음 명령

```bash
# 머지 + DB 적용
gh pr merge 89 --squash
gh pr merge 90 --squash
git checkout main && git pull
supabase db push

# PR-2 시작
git checkout -b feat/backup-epic-mail
npm i @react-pdf/renderer
# T16부터 plan에 따라 진행
```
