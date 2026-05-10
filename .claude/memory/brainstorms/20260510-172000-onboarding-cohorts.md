# Brainstorm: onboarding 회차(cohorts) 관리

작성: 2026-05-10 / 사용자: 송영석

## 의도

- **산출물 (본 epic 스코프)**:
  - `onboarding_cohorts` 테이블 + RLS (admin OR trainee/mentor 매칭) + 시드 1~2건
  - zod / queries / actions (create/update/delete)
  - `/dashboard/onboarding` — 회차 리스트 (ListPattern variant `cohort` 또는 기존 재활용)
  - 회차 카드: 제목 · 신입 · 사수 · 시작/종료 · 상태(planned/in_progress/completed)
  - 회차 상세 페이지 (`[id]/page.tsx`) — placeholder ("세션 관리는 후속 epic")
  - e2e: admin 작성 / 신입(본인) read / 비관계자 차단
- **사용자**:
  - admin (부장·팀장): 신입 합류 시 회차 생성/수정/삭제, 상태 갱신
  - 신입(trainee): 본인 회차 read
  - 사수(mentor): 본인이 사수인 회차 read
  - 그 외: 차단 (RLS)
- **트리거**: 김지나 사원 등 실제 신입 합류 시 사용. sidebar `onboarding` slug fallback dynamic 상태.
- **성공 기준**:
  1. admin이 회차 생성 → trainee/mentor email 지정 → DB persist
  2. 신입이 본인 회차 read 가능
  3. 무관 사용자 read 차단 (RLS)
  4. 시드 1~2건 마이그레이션
  5. e2e 권한 분기

## 제약

- **기술**: schedule + todos 학습된 RLS 함정 적용. RLS = `is_admin() OR trainee_email = jwt email OR mentor_email = jwt email`. `language plpgsql` is_admin() 재사용. `notify pgrst`. `service_role` GRANT.
- **비즈니스**: sessions 테이블 / 그리드 UI / 템플릿 / 자동 일정 / 평가 / 알림 — 본 epic 외 (후속 epic)
- **코드베이스**: ListPattern variant 7번째 도달 시점 — 단순 default variant 재활용 또는 cohort variant 신설 결정 필요. 회차 상세는 placeholder만 (별도 page route).

## 대안 비교

| 항목 | B-1: ListPattern default 재활용 + 회차는 row | B-2: ListPattern `cohort` variant 신설 | Z: do-nothing |
|---|---|---|---|
| 비용 | ~9파일 | ~11파일 (variant 추가분) | 0 |
| 위험 | default variant는 status 기반 — cohort 상태와 의미 매칭 안전 | variant 7 도달, 컴포지션 리팩토링 시급 | sidebar count 위조 |
| 가역성 | variant 추가 비용 후속에 미룸 | sessions 후속에서 분기 더 늘어남 | n/a |
| 학습 효과 | default variant 재활용 한계 검증 | variant 폭증 명확 — 리팩토링 트리거 | 없음 |

## 추천 + 근거

**추천: B-1 — default variant 재활용 + 회차를 row로 매핑**

근거:
1. 회차의 핵심 컬럼(제목·담당·상태)은 default variant(이름/상태/담당)에 자연 매핑 — `name=title`, `owner=trainee 이름`, `status` 직접 매칭 (active=in_progress 등)
2. variant 7 도달을 늦춰 컴포지션 리팩토링이 더 명확한 시점에 진행 (sessions 후속 추가 후가 적기)
3. 작은 epic — ListPattern 변경 없이 새 도메인 페이지 1개

**기각된 B-2**: variant 7 추가는 가능하지만 cohort row 표시가 default와 사실상 동일(이름/상태/담당) — variant 신설 가치 < 비용

### 상태 매핑
- `planned` → `urgent` (긴급/대기) 또는 `review` (점검중)
- `in_progress` → `active`
- `completed` → `approved`

ListRow 도메인 필드 추가:
- `traineeEmail?: string`
- `mentorEmail?: string`
- `startDate?: string`
- `endDate?: string | null`

## 다음 단계

- HARD-GATE 등급: **간략** (예상 9파일) → `/plan from-brainstorm`
- 후속 epic: onboarding sessions (첨부 이미지 주차×교육시간 그리드 미러), 템플릿 자동 생성
