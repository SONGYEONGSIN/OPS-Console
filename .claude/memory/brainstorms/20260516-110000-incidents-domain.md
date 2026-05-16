# Brainstorm — 사고 보고 (incidents) 도메인 신설

생성: 2026-05-16

## 배경

사이드바 "사고 보고" (slug `incidents`)는 mock 상태 (count "2" hardcode). 실 DB 도메인으로 promote. 학년도 단위 관리. 운영부가 시트로 누적해온 실 데이터 (~226 row, 2025학년도) 있음 — 후속 PR에서 import.

## 사용자 의사결정

| # | 결정점 | 답 |
|---|--------|----|
| 1 | 학년도 모델 | **단일 테이블 + year 컬럼 + UI 상단 학년도 selector** |
| 2 | 1차 PR 범위 | **도메인 신설만** (빈 DB + CRUD UI). 시트 import는 즉시 후속 PR |
| 3 | 구분 (`app_type`) enum | **공통원서 / 일반원서 / 공공원서** 3값 (services.application_type과 별개) |
| 4 | 카테고리 | 자유 텍스트 + datalist suggestion (결제 / 원서작성 / 사이트 / 경쟁률) |
| 5 | 부서 enum | **운영부-운영1팀 / 운영부-운영2팀** 2값 (operators.team prefix 적용) |
| 6 | 담당자 | 본인 자동 (`getCurrentOperator()` email/name) |
| 7 | 보고자 | 부서별 고정 매핑 — 운영1팀 → 허승철(alcure23@jinhakapply.com) / 운영2팀 → 송영신 |
| 8 | 상태 enum | **미처리 / 처리중 / 처리완료 / 보류** 4값 |
| 9 | 본문 구조 | 사고경위 / 사고원인 / 사고처리 / 사고대책 — 4 textarea 분리 (시트 description의 markdown 4섹션 모방) |

## 데이터 모델

```sql
create table public.incidents (
  id              uuid primary key default gen_random_uuid(),
  year            integer not null,                          -- 학년도 (예: 2025 = 2024.03~2025.02)
  university_name text not null,                             -- 대학명 (검색 dropdown, services suggestion)
  app_type        text not null
                    check (app_type in ('공통원서','일반원서','공공원서')),
  category        text not null,                             -- 결제 / 원서작성 / 사이트 / 경쟁률 / 기타 (자유)
  occurred_date   date,                                      -- 발생일자
  resolved_date   date,                                      -- 처리일자
  title           text not null,                             -- 사고제목
  cause_summary   text,                                      -- 사고경위
  root_cause      text,                                      -- 사고원인
  resolution      text,                                      -- 사고처리
  prevention      text,                                      -- 사고대책
  department      text not null
                    check (department in ('운영부-운영1팀','운영부-운영2팀')),
  assignee_email  text not null,                             -- 담당자 (본인 자동)
  assignee_name   text not null,                             -- 담당자 이름 스냅샷
  reporter_email  text not null,                             -- 보고자 (부서별 고정)
  reporter_name   text not null,                             -- 보고자 이름 스냅샷
  status          text not null default '미처리'
                    check (status in ('미처리','처리중','처리완료','보류')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists incidents_year_idx on public.incidents (year desc);
create index if not exists incidents_status_idx on public.incidents (status);
create index if not exists incidents_department_idx on public.incidents (department);
```

**RLS** (backup_requests 패턴):
- authenticated read 모두 허용 (전원 가시)
- INSERT / UPDATE: admin·member만 (viewer 차단)
- DELETE: admin만

## 학년도 계산

```ts
// lib/datetime.ts (신규 또는 확장)
export function currentAcademicYear(now = new Date()): number {
  const kstMonth = ... // KST 변환
  const kstYear = ...
  return kstMonth >= 3 ? kstYear + 1 : kstYear;
}
```

- 오늘(2026-05-16 KST) → 2027학년도 default
- 학년도 라벨: `${year}학년도`

## 보고자 자동 매핑

```ts
const REPORTER_BY_TEAM = {
  '운영부-운영1팀': { email: 'alcure23@jinhakapply.com', name: '허승철' },
  '운영부-운영2팀': { email: '<송영신 email>', name: '송영신' },
} as const;
```

server action `createIncident` / `updateIncident`에서:
1. `department`를 받음
2. `REPORTER_BY_TEAM[department]`로 `reporter_email`/`name` 자동 채움
3. 사용자 입력 reporter_* 무시 (보안 — 신뢰 X)

송영신 email은 operators 테이블에서 조회하거나 hardcode. 직전 사용자 메모에 등록된 본인 email = ysong2526@gmail.com이지만, 운영 시스템 operators 테이블의 송영신 email은 별도 — 마이그 작성 시 확인.

## EditForm 필드 순서

```
요청자 (= 담당자, read-only 본인)

학년도        [2027학년도 ▾]
대학명        [대학명 검색 dropdown — services suggestion]
구분          [공통원서 ▾]
카테고리      [datalist: 결제 / 원서작성 / 사이트 / 경쟁률]
              (자유 입력 가능)

발생일자      [        ]
처리일자      [        ]

사고제목      [                                    ]
사고경위      [ textarea ]
사고원인      [ textarea ]
사고처리      [ textarea ]
사고대책      [ textarea ]

담당부서      [운영부-운영1팀 ▾] (본인 team prefix 자동)
담당자        본인 (read-only)
보고자        (자동 표시 — 부서에 따라)
현재상황      [미처리 ▾]
```

## 목록 페이지

- URL: `/dashboard/incidents`
- 상단: **학년도 selector** (default 현 학년도) + ScopeChips ("전체 / 내가 담당")
- 검색: ListSearch (title / university_name / cause_summary)
- 필터: status / department
- Table 컬럼: 학년도 / 상태 / 구분 / 카테고리 / 사고제목 / 대학교 / 담당자 / 발생일자

## 영향 파일

| 파일 | 변경 유형 |
|------|----------|
| `supabase/migrations/20260526_incidents_table.sql` | 신규 (테이블 + 인덱스 + check) |
| `supabase/migrations/20260526b_incidents_rls.sql` | 신규 (RLS + GRANT) |
| `src/features/incidents/schemas.ts` | 신규 zod schema |
| `src/features/incidents/queries.ts` | 신규 (listIncidents / getIncidentById, year 필터) |
| `src/features/incidents/actions.ts` | 신규 (createIncident / updateIncident — reporter 자동) |
| `src/features/incidents/__tests__/*` | schemas / queries / actions test |
| `src/lib/datetime.ts` | `currentAcademicYear()` 추가 (or 신규 파일) |
| `src/app/dashboard/incidents/page.tsx` | 신규 — 학년도 selector + 검색 + 필터 |
| `src/app/dashboard/_components/inspector/list-variants/incidents/{View,EditForm,Table,filters}.tsx` | 신규 list-variant |
| `src/app/dashboard/_components/inspector/list-variants/registry.ts` | "incidents" 등록 |
| `src/app/dashboard/_components/inspector/list-variants/types.ts` | Variant union에 'incidents' |
| `src/app/dashboard/_components/patterns/ListPattern.tsx` | ListRow에 incident 도메인 필드 추가 |
| `src/features/menu-counts/queries.ts` | incidents count 추가 |
| `src/app/dashboard/_data.ts` | 사이드바 count hardcode "2" 제거 (placeholder만) |

**HARD-GATE: 전체 설계** (DB 신규 테이블 + ~13 파일 + 마이그 2). 단일 PR (PR-4 패턴).

## 후속 PR (별도 — 1차 머지 후 즉시)

- `scripts/incidents-import.mjs` 신규
- 시트 226 row → `year=2025` (2025학년도) 일괄 import
- description text 4섹션(`사고경위`/`사고원인`/`사고처리`/`사고대책`) 파싱
- 매핑 안 되는 값은 빈 문자열 / `category="기타"`
- 사용자 service_role key로 직접 실행

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| 송영신 email operators 미등록 | 마이그 작성 시 SELECT로 확인. 없으면 작업 전 등록 |
| `currentAcademicYear()` 3월 boundary | KST 기준 강제. `lib/datetime.ts` 통일 (`TZ=Asia/Seoul`) |
| viewer가 ListPattern에 도달 시 read-only 보장 | page.tsx에서 `canEdit = admin\|member`로 readOnly prop 통제 ([[feedback_rsc_element_prop_key]] 패턴) |
| EditForm 비대 (필드 14개) | 필드 그룹 (메타 / 일정 / 본문 4 / 담당) 시각 분리. 800줄 상한 내 |
| 시트의 multi-line description 파싱 실패 | 후속 import PR에서 처리 — 1차 PR 영향 없음 |
| 카테고리 자유 텍스트 → 통계 분산 | 운영부가 알아서 통일. 후속 시점에 enum 승격 검토 |

## Out of Scope

- 시트 226 row import (즉시 후속 PR)
- 메일 알림 / SharePoint 연동
- 첨부 파일
- 댓글 / 활동 로그
- universities / services FK 정규화

## 다음 단계

1. 사용자 spec review (이 파일)
2. 승인 시 `writing-plans` 스킬로 step 분해
3. branch `feat/incidents-domain`
