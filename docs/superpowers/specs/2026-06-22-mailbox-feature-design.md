# 메일함(Mailbox) 기능 설계

작성일: 2026-06-22
상태: 설계 승인 대기 → 구현 계획(plan) 전 단계

## 1. 개요

고객응대 하위에 **메일함** 메뉴를 추가한다. 운영자 계정별 Outlook 수신함을 준실시간으로 확인하고,
받은 메일에 대한 **회신 초안을 로컬 LLM이 자동 작성**하며, 운영자가 검토 후 **본인(메일함 주인) 명의로 발송**한다.
타 운영자에게 본인 메일함 열람 권한을 위임하는 기능을 Phase 2로 분리한다.

### 요구사항 매핑
1. 계정별 Outlook 수신 메일 준실시간 확인 + 회신 초안 자동 작성 → §4 데이터 흐름, §5 초안 생성
2. 운영자가 초안 발송 여부 선택 후 발송 → §6 UI, §7 발송
3. 화면 구성 → §6 UI
4. 메일함별 "자동 초안 작성 on/off" 토글 → §6 UI, `mailbox_settings.auto_draft_enabled`
5. A가 B에게 본인 메일함 열람 권한 위임 → Phase 2 (§9)

## 2. 핵심 결정 (확정)

| 항목 | 결정 | 근거 |
|------|------|------|
| 단계화 | Phase 1: 본인 메일함 읽기+초안+발송 / Phase 2: 위임 열람 | 위임은 신규 테이블·UI로 분리, Phase 1 빠른 검증 |
| 초안 생성 | **로컬 Ollama**(상시 가동 Mac, 한국어 모델) | 한계비용 0 + **고객 메일 본문 사내 보관**(외부 LLM 전송 회피) |
| 실행 구조 | 로컬 cron ingest 잡이 수신→DB→초안 생성, Vercel 앱은 표시·승인·발송만 | Vercel(서버리스)는 로컬 LLM 불가. 기존 로컬 스크래핑/cron 패턴과 정합 |
| 메일 읽기 인증 | Azure AD **Application 권한 `Mail.Read`** | 기존 sendMail(Application)과 대칭. 운영자별 OAuth 위임 토큰 불필요. Phase 2 위임이 자연스러움 |
| 발송 인증/명의 | **Application `Mail.Send`로 메일함 주인 명의 발송** | 고객이 A에게 보냈으면 회신도 A 명의(B가 처리해도). 스레드 일관 |
| UI 패턴 | ListPattern + 인스펙터 (프로젝트 표준) | `standard-list-inspector-design` 준수, 커스텀 UI 금지 |

## 3. Azure AD 권한 추가

기존 App에 **Application permission** 추가 + admin consent:
- `Mail.Read` (수신함 조회)
- `Mail.Send` (이미 사용 중인지 확인 — sendMail이 쓰는 권한 재사용)

> 보안: Application `Mail.Read`는 테넌트 전체 메일박스 접근이다. 로컬 ingest 잡만 이 자격을 보유하고,
> 웹앱은 DB를 통해서만 메일을 읽는다(앱이 직접 Graph 메일 조회 안 함). "누가 어떤 메일함을 보는가"는 DB 권한으로 게이트한다.

## 4. 데이터 흐름

```
[로컬 Mac · cron 5~10분 간격]
  1. getGraphToken() (Application)
  2. 대상 운영자(=auto 토글 ON 또는 등록된 메일함) 순회:
       GET /users/{owner_email}/mailFolders/inbox/messages?$filter=receivedDateTime gt {last}
  3. 신규 메일 → Supabase mailbox_messages upsert (service_role)
  4. auto_draft_enabled=true 운영자의 신규·미초안 메일:
       no-reply/자동발신 필터 통과분만 → Ollama 회신 초안 생성 → mailbox_drafts insert
        │
        ▼ (Supabase Realtime 또는 자동 새로고침)
[Vercel 웹앱 /dashboard/mailbox]
  - SSR: 현재 운영자 owner_email = me (Phase 2: OR 위임받은 owner) 메일 조회
  - 인스펙터: 본문 + 초안 표시
  - 발송: sendGraphMail(sender = owner_email, ...) → mailbox_drafts.status='sent'
```

ingest 잡 위치: `scripts/mailbox-ingest.mjs` (기존 로컬 스크립트 패턴) + 로컬 cron/launchd 등록.
last-sync 커서: `mailbox_settings.last_synced_at` 또는 메시지 max(received_at)로 증분.

## 5. 초안 생성 (로컬 LLM)

- 런타임: 로컬 Ollama (`http://localhost:11434`).
- 모델: 한국어 강한 7~8B (예: `exaone3.5:7.8b` 또는 `qwen2.5:7b`). 환경변수 `MAILBOX_LLM_MODEL`로 교체 가능.
- 입력: 받은 메일 제목+본문(+가능 시 직전 스레드), 운영부 톤 지침(한국어 비즈니스 정중체), 운영자 서명 정보.
- 출력: 회신 본문 초안(plain text). `mailbox_drafts.draft_body` + `model_used` 저장.
- 비용/개인정보: 외부 호출 0, 메일 본문 로컬 처리.
- 필터: `no-reply`, `noreply`, `mailer-daemon`, 뉴스레터성 발신자는 초안 생략(`mailbox_messages.draft_skipped=true`).

## 6. UI (요구사항 3) — ListPattern + 인스펙터

```
┌─ 메일함 ───────────────────── [자동 초안 ●ON] [내 메일함 ▼] ─┐
│ 받은 메일 (좌, ListPattern)  │  인스펙터 (우, 클릭 시)          │
│ ● 김민수  견적 문의   09:12  │  From 김민수<...@...>   09:12    │
│   ✎초안준비                  │  To   (메일함 주인)              │
│ ○ 이영희  계약 관련   08:40  │  제목 견적 문의                  │
│   ✎초안준비                  │ ───────────────────────────     │
│ ○ no-reply 뉴스레터   08:01  │  (메일 본문, 읽기 전용)          │
│   —                          │ ─── ✎ AI 회신 초안 ──────────   │
│                              │  [편집 가능 textarea, 미리 채움] │
│                              │  [발송] [폐기]       [다시 생성] │
└──────────────────────────────┴──────────────────────────────────┘
```

- 좌측 행: `●` 미열람 / `○` 열람, `✎초안준비` 배지(초안 생성됨), 시간/발신자/제목.
- 상단 **[자동 초안 ON/OFF]** = 요구사항 4. OFF면 ingest가 해당 메일함 초안 생성 생략.
- 상단 **[내 메일함 ▼]** = Phase 2 위임받은 타 메일함 전환(Phase 1엔 본인 고정, 단일 항목).
- 인스펙터: 메일 헤더 → 본문(읽기전용) → AI 초안(편집 가능) → [발송][폐기][다시 생성].
- 신규 도메인 추가: `list-variants/mailbox/` 폴더 + `registry.ts` 1줄 + `types.ts` Variant union 1줄.
- `ListRow`에 `mail*` 옵셔널 필드 추가(mailId/mailFrom/mailSubject/mailReceivedAt/mailIsRead/mailHasDraft 등).

## 7. 발송

- 서버 액션 `sendMailReply(messageId, editedBody)`:
  1. 권한 확인: 현재 운영자가 해당 메일함 주인이거나(Phase 1) 위임받았는지(Phase 2).
  2. `sendGraphMail({ senderUserId: owner_email, to: 원발신자, subject: "RE: ...", body: editedBody, ... })`.
  3. 성공 시 `mailbox_drafts.status='sent'`, `sent_at`, `sent_by_email`(실제 클릭한 운영자) 기록.
- 발신 명의 = **메일함 주인(owner_email)**. `sent_by_email`로 실제 처리자 감사 추적.
- `MAIL_DRY_RUN=true` 시 실제 발송 없이 이력만(`status='dry_run'`) — 기존 안전장치 재사용.

## 8. 데이터 모델 (신규 마이그레이션)

```sql
-- mailbox_messages: 수신 메일 캐시
id uuid pk, owner_email text, graph_message_id text unique,
from_name text, from_email text, subject text, body_preview text, body text,
received_at timestamptz, is_read bool, draft_skipped bool default false,
created_at timestamptz default now()

-- mailbox_drafts: 회신 초안/발송 이력
id uuid pk, message_id uuid fk mailbox_messages(id) on delete cascade,
draft_body text, model_used text,
status text check (status in ('draft','sent','discarded','dry_run')) default 'draft',
sent_at timestamptz, sent_by_email text, created_at timestamptz default now()

-- mailbox_settings: 메일함별 토글
owner_email text pk, auto_draft_enabled bool default true,
last_synced_at timestamptz, updated_at timestamptz default now()

-- (Phase 2) mailbox_delegations: 위임
id uuid pk, owner_email text, grantee_email text,
granted_at timestamptz default now(), revoked_at timestamptz,
unique(owner_email, grantee_email)
```

RLS: read는 운영부 + 권한 게이트(본인/위임), insert·update는 service_role(로컬 잡·서버 액션 only).
Realtime publication에 `mailbox_messages`, `mailbox_drafts` 등록(준실시간 표시).

## 9. Phase 2 — 위임 열람 (요구사항 5)

- 설정 화면에서 A가 B를 등록 → `mailbox_delegations(owner_email=A, grantee_email=B)`.
- B의 메일함 화면 [내 메일함 ▼]에 "A 메일함" 노출. 선택 시 owner=A 메일 조회(앱 권한으로 이미 DB에 적재됨).
- 발송은 §7 규칙대로 **A 명의**, `sent_by_email=B` 기록.
- `canAccessMailbox(viewer, owner)` 헬퍼: viewer==owner 또는 활성 위임 존재.

## 10. 영향 범위 / 변경 등급

신규 테이블 4 + 마이그레이션 + 전용 페이지 + variant 폴더 + 로컬 ingest 잡 + Graph mail-read 라이브러리
+ 설정/토글 UI → **20+ 파일, 전체 설계 등급**(Planner 필수). Phase 1만으로도 간략~전체 설계 경계.

## 11. 재사용 자산 (Explore 매핑)

- 메뉴: `_data.ts` 고객응대 group items 1줄 + `mailbox/page.tsx`.
- Graph: `getGraphToken()`(Application), `sendGraphMail()` fetch+에러 패턴 → 신규 `mail-read.ts`에 차용.
- 권한: `getCurrentOperator()`, `requireMenu()`.
- variant: `registry.ts`/`types.ts`/InspectorPanel/ListPattern 셸. worklog(View-only) 템플릿.
- 실시간: `useDashboardRealtime` 또는 `AutoRefreshCountdown`.
- ingest 인증/이력 패턴: `closing/ingest` + 로컬 스크립트.

## 12. Phase 1 / Phase 2 경계

**Phase 1 (이번 구현)**
- Azure `Mail.Read` consent, `mail-read.ts`, 로컬 ingest 잡, 4 테이블 중 messages/drafts/settings.
- `/dashboard/mailbox` 페이지 + mailbox variant + 자동초안 토글.
- 로컬 Ollama 초안 생성, 본인 메일함 발송(sendMailReply).

**Phase 2 (후속)**
- `mailbox_delegations` 테이블 + 위임 설정 UI + [내 메일함 ▼] 전환 + `canAccessMailbox`.
- 발신 명의 A / `sent_by_email=B` 감사.

## 13. 미해결/후속 확인 사항

- 대상 운영자 범위: Phase 1은 "메일함 메뉴 사용 운영자(설정 row 존재)"로 한정 시작.
- 스레드 컨텍스트: 초안에 직전 대화 포함 여부(품질↑ vs 토큰↑) — 1차는 단일 메일 기준.
- ingest 주기/증분 커서 세부.
- 로컬 모델 최종 선정(EXAONE vs Qwen) — 한국어 회신 샘플 비교 후 확정.
