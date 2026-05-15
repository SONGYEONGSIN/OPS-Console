# Brainstorm — 백업 요청 서비스 단위 재구조화

생성: 2026-05-15
관련 PR: #102 (PR-3 백업자 서비스별 분리) 후속

## 배경

PR #102로 `backup_request_services` 행에 `substitute_email/name`을 추가해 서비스별 백업자 분리는 가능해졌으나, **연락처와 메모는 여전히 `backup_requests`에 공통**으로 묶여 있어 비대칭이 남음. 운영 시나리오상 "서비스 = 1차 단위" 모델로 정리하는 게 자연스럽다.

## 사용자 의사결정

| # | 결정점 | 답 |
|---|--------|----|
| 1 | 백업자 모드 | **하이브리드** — 기본 백업자(default) + 서비스별 override. 모드 토글 없음 (현 모델 유지) |
| 2 | 대학 연락처 | **서비스에 묶음** — 서비스 chip 내부로 흡수. 공통 일괄 영역 삭제 |
| 3 | 백업 메모 | **공통 + 서비스별 둘 다** — `summary_md` 유지 (공통) + 서비스마다 `note_md` optional |
| 4 | 카드 UI 형상 | **항상 전체 펼침** — accordion 없이 카드 내부(백업자/연락처/메모) 즉시 노출 |

## 데이터 모델 변경

```sql
-- backup_requests
ALTER TABLE backup_requests DROP COLUMN contacts;   -- 운영 데이터 0건, 단순 DROP
-- summary_md, substitute_email/name 유지 ("공통 메모", "기본 백업자")

-- backup_request_services
ALTER TABLE backup_request_services
  ADD COLUMN note_md text,                          -- 서비스별 메모 nullable
  ADD COLUMN contacts text[] NOT NULL DEFAULT '{}'; -- 서비스별 연락처 chips
```

마이그레이션 1개 (`20260525_backup_request_services_contacts_notes.sql`). 운영 데이터 0건이라 backfill 불필요.

## 폼 구조 (UI)

```
요청자 (자동)
제목
기본 백업자 [select ▾]               ← 라벨 명확화 (현재 "백업자")
휴가 시작일 / 종료일

담당 서비스 (N/20)
[대학명·서비스명 검색]
┌── 경찰대학 — 신입학  ── 백업자[김슬기▾] ── [×] ──────────┐
│   대학 연락처: [+양라윤] [+...]  [검색 input]            │
│   서비스 메모: [textarea ─ 이 서비스만의 디테일]         │
└──────────────────────────────────────────────────────┘
(다른 서비스 카드…)

공통 메모 (전체 휴가 컨텍스트)
[textarea ─ summary_md]
```

**기존 "대학 연락처 (0/20)" 일괄 섹션은 삭제** — 서비스 카드 안으로 흡수.

## 메일 발송 (mail-actions / mail-template)

- 백업자별 그룹화는 기존 그대로 (`groupServicesBySubstitute`)
- 그룹 본문 구조:
  - 인사말
  - 요청자 / 휴가 기간
  - **공통 메모** (있으면 상단 1회)
  - **담당 서비스 카드 (서비스별 연락처 + 서비스별 메모 포함)**
- PDF 첨부: 전체 서비스 카드 통합 1개 (모든 백업자에게 동일)

## 영향 파일

| 파일 | 변경 |
|------|------|
| `supabase/migrations/20260525_*.sql` | 신규 1 (column add + drop) |
| `src/features/backup-requests/schemas.ts` | serviceDetailSchema 확장 (`note_md`, `contacts`). top-level contacts 제거 |
| `src/features/backup-requests/queries.ts` | SELECT_WITH_SERVICES contacts/note_md 포함. flatten 매핑 |
| `src/features/backup-requests/actions.ts` | services join row insert에 contacts/note_md. top-level contacts 처리 제거 |
| `src/features/backup-requests/mail-template.ts` | 본문 layout 재설계 (공통 메모 + 서비스 카드 N) |
| `src/features/backup-requests/mail-actions.ts` | services_detail 전달 그대로. 본문 변경만 |
| `src/app/dashboard/_components/inspector/list-variants/backup/EditForm.tsx` | 큰 폼 재설계 — chip → 카드. 일괄 연락처 섹션 삭제 |
| `src/app/dashboard/_components/inspector/list-variants/backup/View.tsx` | 표시 변경 (서비스 카드 내 연락처/메모) |
| `src/app/dashboard/_components/patterns/ListPattern.tsx` | backupServicesDetail 원소 타입 확장 (`note_md`, `contacts`) |
| `src/app/dashboard/backup/page.tsx` | onPersist new shape. contacts 일괄 제거 |
| `src/features/backup-requests/__tests__/*` | mail-template / schemas / actions 케이스 갱신 |

**규모**: ~10 파일 변경 + 마이그레이션 + DB 스키마 변경 → **HARD-GATE: 전체 설계** 등급. 단일 PR 묶음 가능 (모두 동일 마이그레이션·도메인 종속, [[feedback_plan_step_vs_pr_granularity]]).

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| EditForm 길이 ↑ (현재 ~350줄) — 800 상한 근접 | 서비스 카드 sub-component 추출: `src/app/dashboard/_components/inspector/list-variants/backup/ServiceCard.tsx`. EditForm은 카드 컬렉션 dispatcher 역할로만 |
| `backup_requests.contacts` DROP 시 잔여 코드 dangling | T1 마이그레이션과 같은 PR에 schemas/queries/actions/UI 동기 변경 (분리 머지 X) |
| 메일 본문 layout 변경으로 발송 누락/깨짐 | mail-template.test 케이스 — 공통 메모 + 서비스 카드 2개 + 연락처 N + note_md 있/없 4 케이스 |
| 카드 항상 펼침 → 서비스 N=20일 때 폼 매우 길어짐 | 단순 수용. 카드 사이 `border-line-soft` 구분만. 가상 스크롤 안 함 (YAGNI) |
| 기존 사용자 임시 입력 데이터(0건이지만 dev) | DROP 전 dev seed 확인. prod 적용은 `notify pgrst` 포함 |

## Out of Scope (이번 epic 아님)

- 백업자별 재발송 UI (전체 재시도만)
- 한 서비스에 백업자 N명
- 서비스 카드 reorder (드래그)
- 마이그레이션 prod 적용 (PR 머지와 별도 — 사용자 SQL Editor 적용)

## 다음 단계

1. 사용자 design doc review
2. 승인 시 `writing-plans` 스킬로 step 분해 plan 작성
3. 단일 worktree에서 구현 (`feat/backup-services-restructure` 권장)
