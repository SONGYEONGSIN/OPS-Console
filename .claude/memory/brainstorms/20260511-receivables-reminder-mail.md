# Brainstorm — 미수채권 학교담당자 독려 메일 발송

**작성일**: 2026-05-11
**Status**: 결정 완료, /plan으로 진행 예정

## 1. 사용자 의도

경과일수 ≥ 10일인 미수채권 청구 건에 대해, SharePoint Excel "학교담당자" 컬럼에 입력된 이메일로 입금 독려 메일을 발송한다. 학교담당자별로 청구 건들을 묶어 1통의 메일로 발송한다.

## 2. 결정 사항 (대안 비교)

| 항목 | 결정 | 대안 (기각) | 사유 |
|------|------|------------|------|
| **메일 백엔드** | Microsoft Graph sendMail | Supabase Edge + SMTP, Resend, SendGrid | 현재 SharePoint Excel 인프라(`getGraphToken` + `client_credentials`)를 재활용. 추가 도메인/키 관리 0. `Mail.Send` Application 권한만 추가 |
| **트리거** | 수동 버튼 + 미리보기 모달 | 자동 cron, 행별 버튼 | 초기 안전성·결정권 확보. preview→승인→일괄 발송 흐름. 자동화는 후속 단계 |
| **묶음** | 학교담당자별 1통 (담당자가 가진 청구건 table 포함) | 청구건별 개별 발송 | 제공된 HTML 참고 템플릿이 이미 묶음 구조. 수신자 입장에서 1통이 명확 |
| **권한** | admin 전용 (현재 페이즈) | viewer 제외 모든 운영자, allowed_menus 기준 | 오발송 방지 + 권한 확대는 안전한 방향. 추후 'member'로 확대 가능하게 코드 분리 |
| **학교담당자 컬럼** | Excel '학교담당자' 컬럼에 이메일 직접 입력됨 | 별도 매핑 테이블 | Excel 측에서 관리. Folio는 lookup만 |
| **회사명/발신자** | 회사명 = ENV 고정, 발신자 = 로그인 운영자 `operators.display_name` | operators 테이블에 company_name 필드 추가 | 단일 회사 가정. multi-tenant는 후속 |
| **발송 이력** | `receivables_mail_sends` 테이블 신규 | console.log만, 또는 미기록 | 이력 조회·중복 발송 방지·실패 재시도 기반. RLS는 operators 권한 동일 |

## 3. 데이터 모델

### 신규 Supabase 테이블: `receivables_mail_sends`

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid pk | |
| sent_at | timestamptz | 발송 시각 |
| sender_operator_id | uuid fk → operators.id | 발신자 (로그인 운영자) |
| recipient_email | text | 수신자 (학교담당자 이메일) |
| recipient_name | text nullable | 학교담당자 이름 (있다면) |
| customer_names | text[] | 포함된 거래처명 (중복 제거) |
| receivable_count | int | 메일에 포함된 청구 건수 |
| total_amount | numeric | 합계 청구금액 (KRW) |
| graph_message_id | text nullable | Graph sendMail 응답 ID (실패 시 null) |
| status | text | 'sent' / 'failed' |
| error_message | text nullable | 실패 시 에러 메시지 |
| created_at | timestamptz default now() | |

**RLS**: SELECT는 admin/member (viewer 제외), INSERT는 server action 내부에서 service_role 우회.

## 4. 환경 변수 (신규)

| 변수 | 용도 | 예시 |
|------|------|------|
| `MICROSOFT_MAIL_SENDER_USER_ID` | Graph `/users/{id}/sendMail` 의 mailbox 식별자 (UPN or objectId) | `noreply@folio.example.com` |
| `MAIL_COMPANY_NAME` | HTML 본문 회사명 고정 | `Folio` |
| `MAIL_REMINDER_THRESHOLD_DAYS` (optional) | 경과일수 기준 (기본 10) | `10` |

### Azure AD 설정 (수동, 코드 외)
- App에 **Application permission** `Mail.Send` 추가
- Admin consent 부여
- 발신 mailbox에 application access policy 적용 가능 (RBAC for Applications)

## 5. 파일 영향도

신규 (10 파일):
1. `supabase/migrations/20260511_receivables_mail_sends_table.sql` — 테이블 + 인덱스
2. `supabase/migrations/20260511b_receivables_mail_sends_rls.sql` — RLS 정책
3. `src/features/receivables/mail-schemas.ts` — zod (recipient, group, action input/output)
4. `src/features/receivables/mail-grouping.ts` — Excel row → 학교담당자별 그룹화 + 경과일수 필터
5. `src/features/receivables/mail-template.ts` — HTML 빌더 (escapeHtml/fmtDate/formatWon 헬퍼 포함)
6. `src/features/receivables/mail-queries.ts` — `previewReminderRecipients` (server-only): 대상 행 그룹화·미리보기 데이터 반환
7. `src/features/receivables/mail-actions.ts` — `sendReminderEmails` Server Action (admin only)
8. `src/lib/microsoft/sendmail.ts` — Graph sendMail wrapper
9. `src/components/receivables/SendRemindersModal.tsx` — 미리보기 모달 (담당자별 카드 + 전체/개별 체크박스 + 송신)
10. `src/components/receivables/SendRemindersButton.tsx` — 페이지 우측 상단 트리거 버튼

수정 (3~4 파일):
- `src/app/dashboard/receivables/page.tsx` — admin 분기 후 버튼 추가
- `src/features/auth/queries.ts` — `getCurrentOperator()` 활용 (기존, 변경 없을 가능성 ↑)
- `.env.example` — 신규 ENV
- `CLAUDE.md` — 환경변수 + 메일 발송 흐름 메모

테스트 (4~5 파일):
- `src/features/receivables/__tests__/mail-grouping.test.ts`
- `src/features/receivables/__tests__/mail-template.test.ts`
- `src/features/receivables/__tests__/mail-actions.test.ts` (mock Graph)
- `src/lib/microsoft/__tests__/sendmail.test.ts`
- `e2e/dashboard-receivables-mail.spec.ts` — admin 권한 + 모달 + dry-run

**합계 추정**: 17~20 파일 → **간략 설계 + planner 권장**. (HARD-GATE 정확 경계는 20+면 전체 설계지만, 단순 add 위주라 간략으로 충분 판단)

## 6. 검증 전략

- **단위 테스트**:
  - mail-grouping: 경과일수 필터, 같은 담당자 묶음, 잘못된 이메일 형식 제외
  - mail-template: HTML escape, 통화 포맷, 단일 vs 복수 거래처 텍스트
  - mail-actions: viewer/member 차단, admin 통과, Graph 401/429 처리
- **E2E**: admin 로그인 → 미수채권 페이지 → 발송 버튼 → 모달 → preview 표시 → (실제 발송 대신 dry-run 모드 검증)
- **수동 확인**: 스테이징 환경에서 본인 메일로 1통 실제 발송

## 7. 보안/안전장치

1. **중복 발송 방지**: 동일 (operator, recipient) 24h 내 발송 이력 있으면 모달에서 경고 표시 (블로킹은 아님)
2. **dry-run 모드**: ENV `MAIL_DRY_RUN=true` 시 실제 발송 대신 receivables_mail_sends에 `status='dry_run'` 기록만
3. **권한**: admin 외 호출 시 server action 단에서 즉시 거부 (`me.permission !== 'admin'`)
4. **이메일 검증**: zod email() 통과 못한 셀은 그룹에서 제외 (모달에 '이메일 형식 오류로 제외됨' 알림)
5. **rate limit**: Graph sendMail 1초 1통 정도로 throttle (수십 통 일괄 시 보호)

## 8. 후속 작업 (별도 PR)

- 자동 스케줄(매일 09:00 cron) 옵션 추가
- 권한을 admin → admin+member로 확대
- 발송 이력 페이지 (`/dashboard/receivables/mail-history`)
- 메일 템플릿 관리 UI (회사명/문구 편집)
- 발송 후 알림 (operator inbox/슬랙 webhook 등)
