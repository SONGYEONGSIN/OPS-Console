# Brainstorm: 백업 요청 메뉴 — 휴가·외근 인수인계 + 자동 메일

세션: 2026-05-13 오전
사이드바: '실시간 현황' > '백업 요청' (slug `backup`, pattern `list`, count "1" 하드코드)

## 의도

- **산출물**: `/dashboard/backup` — 운영자가 휴가·외근 직전 본인 담당 서비스를 동료(백업자)에게 인계. 등록 시 백업자에게 HTML 메일 + PDF 첨부 자동 발송, 팀원 CC
- **사용자**: 운영자 본인(요청자) — 휴가·외근 직전. 인계받는 동료(백업자)는 메일 수신만. 권한: 등록한 모든 계정 접근 가능
- **트리거**: 현재 카톡·말로 전달되는 인수인계의 누락·맥락 손실. 시스템 기록으로 사후 추적 가능 + 메일 본문/PDF가 모바일에서도 열림
- **성공 기준**:
  - 첫 한 달 내 5건 이상 등록
  - 메일 전송 성공률 > 95% (Microsoft Graph 기준)
  - 백업자가 모바일에서 PDF 첨부 열어보는 데 문제 없음 (텍스트 깨짐·이미지 누락 0)

### 입력 사양 (사용자 확정)

| 필드 | 형식 | 비고 |
|------|------|------|
| 요청자 | 자동 (현재 계정) | my-ai-work `author_email` 패턴 일관 |
| 서비스 | 다중 선택 | '전체 서비스' 메뉴(slug `services`) 데이터 출처. 현재 미구현 → 1차 자유 텍스트 |
| 백업 내용 | 텍스트(markdown) | 인계 핵심 — 진행 상태, 마감, 주의사항 |
| 백업자 | 단일 선택 (operators 목록) | 인계받을 동료 |
| 대학 연락처 | 다중 선택 | '대학 연락처'(slug `contacts`). 현재 미구현 → 1차 자유 텍스트 |
| 휴가/외근 기간 | 시작·종료 date | 사용자 명시 안 했지만 메일 본문에 필요한 컨텍스트라 추가 권장 |

### 발송 규칙

- 수신자(To): 백업자 이메일
- 참조(CC): 요청자 팀원 (operators 같은 team 필드) — 정의는 plan 단계에서 확정
- 본문: HTML (모바일 호환)
- 첨부: 동일 내용 PDF (백업자 보관용)
- 발신자: 요청자 본인 메일박스 (receivables 메일 패턴 일관 — Azure AD UPN = operators.email)

## 제약

### 기술
- Next.js App Router + Supabase + zod
- 메일 발송: 기존 Microsoft Graph sendMail 인프라 재사용 (Mail.Send Application permission + admin consent 이미 확보)
- PDF 생성: 서버 사이드. 후보 — `@react-pdf/renderer`(가벼움, RSC 호환), `puppeteer`(무겁고 deploy 복잡), HTML→PDF 외부 API(비용). 1차로 `@react-pdf/renderer` 검토
- 다중 선택 UI는 chips + 자유 텍스트 fallback (services/contacts 도메인 미숙성)
- 메일 발송 + DB 저장은 atomic하지 않아도 됨 — DB 먼저 저장, 메일 실패 시 status='mail_failed' + 재발송 버튼

### 비즈니스
- 휴가 전 1~2일 사이 빠르게 작성하는 시점 → 폼 한 화면 + 인스펙터 (list-variants 패턴) 유지
- 첨부 PDF의 핵심 가치: 동료가 메일을 외부 PC/모바일에서 열어도 같은 정보 보장
- `MAIL_DRY_RUN=true` 안전장치 receivables 패턴 그대로 — 운영 검증 후 false 전환

### 코드베이스
- 사이드바: slug `backup`, pattern `list` 이미 등록 — 정적 라우트로 `[slug]` dynamic 오버라이드 (ai-insight와 동일 전략)
- **list-variants 아키텍처 활용** (방금 머지된 #86): `_components/inspector/list-variants/backup/` 폴더 신설 + `registry.ts` 1줄 추가
- services / contacts 도메인 미구현 — **이번 epic에서 풀 모델 안 만든다** (대안 B). 자유 텍스트 input + 운영부가 실제 쓰는 값 데이터화 후 follow-up
- 운영자 목록: `OPERATORS` 시드 또는 `operators` 테이블 — 이미 존재. team 필드도 이미 있음
- 메일 인프라: `src/components/receivables/SendReceivablesMailButton.tsx` + `supabase/migrations/20260511_receivables_mail_sends_*` 패턴

## 대안 비교

| 항목 | 대안 A | 대안 B (채택) | 대안 C | 대안 Z |
|------|--------|--------------|--------|--------|
| 핵심 | 백업 메뉴 + services + contacts 풀 도메인 동시 신설 | 백업 메뉴만 우선, 서비스·연락처는 자유 텍스트 | 등록 폼·DB만, 메일 발송은 follow-up | 카톡·말로 인계 유지 |
| 비용 | 4~5일 (테이블 6 + features 9 + UI 8 + 메일 + PDF) | 2~3일 (테이블 2 + features 3 + UI 5 + 메일 + PDF) | 1~1.5일 (테이블 2 + features 3 + UI 4) | 0일 |
| 위험 | services/contacts 미숙성된 채 굳음 — 운영자 실 사용 패턴 모름 | 자유 텍스트 → 데이터 정합성 낮음 (동일 대학 다른 표기) | 핵심 가치(메일+PDF) 누락 → MVP 검증 실패 | 누락·맥락 손실 지속 |
| 가역성 | 낮음 — 세 도메인 묶임 | 높음 — services/contacts 후속 도메인 신설 시 텍스트→FK 마이그레이션 | 중 — 메일·PDF 후속 가산 쉬움 | n/a |
| 학습 효과 | 세 도메인 동시에 모름 | "운영자가 실제 어떤 서비스·연락처 명을 쓰는지" 데이터 축적 → 후속 도메인 schema 단서 | 시스템화 1단계 검증 | 없음 |

## 추천 + 근거

**대안 B 채택**.

### 선택 근거
1. **핵심 가치(메일+PDF 도달) 보존** — 사용자가 명시한 "메일 발송 + 팀원 CC + PDF 첨부"는 빠뜨릴 수 없음. C는 이 가치 누락
2. **미숙성 도메인 강제 굳히기 방지** — services/contacts는 사이드바 count("179", "87")만 있을 뿐 실 데이터/요구사항이 정리 안 됨. 자유 텍스트로 우선 받고, 운영부 실 입력 패턴이 쌓이면 후속에서 정식 schema 설계 (현재 의사결정 비용 < 데이터 후 의사결정 가치)
3. **list-variants registry 즉시 활용** — #86으로 생긴 "1폴더+1줄" 비용 구조 검증. 새 도메인 추가의 ROI 측정 기회

### 기각된 대안
- **A**: services/contacts를 동시에 만들면 추가 4~5일 + 두 도메인의 핵심 입력 필드를 모르는 상태에서 결정 강제 → 후속 변경 부채만 늘림. 백업 epic이 끝난 뒤 실 사용 데이터를 보고 별도 epic으로 분할이 합리적
- **C**: 메일 발송 없는 백업은 메모장 — 사용자가 명시한 핵심 가치 누락. MVP 검증(95% 성공률) 불가
- **Z**: 사용자 명시 의도 무시. 사이드바 메뉴 자체가 이미 placeholder로 있어 운영부 기대를 만들고 있음

## 데이터 모델 (확정)

테이블 `backup_requests` (~13 필드):

| # | 필드 | 형식 | 비고 |
|---|------|------|------|
| 1 | id | uuid pk | |
| 2 | requester_email | text not null | operators.email |
| 3 | requester_team | text | 발송 시 CC 산출용 (operators.team 스냅샷) |
| 4 | substitute_email | text not null | 백업자 |
| 5 | substitute_name | text not null | 메일 본문 표기용 스냅샷 |
| 6 | services | text[] | 1차 자유 텍스트 chips |
| 7 | contacts | text[] | 1차 자유 텍스트 chips (대학 연락처명) |
| 8 | summary_md | text not null | 백업 내용 (markdown) |
| 9 | leave_start_date | date | 휴가/외근 시작 |
| 10 | leave_end_date | date | 종료 |
| 11 | mail_status | text | 'pending' / 'sent' / 'mail_failed' / 'dry_run' |
| 12 | mail_sent_at | timestamptz | |
| 13 | mail_error | text | 실패 시 에러 |
| 14 | created_at / updated_at | timestamptz | |

부가 테이블 `backup_request_mail_sends` (메일 발송 이력, receivables_mail_sends 패턴 일관) — 재발송 추적용

### RLS
- SELECT: authenticated 전원 (사용자 명시 "현재 등록한 계정 모두 접근")
- INSERT: 본인이 requester_email인 경우 (auth.jwt() email)
- UPDATE / DELETE: 본인 작성 + admin
- 메일 발송 server action은 service_role bypass

### 인덱스
- `requester_email`, `substitute_email`, `created_at desc`

## list-variants 통합 설계 (확정)

`src/app/dashboard/_components/inspector/list-variants/backup/`:
- `View.tsx` — 인스펙터 읽기 (요청자/백업자/서비스 chips/내용/기간/메일 상태)
- `EditForm.tsx` — 등록·편집 폼 (services·contacts chips + 백업자 select + date range + markdown editor)
- `Table.tsx` — 리스트 행 (요청자, 백업자, 시작일, 메일 상태 배지)
- `filters.ts` — 필터 옵션 (메일 상태 / 본인 등록만) + blank 행 factory
- `registry.ts`에 1줄 추가

## Out of Scope (이 epic 제외)

- **services 도메인 정식 모델** — 자유 텍스트 + chips로 우선
- **contacts 도메인 정식 모델** — 자유 텍스트 + chips로 우선 (대학 연락처)
- **자동완성 (operators 외)** — services/contacts는 직전 등록값 기반 suggest만 (백엔드 X, 클라이언트 distinct)
- **승인 워크플로우** — 사용자 명시: "전원 접근 가능"이라 승인 없이 즉시 발송
- **첨부 파일 업로드** — Excel/문서 첨부는 follow-up. 1차는 텍스트+PDF 자동 생성만
- **반복 백업 (정기)** — 단발성만
- **백업자 수락/거절 응답** — 메일 통지만, 시스템 응답 X
- **알림 (Slack/사이드바 카운트 동적)** — count "1" 하드코드 유지, 카운트 동기화는 후속

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260513-003405-backup-request-handover.md`
- 예상 변경 파일 수: ~15~17 (마이그레이션 2 + features 3 + list-variants 4 + page 1 + PDF 1 + mail action 1 + tests 4) → **HARD-GATE 간략 (Planner 권장)**
- 권장 후속: `/plan from-brainstorm 20260513-003405-backup-request-handover.md`
- PR 분할 제안:
  - PR-1: DB + features + list-variants (메일/PDF 제외) — UI 등록·조회까지
  - PR-2: 메일 발송 server action + PDF 생성 + dry_run 검증
- designer 에이전트: 폼 + 인스펙터 View가 복잡(다중 chips × 2 + date range + markdown + select)하므로 Phase 0 호출 가치 있음
