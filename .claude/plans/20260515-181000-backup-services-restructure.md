---
plan_id: 20260515-181000-backup-services-restructure
status: completed
created: 2026-05-15T09:10:00Z
completed: 2026-05-16T00:00:00Z
hard_gate: full
source: brainstorm:.claude/memory/brainstorms/20260515-180000-backup-services-restructure.md
branch: feat/backup-services-restructure
pr: 113
---

# Plan: 백업 요청 서비스 단위 재구조화

## Goal

`backup_requests.contacts text[]`를 DROP하고 `backup_request_services`에 `contacts text[] + note_md text` 추가. 폼은 서비스 카드 단위(백업자 + 연락처 + 메모) 펼침 구조. 메일은 백업자별 그룹화 유지하되 본문에 공통 메모 + 자기 담당 서비스 카드들. 마이그레이션 + ~10 파일을 단일 PR로 묶어 머지.

## Approach

brainstorm의 "서비스 = 1차 단위" 원칙 적용. 운영 데이터 0건이라 backfill 불필요 — column add + drop으로 끝. 서비스 카드 sub-component(`backup/ServiceCard.tsx`) 추출로 EditForm 비대 회피. 마이그레이션 prod 적용은 SQL Editor 수동 (PR 머지와 별도).

## Out of Scope

- 백업자별 재발송 UI
- 한 서비스에 백업자 N명
- 서비스 카드 reorder
- 마이그레이션 prod 적용 (수동)

## 영향 파일 (의존 그래프)

```
T1 마이그레이션 ───┐
                  ├─→ T2 schemas ──┬─→ T3 queries ──┬─→ T4 actions ──┐
                                  │                  │                │
                                  └─→ T5 mail-template ─→ T6 mail-actions
                                                                       │
                                  T7 ListPattern type ─────────────────┤
                                  T8 ServiceCard.tsx ──┐               │
                                  T9 EditForm ─────────┼─→ T11 page ──→ T12 verify
                                  T10 View ────────────┘
```

## 단계

### T1: 마이그레이션 — column add + drop

- **상태**: pending
- **파일**: `supabase/migrations/20260525_backup_request_services_contacts_notes.sql` (신규)
- **변경**:
  ```sql
  begin;
  -- backup_request_services 확장
  alter table public.backup_request_services
    add column if not exists note_md text,
    add column if not exists contacts text[] not null default '{}';

  -- backup_requests.contacts 제거 (운영 데이터 0건)
  alter table public.backup_requests drop column if exists contacts;

  notify pgrst, 'reload schema';
  commit;
  ```
- **DoD**: SQL Editor 적용 후 `select column_name from information_schema.columns where table_name in ('backup_requests','backup_request_services');` — backup_requests에 contacts 없고 backup_request_services에 note_md/contacts 있음
- **의존**: 없음

### T2: schemas.ts — serviceDetailSchema 확장, top-level contacts 제거

- **상태**: pending
- **파일**: `src/features/backup-requests/schemas.ts`
- **변경**:
  - `serviceDetailSchema`에 `note_md: z.string().nullable().optional()`, `contacts: z.array(z.string().min(1)).max(20).default([])` 추가
  - top-level `contacts` (line 40, 73, 114 영역) 제거
  - `backupRequestCreateSchema.services` tuple 확장
- **DoD**: vitest `schemas.test.ts` — 신규 케이스 (contacts/note_md 포함 services tuple parse 성공 + 빈 contacts default 적용). top-level contacts 키 부재로 parse 성공
- **의존**: 없음 (T1과 병렬 가능)

### T3: queries.ts — SELECT_WITH_SERVICES 확장, flatten 매핑

- **상태**: pending
- **파일**: `src/features/backup-requests/queries.ts`
- **변경**:
  - `SELECT_WITH_SERVICES`에 `backup_request_services.note_md, contacts` 추가
  - `mapBackupRequestRow`/flatten 단계에서 `services_detail`에 두 필드 보존
  - `backup_requests.contacts` SELECT 제거
- **DoD**: typecheck pass + `queries.test.ts` mock data에 note_md/contacts 포함 → 결과에 보존 확인
- **의존**: T1, T2

### T4: actions.ts — services join row insert에 contacts/note_md

- **상태**: pending
- **파일**: `src/features/backup-requests/actions.ts`
- **변경**:
  - `joinRows` 영역 (line 58~65 PR-3 자리 부근): `contacts: s.contacts ?? []`, `note_md: s.note_md ?? null` 추가
  - top-level `contacts: parsed.data.contacts` insert/update 제거
- **DoD**: `actions.test.ts` — 신규 case: 서비스 2개 + 각각 다른 contacts/note_md → insert payload에 서비스별 보존
- **의존**: T2, T3

### T5: mail-template.ts — 본문 layout 재설계

- **상태**: pending
- **파일**: `src/features/backup-requests/mail-template.ts`
- **변경**:
  - `BackupMailInput`에서 top-level `contacts: string[]` → **제거**. `services` 원소에 `contacts/note_md` 포함 (이미 ServiceDetail type 확장으로 자연 반영 — T2에서 처리)
  - `buildBackupMailHtml` 본문 재구성:
    - 인사말, 요청자/휴가 기간, **공통 메모(`summaryMd`) 있으면 상단 1회**
    - "담당 서비스" 섹션 → 각 서비스 카드 div: `대학명 — 서비스명 / 연락처 chips / 서비스 메모`
    - 기존 "연락처" 단일 섹션 제거
  - `groupServicesBySubstitute` 그대로 (변경 없음 — services 원소 타입만 풍부해짐)
- **DoD**: `mail-template.test.ts` — 4 케이스: ① 공통 메모만 ② 서비스별 메모만 ③ 둘 다 ④ 서비스마다 다른 연락처. 각 case에서 HTML에 기대 문자열 포함
- **의존**: T2

### T6: mail-actions.ts — services_detail 전달, 본문 입력 형식만 갱신

- **상태**: pending
- **파일**: `src/features/backup-requests/mail-actions.ts`
- **변경**:
  - `mailInput` 구성 (line 172~182): top-level `contacts: backup.contacts` 제거
  - `services: group.services` 그대로 (이미 contacts/note_md 포함)
  - PDF 생성 (line 149~160 `renderBackupRequestPdf`): top-level `contacts` 제거, `services`만 전달 (PDF 빌더도 T5와 동일 layout 따라가도록 함께 갱신 필요 시 sub-step)
- **DoD**: `mail-actions.test.ts` — 백업자 2명 case → sendGraphMail 2회, 각각 자기 서비스의 contacts/note_md만 본문에 포함
- **의존**: T5

### T7: ListPattern.tsx — backupServicesDetail 원소 타입 확장

- **상태**: pending
- **파일**: `src/app/dashboard/_components/patterns/ListPattern.tsx`
- **변경**:
  - `backupServicesDetail` 원소 type에 `note_md: string | null; contacts: string[]` 추가
  - top-level `backupContacts/backupContactsDetail` 필드 → **제거** (서비스로 흡수)
- **DoD**: typecheck pass. ListRow shape grep으로 dangling reference 없음 확인
- **의존**: T3

### T8: ServiceCard.tsx — 서비스 카드 sub-component 추출 (신규)

- **상태**: pending
- **파일**: `src/app/dashboard/_components/inspector/list-variants/backup/ServiceCard.tsx` (신규)
- **변경**: 신규 component
  ```tsx
  type Props = {
    detail: { id: string; university_name: string; service_name: string;
              substitute_email: string | null; substitute_name: string | null;
              note_md: string | null; contacts: string[] };
    backupOperators: { email: string; name: string }[];
    contactCandidates: { id: string; customer_name: string; university_name: string }[];
    onSubstituteChange: (email: string, name: string) => void;
    onContactsChange: (contacts: string[]) => void;
    onNoteChange: (note: string) => void;
    onRemove: () => void;
  };
  export function ServiceCard(props: Props) { /* ... */ }
  ```
  카드 내부:
  - 헤더: `대학명 — 서비스명 / 백업자 select / × 버튼`
  - 본문: 연락처 검색 dropdown + chips 표시, 메모 textarea
- **DoD**: `ServiceCard.test.tsx` — 백업자 select 변경 → onSubstituteChange. 연락처 검색 후 click → onContactsChange. 메모 입력 → onNoteChange. 제거 버튼 → onRemove
- **의존**: T7

### T9: EditForm.tsx — chip → 카드, 일괄 연락처 섹션 삭제

- **상태**: pending
- **파일**: `src/app/dashboard/_components/inspector/list-variants/backup/EditForm.tsx`
- **변경**:
  - 기존 "담당 서비스" chip block (line 184~265) → `selectedDetail.map(s => <ServiceCard key={s.id} detail={s} ... />)`로 교체
  - "대학 연락처" 일괄 block (line 267~321) → **전면 삭제**
  - `selectedContactIds/selectedContactsDetail/contactQuery/contactMatches/addContact/removeContact` 상태/헬퍼 → **삭제**
  - 카드 onContactsChange/onNoteChange 핸들러는 `setRow({ ...row, backupServicesDetail: next })` 패턴
  - props `backupContactCandidates`는 ServiceCard로 전달 (per-card 검색)
- **DoD**: `EditForm.test.tsx` — 서비스 추가 → 카드 렌더, 카드 내 연락처/메모 변경 → setRow 호출 검증. 기존 "대학 연락처" 일괄 input 부재
- **의존**: T7, T8

### T10: View.tsx — 서비스 카드 내 연락처/메모 표시

- **상태**: pending
- **파일**: `src/app/dashboard/_components/inspector/list-variants/backup/View.tsx`
- **변경**:
  - 기존 서비스 chip 라벨 → 카드 형태로 확장 (`대학 — 서비스 / 백업자 / 연락처 chips / 메모 markdown`)
  - 기존 "대학 연락처" 일괄 표시 영역 → **삭제**
  - 공통 메모(`summaryMd`)는 별도 섹션 유지
- **DoD**: `View.test.tsx` — 서비스 2개 + 각각 contacts/note_md → 카드 2개 렌더, 일괄 연락처 영역 부재
- **의존**: T7

### T11: backup/page.tsx — onPersist 새 shape

- **상태**: pending
- **파일**: `src/app/dashboard/backup/page.tsx`
- **변경**:
  - `onPersist`에서 services 원소가 `{service_id, substitute_email, substitute_name, contacts, note_md}` 모두 전달하도록 갱신
  - top-level `contacts` 전달 제거
  - `backupRequestToListRow`에서 서비스 원소에 contacts/note_md 보존, top-level backupContacts 제거
- **DoD**: 로컬 `/dashboard/backup` 신규 등록 → DB row에 서비스별 contacts/note_md 보존. 새로고침 시 동일 데이터 복원
- **의존**: T4, T7, T8, T9

### T12: 회귀 테스트 통합 + /verify

- **상태**: pending
- **파일**: `src/features/backup-requests/__tests__/*` 보강
- **변경**:
  - mail-template / schemas / actions / mail-actions 각 신규 케이스 통합 실행
  - 백업자 1명 일괄(default만) back-compat case 명시
  - 백업자 2명 + 각자 다른 contacts/note_md case
  - 공통 메모 + 서비스 메모 동시 case
- **DoD**: `npm run verify` (lint + typecheck + test + e2e) 모두 PASS
- **의존**: T2~T11

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| 마이그레이션 prod 미적용 상태에서 머지 → 런타임 schema mismatch | PR 본문에 "수동 SQL Editor 적용 필요" 명시. 머지 직전 사용자 적용 확인 |
| EditForm 길이 ↑ | ServiceCard 추출로 EditForm은 200줄 이내 dispatcher로 축소 목표 |
| top-level contacts dangling code | T2 schemas 변경 후 grep `backupContacts\|top-level contacts` 0건 확인 (T7/T9/T10/T11 동기) |
| mail-template HTML 깨짐 | T5 케이스 4개로 회귀. 실제 메일 dry_run 결과 사용자 시각 확인 권장 |

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|-----------|------|
| 2026-05-15T09:10:00Z | — | plan 생성 | brainstorm 20260515-180000 입력. branch `feat/backup-services-restructure` |
| 2026-05-16T00:00:00Z | T1~T12 | 일괄 완료 | PR #113 squash merge (commit 2080d6d). 마이그레이션 20260525 prod 적용 검증 완료 |
