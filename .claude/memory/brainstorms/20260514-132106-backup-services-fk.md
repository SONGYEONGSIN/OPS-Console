# Brainstorm: backup_requests.services chips → services FK multi-select (PR-2)

세션: 2026-05-14 오후
이전 epic 입력: `.claude/memory/brainstorms/20260513-085412-services-domain.md` (services PR-1)
연관 plan: `.claude/plans/20260513-090733-services-domain.md` (Out of Scope에 본 epic 명시)

## 의도

- **무엇을 만들 것인가**: `backup_requests.services text[]`(자유 텍스트 chips)을 `services.service_id`(bigint UNIQUE)를 참조하는 N:M 관계로 변환. EditForm에서 services 카탈로그 search-as-you-type multi-select. View에서 선택된 services chip 클릭 → services 페이지 deep-link
- **누가 사용할 것인가**: 백업 요청자(운영자) — 휴가/외근 시 본인 담당 services를 백업자에게 인계. 현재는 자유 텍스트라 표기 차이로 영향 추적 불가
- **왜 지금인가**: 
  - PR-1(#93)로 services 테이블 + 2511행 prod 적재 완료 → FK 가능
  - **backup_requests prod 현재 0행** — 데이터 마이그레이션 비용 0의 골든 윈도우
  - 다음 분기로 미루면: backup_requests에 행 누적 + text chips 분기 추적 부담 ↑
- **성공이 무엇인가**:
  - 신규 백업 요청은 services FK(N:M) 만 저장 (text fallback 제거)
  - EditForm: 검색(ilike) → 결과 chip click → 다중 선택. 5초 안에 3개 service 선택 가능
  - View: chip 클릭 → `/dashboard/services?q=...` 또는 인스펙터 deep-link
  - 백업 메일 본문에 service 이름 정규화된 형태로 나열 (대학명 — 서비스명)
  - 단위 test pass, typecheck 0, dev server smoke OK

## 제약

### 기술
- DB 스키마 변경: `backup_requests.services` 컬럼 처리 — drop vs deprecate
- FK 참조: `service_id bigint` (외부 PIMS 자연키) vs `services.id uuid` (Folio 내부 PK) — UUID 권장 (내부 PK는 변하지 않음, service_id는 외부 시스템 변동 시 disruption)
- N:M: 별도 join table `backup_request_services` (backup_request_id uuid + service_id bigint) — PostgreSQL 표준
- 검색 UX: PR-1.6의 `ServicesControls` 검색 패턴 재사용 — 자체 검색 input + ilike + 30개 limit
- RLS: backup_requests의 기존 RLS(`admin OR requester_email`) 일관성 유지. join table에도 동일 정책 또는 backup_requests 정책으로 derive
- 메일 본문 PDF 생성 코드(`features/backup/pdf.ts` 등)도 새 schema 읽도록 변경

### 비즈니스
- backup 도메인 prod 0행 — 데이터 마이그레이션 부담 X (이번 기회 활용)
- 향후 PR-3(대학 마스터) 도입 시 university_name FK도 동일 패턴으로 contacts 처리 가능

### 코드베이스
- `features/backup/` (schemas/queries/actions) 변경 — services 조인 join 쿼리 추가
- `inspector/list-variants/backup/EditForm.tsx` 변경 — services multi-select UI 신설 (현 chips comma-separated text input 대체)
- `inspector/list-variants/backup/View.tsx` 변경 — chip 렌더 + click → deep-link
- `inspector/list-variants/backup/__tests__/*` 회귀 — 기존 chips 테스트 케이스 갱신
- backup 메일 PDF/메일 본문 템플릿 — services 표시 형식 변경
- HARD-GATE: 영향 ~10~15 파일 → **간략 설계** 등급 (Planner 권장)

## 대안 비교

| 항목 | 대안 A: 별도 join table | 대안 B: bigint[] FK ARRAY | 대안 Z: 유지 |
|------|---------------------|---------------------------|-------------|
| **핵심** | `backup_request_services (backup_request_id uuid, service_id bigint, primary key)` N:M join | `backup_requests.services bigint[]` 컬럼 타입 변경 + 별도 FK validator trigger | text[] chips 유지, 표기 자유 |
| **비용** | 마이그레이션 2 파일(join table + RLS) + features 갱신 + UI multi-select | 컬럼 타입 변경 1 파일 + trigger 1 + UI 변경 | 0 |
| **위험** | 추가 테이블 = 추가 RLS 정책 점검 + ON DELETE 정책 결정 (CASCADE 권장) | bigint[]는 PostgreSQL FK constraint 직접 강제 X. trigger 누락 시 referential integrity 깨짐 | 백업 영향 추적 불가 / 영향 분석 메트릭 불가능 / 표기 fragment |
| **가역성** | 높음 — join table drop + 컬럼 복구 가능 | 중간 — 컬럼 타입 복구 시 데이터 손실 (0행이라 일단 OK) | n/a (변경 없음) |
| **학습 효과** | N:M 표준 패턴 — 향후 9개 서비스사이클 메뉴(계약/배포/마감 등)에 동일 적용 | array of FK는 PostgreSQL anti-pattern으로 알려짐 — 학습용 가치 낮음 | 0 |
| **N:M 메타데이터 확장** | 자연 — join table에 컬럼 추가 (예: `impact_level high/low`) | bigint[]에 메타 추가 불가 — JSONB로 전환해야 | n/a |

## 추천 + 근거

**대안 A 채택**.

### 선택 근거
1. **표준 N:M 패턴** — PostgreSQL ON DELETE CASCADE 등 FK 제약 도구 자연스럽게 활용. PR-3 이후 services↔universities, services↔contracts 도입 시 동일 패턴 재사용
2. **0행 마이그레이션 윈도우** — 지금이 가장 저렴한 시점. 다음 분기 누적 후 변환은 best-effort 매칭 + fallback 컬럼 같은 부담 동반
3. **메타데이터 확장 여지** — 향후 "백업 영향 수준(high/medium/low)" 같은 N:M edge 데이터를 자연스럽게 추가 가능. 현재는 안 만들지만 가역성 보존

### 기각된 대안
- **B (bigint[] FK)**: PostgreSQL이 array element에 FK constraint 직접 강제 못 함 — trigger로 강제하면 코드 복잡도/디버깅 부담. ON DELETE 처리도 수동. 학습 가치/유지보수 양쪽에서 열위. **언제 B로 전환할 가치 있는가**: services와의 관계가 N:M이 아닌 단순 array tag 수준이고, services row 삭제가 사실상 없는 환경이면 가능 — 우리 상황과 불일치
- **Z (do nothing)**: 백업 영향 분석 = 향후 운영부 메트릭 epic(누가 언제 휴가 가서 어떤 services 영향)의 입력. text chips로는 분석 자체 불가능. 0행 윈도우 놓치면 비용만 ↑

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260514-132106-backup-services-fk.md`
- 예상 변경 파일 수: ~10~15 (마이그레이션 2 + features 3 + 인스펙터 backup variant 3 + tests + 메일/PDF 생성 + 메뉴 카운트 1) → **HARD-GATE 간략 설계** 등급
- 권장 후속: `/plan from-brainstorm 20260514-132106-backup-services-fk.md`
- PR 분할 제안 (단일 PR로도 가능 — 0행이라 risk 낮음):
  - **PR-2** (단일): join table 마이그레이션 + features + UI multi-select + 메일/PDF 갱신 + tests
  - 또는 분할: **PR-2a** schema + features (UI 변경 없음) → **PR-2b** UI multi-select + 메일/PDF 갱신
  - 단일 추천 — 0행이라 schema-only 머지 후 UI 미연결 상태가 무의미

## Out of Scope (이번 epic 제외)

- **contacts text[] 처리** — 대학 연락처 chips. 별도 PR-3 (대학 마스터 도메인 epic)이 다룰 영역
- **service deletion 정책** — services row가 삭제되면 join row CASCADE — 본 PR-2에 포함. 단, "삭제된 service를 참조하던 backup_requests" UI 처리(소프트 인디케이션 등)는 별도
- **백업 영향 분석 대시보드** — 누가/언제 휴가 → 어떤 services 영향. 데이터 적재 후 별도 epic
- **service 검색 자체의 정확도 개선 (to_tsvector + gin)** — 1차는 ilike. PR-1과 동일 정책

## 의사결정 추적

- 2026-05-14T13:21Z: brainstorm created, 대안 A 채택
