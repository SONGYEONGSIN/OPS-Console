# Brainstorm — incidents 시트 import (PR-7)

생성: 2026-05-16
관련 PR: #116 (PR-6 incidents 도메인 신설) 후속

## 배경

PR #116로 incidents 도메인 신설. 운영부 시트(2025학년도)에 226 row 누적 데이터. 이 중 운영부 row 23건을 DB로 일괄 주입. 영엽기획/대학영업은 운영 책임 범위 밖 — skip.

시트 ID: `1EPTt5Z1sLlpiRtbPVI30HDKB0mh4UGKbiBNpih6ffoA` (gid=1057635609)

## 사용자 의사결정

| # | 결정점 | 답 |
|---|--------|----|
| 1 | department 매핑 | **운영부 row만 import** (23건). 영엽기획·대학영업 skip. schema enum 확장 X |
| 2 | description 4섹션 분리 | **불가** — 시트가 단일 markdown. cause_summary에 전체 dump. 4섹션 분리는 운영부 수동 정제 (out of scope) |
| 3 | app_type | "공통원서" default (시트에 없음) |
| 4 | year | **2025** hardcode (2025학년도 = 2024.03~2025.02) |
| 5 | 매칭 실패 정책 | warning + skip (insert 안 함) |
| 6 | dry_run 모드 | env `DRY_RUN=true`로 검증 모드 |

## 데이터 흐름

```
Google Sheet (gid=1057635609)
   ↓ (MCP Google Drive read_file_content 또는 캐시)
parser  ← description 단일 markdown 그대로
   ↓ (운영부 row 필터)
mapper
   ├ category 5값 정규화 (그 외 → 기타)
   ├ status 매핑 (할 일→미처리, 처리완료→처리완료, 진행중→처리중)
   ├ assignee 매칭 (operators.name → email)
   ├ department = 담당자.team → "운영부-운영{N}팀"
   └ reporter = REPORTER_BY_DEPARTMENT[department]
   ↓
incidents 테이블 insert (service_role bypass RLS)
```

## 필드 매핑 (확정)

| 시트 컬럼 | DB 컬럼 | 변환 |
|----------|---------|------|
| 이슈 유형 | — | (사용 안 함 — 항상 "중요사항") |
| 분류 | `category` | 결제/원서작성/사이트/경쟁률 매칭, 그 외 → "기타" |
| 요약 | `title` | trim, 200자 cap |
| 설명 | `cause_summary` | 전체 markdown, 5000자 cap |
| 대학교 | `university_name` | trim |
| Start date | `occurred_date` | YYYY-MM-DD 변환, 빈 값 → null |
| 기한 | `resolved_date` | YYYY-MM-DD, 빈 값 → null |
| 부서 | (필터 조건) | "운영부" 외 row skip |
| 담당자 | `assignee_email` + `assignee_name` | operators.name → email/team 조회 |
| 보고자 | (사용 안 함) | department별 hardcode 매핑 |
| 상태 | `status` | "할 일"→"미처리" / "처리완료"→"처리완료" / "진행중"→"처리중" / else→"미처리" |
| (없음) | `year` | 2025 hardcode |
| (없음) | `app_type` | "공통원서" default |
| (없음) | `root_cause`/`resolution`/`prevention` | null |

## 스크립트 구조

```
scripts/incidents-import.mjs
├ env load (.env.local)
├ supabase service_role client
├ operators 마스터 fetch (name → {email, team} map)
├ sheet content load (캐시 또는 MCP)
├ parse rows (markdown table → array)
├ filter (운영부 only)
├ map (필드 변환)
├ validate (필수 필드 + zod incidentCreateSchema)
├ DRY_RUN 분기:
│   true  → console.table preview, no insert
│   false → batch insert (chunk 50)
└ report (OK / SKIP / TOTAL + skip reason 분포)
```

## 에러 정책

- 담당자 operators 매칭 실패 → warning + skip
- 필수 필드 누락 (title/category/대학교) → skip + 사유
- zod parse 실패 → skip + issues 출력
- supabase insert error → batch 전체 fail + 상세 출력

## Out of Scope

- description 4섹션 분리 (시트 자체에 없음)
- universities FK 정규화
- 시트 자동 동기화 (cron)
- UPSERT (idempotent) — 일회성. 재실행 시 중복 위험 명시
- 영업기획/대학영업 row import

## 영향 파일

| 파일 | 변경 |
|------|------|
| `scripts/incidents-import.mjs` | 신규 (~250줄 예상) |
| `scripts/.gitignore` 또는 .gitignore | (필요 시) `incidents-sheet-cache.json` 추가 |

**HARD-GATE: 인라인 설계** (단일 스크립트 / 1회성). 단일 PR.

## 검증 절차

1. dry_run 실행 → 운영부 row 23건 parsed payload 출력
2. 매칭 실패 분포 확인 (담당자 / category / status)
3. 0 fail이거나 사용자 수동 보정 후 실제 실행
4. Folio UI에서 `/dashboard/incidents` 진입 → 2025학년도 selector → row 23건 노출

## 다음 단계

1. 사용자 spec review (이 파일)
2. 승인 시 writing-plans → step 분해
3. branch `chore/incidents-sheet-import`
