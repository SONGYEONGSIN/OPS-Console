# Brainstorm: 대학 연락처 도메인 (slug `contacts`)

## 의도

- **산출물**: Folio `contacts` 도메인 신설 — DB 테이블 `contacts` + RLS + list-variants slot + `/dashboard/contacts` 페이지. mockup 11 컬럼(활성화/고객명/직함/대학명/소속부서/직책/관리등급 A~D/관계등급/휴대폰/내선/이메일). admin/member 등록·수정·삭제, viewer read-only
- **사용자**: 운영부 admin/member가 학교 담당자 연락처를 등록·수정·조회. backup 도메인 EditForm에서 *검색 source*로 활용(follow-up PR). viewer는 read-only 조회
- **트리거**: 사용자 명시 요청. backup EditForm의 대학 연락처가 자유 입력 텍스트 → 검색 가능하게 만들기 위한 *의존성*. 사이드바 메뉴(slug `contacts`)는 이미 등록 + count "87" placeholder
- **성공 기준**:
  - `/dashboard/contacts` 진입 200 OK
  - 등록·수정·삭제 정상 (admin/member)
  - 검색(이름/대학명) + 필터(직책/관리등급/관계등급) 동작
  - viewer 권한 분리 (RLS — select 가능, mutation 차단)
  - backup EditForm에서 활용 가능한 `listContacts` query API 노출

## 제약

- **기술**: Supabase RLS (admin/member mutation, authenticated select). zod schema + Server Action 패턴. list-variants 12번째 slot. 대학명은 free text(1차) — 향후 `services.university_name` distinct에서 자동완성 (services universityKeys 패턴)
- **비즈니스**: 운영부가 *현재 별도 시스템 없음*(자유 입력 chips만). mockup이 11 컬럼 명세 — 등록 UI 의도 명확. 직책(실무자/관리자) / 관리등급(A/B/C/D) / 관계등급(우호적/...) enum은 1차 PR에서 text 자유 입력 → 실 데이터 분포 후 follow-up enum check 도입
- **코드베이스**: services 패턴 거의 그대로 재사용 — schemas + queries + actions + list-variants slot + page.tsx + Controls. 4 common UI 표준(ListSearch/ListSelect/ScopeChips/ListPagination) 적용. mockup 디자인 token은 design-tokens.ts 그대로

## 대안 비교

### 대안 A: Folio DB (services 패턴)

- 핵심: contacts 테이블 + RLS + features/contacts + list-variants/contacts + /dashboard/contacts. 등록·수정·삭제 가능
- 비용: ~14~16 파일 (마이그레이션 2 + features 3 + list-variants 4 + page + Controls + tests + registry/types/ListPattern 갱신)
- 위험: enum 값 미확정(직책/관리등급/관계등급) — 실 데이터 분석 후 enum check 도입. 1차는 text
- 가역성: 중간 (DB drop + 코드 제거)
- 학습: services 패턴 재사용 검증 — 향후 도메인 신설 비용 추정 가능

### 대안 B: SharePoint Excel 연동 (contracts 패턴)

- 핵심: SharePoint 연락처 Excel을 Graph로 read. read-only. Folio가 view 역할
- 비용: ~6~10 파일 (contracts 패턴 모방)
- 위험: **운영부가 현재 SharePoint에 연락처 시트가 있는지 미확인**. 없다면 빈 view. 등록 X
- 가역성: 높음
- 학습: SharePoint 활용 도메인 추가 사례

### 대안 Z: 아무것도 안 함

- backup EditForm의 자유 입력 chips 유지. 검색 불가
- 우회: 운영부가 학교 연락처를 SharePoint/Sheets에서 직접 관리, Folio는 free text만
- 사용자 요청과 충돌

## 추천 + 근거

**추천: 대안 A — Folio DB (services 패턴)**

**선택 근거**:
1. **mockup이 등록 UI 명세** — 사용자 의도가 *Folio에서 직접 입력·관리*. SharePoint read-only(B) 부적합
2. **services 패턴 재사용** — schemas/queries/actions/slot/Controls 동일 구조. 검증된 인프라
3. **backup 검색 의존성** — backup EditForm이 `listContacts()` query 활용. Folio DB가 source-of-truth면 권한·검증 일관
4. **점진적 enum 도입** — 1차는 text 자유 입력, 실 데이터 분포 후 follow-up enum check (services 도메인 PR-1.5와 동일 패턴)

**기각된 대안 B**: 운영부가 SharePoint에 연락처 시트 *유무 미확인*. mockup 형태(등록 UI)와 read-only view 충돌. 만약 SharePoint 시트가 발견되면 *한 번 import 후 source-of-truth = Folio* 흐름은 가능 (PR-2 follow-up).

**기각된 대안 Z**: backup 검색 가능 위해 필수.

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260515-120417-university-contacts-domain.md`
- HARD-GATE: ~14~16 파일 → **간략 설계** ⇒ `/plan` 권장
- 1차 PR 범위: 도메인 신설 (CRUD + 검색·필터). backup EditForm 검색 연결은 별도 PR-N
- 향후 epic: enum check 도입(PR-1.5) / backup EditForm 연결(PR-2) / 백업자 서비스별 분리(PR-3)
