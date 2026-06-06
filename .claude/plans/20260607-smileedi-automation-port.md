# 설계 문서 — SmileEDI 세금계산서 스크래핑+조건부 메일 파이프라인 OPS-Console 이식

- 작성: 2026-06-07 / Planner
- HARD-GATE: **전체 설계** (20+ 파일급, DB 스키마 + 외부 워크플로 + 시크릿 외부화 + 메일 발송 = 복잡도 보정 상향)
- 전제 문서: `.claude/memory/brainstorms/20260607-044424-smileedi-automation-port.md` (결정 업데이트 1·2 포함, 변경 금지)
- 격리 권장: `git worktree add ../OPS-Console-feat-smileedi feat/smileedi-automation` (`/worktree`)

---

## 1. 설계 문서

- **목표**: standalone Python(특정 PC 의존) SmileEDI 파이프라인을 OPS-Console 자동화 체계로 이식.
  - (1) 스크래핑: 로그인→검색→암호화 Excel 다운로드→복호→SharePoint 업로드 (GH Actions에서 기존 Python 재사용)
  - (2) 메일: SharePoint Excel 분석→4조건 필터→담당자 매핑 그룹핑→Graph 본인메일박스 발송→이메일오류 컬럼 갱신→이력 (OPS 서버 잡)
  - (3) 가시성: `/dashboard/automations`에서 상태·수동 트리거·이력 일원화

- **제약**:
  - 기술: Next.js 서버리스 런타임에서 헤드리스 브라우저 구동 불가 → 스크래핑은 GH Actions 필수. 암호 xlsx 복호(msoffcrypto)·로그인 팝업은 검증된 Python에 의존.
  - 비즈니스: SmileEDI 자격증명·Excel 비번·SMTP 비번이 `Tax_invoice.py`에 **하드코딩**(os.getenv 기본값). 전부 외부화 + Git 노출 차단 + 로테이션 필수.
  - 코드베이스: 자동화 패턴 = `registry.ts` 1줄 + `jobs/{id}.ts` 1모듈, cron은 cron-job.org → `/api/automations/run`(Bearer CRON_SECRET). 메일 파트는 이 패턴과 1:1.
  - **인증 모델 차이(핵심 리스크)**: 기존 OPS는 SharePoint를 **client_credentials(앱 권한, `getGraphToken`)**으로 접근. 반면 `Tax_invoice.py`는 **delegated OAuth(`Files.ReadWrite.All`, refresh_token.txt 대화형 인증)** 사용 → GH Actions 무인 환경에서 대화형 인증 불가. 결정: 메일 잡(Phase 1)은 **OPS의 client_credentials 경로 그대로 재사용**(SharePoint Excel read/PATCH), Python 스크래퍼(Phase 2)의 SharePoint 업로드만 client_credentials(`client_secret` flow)로 전환하거나, 업로드 대상 drive/item을 OPS와 동일 앱 권한 범위로 맞춘다.

- **접근 방식 A (선택, 하이브리드 2단계 분리)**: 스크래핑은 GH Actions에서 Python/Selenium 재사용, 메일/상태갱신/이력은 신규 OPS 잡 `smileedi-mail`.
  - 장점: 검증된 스크래퍼 재작성 리스크 0 / 메일 파트는 기존 OPS 패턴(`service-notice-mail`, `receivables-mail-school`)과 정확히 매핑 / 단계 분리로 점진 검증 / Phase 1 단독으로 즉시 가치(이미 SharePoint에 있는 Excel만으로 동작).
  - 단점: 런타임 2개(GH Actions + OPS)로 분산 / 스크래퍼는 외부 DOM 의존이라 깨짐 리스크 잔존.
- **접근 방식 B (기각)**: 스크래퍼를 TS+Playwright 전면 재작성.
  - 장점: 단일 언어 / 단일 런타임 가능성.
  - 단점: msoffcrypto 복호·로그인 팝업·암호 xlsx 다운로드를 TS로 재현하는 비용/리스크가 단일언어 이득 초과. 외부 의존이라 "재작성"보다 "검증본 격리 실행"이 합리적.
- **선택: A** — 이유: 스크래퍼는 동작하는 자산이고 메일 절반은 OPS 패턴에 그대로 흡수된다. 단계 분리가 검증·롤백 단위를 명확히 한다. (brainstorm 추천과 일치)

- **검증 전략**:
  - Phase 1: 회계연도 date util + 4조건 필터 + 담당자 매핑 규칙은 **Vitest 단위 테스트**(TZ=Asia/Seoul). dry-run 모드 잡 실행으로 이력 `status='dry_run'` 적재 확인 → 실발송 1건 검증 후 운영 전환.
  - Phase 2: `workflow_dispatch` 수동 실행으로 스크래핑→SharePoint 업로드→체이닝 호출까지 GH Actions 로그로 확인. dry-run 메일 잡과 연결해 end-to-end 무발송 검증.
  - 공통: `npm run lint && npm run typecheck && npm test` 통과 + `git grep`으로 하드코딩 자격증명 0건 확인.

---

## 2. 데이터 흐름 (확정)

```
[cron-job.org]
   │ POST /repos/SONGYEONGSIN/OPS-Console/actions/workflows/smileedi-scrape.yml/dispatches
   │ (Bearer GitHub PAT, body {"ref":"main"})
   ▼
[GH Actions: smileedi-scrape.yml]   ← Phase 2
   │ setup-python + Chrome
   │ Tax_invoice.py: 로그인→검색(동적 회계연도)→암호 xlsx 다운로드→복호→SharePoint 업로드
   │ 마지막 스텝:
   │   curl -X POST "$OPS_CONSOLE_BASE_URL/api/automations/run?jobId=smileedi-mail" \
   │        -H "Authorization: Bearer $CRON_SECRET"
   ▼
[OPS: /api/automations/run?jobId=smileedi-mail]  ← Phase 1
   │ enabled gate → job.run()
   ▼
[smileedi-mail job]
   1. SharePoint Excel read (client_credentials, header=row3) → 행 파싱
   2. 4조건 AND 필터 (거래처명≠공백 ∧ 공급가액≠0 ∧ 이메일오류≠'Y' ∧ 승인번호≠공백)
   3. 담당자 매핑 규칙 → (담당 operator)별 그룹핑
   4. Graph sendMail({senderUserId: operator UPN}) 본인메일박스 발송, 브랜드 [운영부 상황실]
   5. 발송 성공 행 '이메일오류' 컬럼 = 'Y' PATCH (재발송 방지)
   6. 이력 테이블 적재 (smileedi_mail_sends)
```

---

## Phase 1 — `smileedi-mail` OPS 서버 잡 (선행, 저위험)

### 2.1 영향 파일 (Phase 1)

| 파일 | 변경 | 설명 |
| ---- | ---- | ---- |
| `src/features/smileedi/types.ts` | 신규 | `SmileEdiRow` / `SmileEdiGroup` / 발송 결과 타입 |
| `src/features/smileedi/fiscal-year.ts` | 신규 | 회계연도 4/01~익년 3/31 동적 산출 (단위테스트 대상) |
| `src/features/smileedi/__tests__/fiscal-year.test.ts` | 신규 | RED: 4월·3월·경계 케이스 |
| `src/features/smileedi/queries.ts` | 신규 | SharePoint SmileEDI Excel read (header=row3) → 행 파싱 |
| `src/features/smileedi/filter.ts` | 신규 | 4조건 AND 필터 (순수 함수, 단위테스트 대상) |
| `src/features/smileedi/__tests__/filter.test.ts` | 신규 | RED: 각 조건 단독 탈락 + 전체 통과 |
| `src/features/smileedi/manager-rules.ts` | 신규 | 거래처명/담당부서/품목 → 담당 operator 매핑 규칙 (순수 함수, env 주입) |
| `src/features/smileedi/__tests__/manager-rules.test.ts` | 신규 | RED: 조가현 최우선 / 연세대 분기 / 폴백 |
| `src/features/smileedi/grouping.ts` | 신규 | 필터 결과 → 담당 operator별 그룹핑 (service-notice/grouping.ts 패턴) |
| `src/features/smileedi/__tests__/grouping.test.ts` | 신규 | RED: 동일 담당자 통합 / 미매핑 제외 |
| `src/features/smileedi/mail-template.ts` | 신규 | 제목/HTML 빌더 — 브랜드 [운영부 상황실] (service-notice/mail-template 패턴) |
| `src/features/smileedi/sheet-write.ts` | 신규 | '이메일오류'='Y' 단일 컬럼 PATCH (receivables/sheet-write.ts 재사용 또는 래핑) |
| `src/features/smileedi/mail-actions.ts` | 신규 | 그룹 배열 → 발송 + 이력 + 이메일오류 PATCH (school-mail-actions.ts 패턴) |
| `src/features/automations/jobs/smileedi-mail.ts` | 신규 | `runSmileEdiMail` — read→filter→group→send→PATCH→결과 |
| `src/features/automations/registry.ts` | 수정 | import 1줄 + `AUTOMATION_JOBS` 항목 1개 |
| `supabase/migrations/20260617_smileedi_mail_sends_table.sql` | 신규 | 이력 테이블 |
| `supabase/migrations/20260617b_smileedi_mail_sends_rls.sql` | 신규 | RLS + GRANT |
| `src/app/dashboard/settings/_env.ts` | 수정 | SmileEDI SharePoint drive/item id 스냅샷 노출 (preview/boolean) |
| `.env.example` 또는 운영 env 문서 | 수정 | OPS env 키 추가 (시크릿 아님: drive/item id, 담당자 매핑) |

신규 13 + 수정 3 ≈ 16 파일 (테스트 4 포함). registry 노출은 1줄이므로 dashboard 코드 무변경(자동 노출).

### 2.2 이력 테이블 스키마 초안 — `smileedi_mail_sends`

`service_notice_mail_sends` / `receivables_mail_sends` 패턴 차용. RLS: select admin/member, write service_role only.

```sql
create table if not exists public.smileedi_mail_sends (
  id                uuid primary key default uuid_generate_v4(),
  sent_at           timestamptz not null default now(),
  fiscal_year_start text not null,                 -- 'YYYYMMDD' (검색 시작일, 재현용)
  sender_email      text not null,                 -- 발신 operator 본인 메일
  sender_operator_id uuid,                          -- operators.id (nullable, 매핑 실패 허용)
  recipient_email   text not null,                 -- 담당자(= sender 본인 메일박스로 자기수신)
  recipient_name    text,
  company_names     text[] not null default '{}',  -- 포함된 거래처명
  invoice_count     int not null default 0,        -- 발송 포함 세금계산서 건수
  total_supply_amount bigint not null default 0,   -- 공급가액 합계
  graph_message_id  text,
  status            text not null check (status in ('sent','failed','dry_run')),
  error_message     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index smileedi_mail_sends_sent_at_desc_idx on public.smileedi_mail_sends (sent_at desc);
```

> **Idempotency 결정 필요(열린 질문 Q3)**: service-notice는 `target_month` 월 단위 중복 방지를 쓴다. SmileEDI는 발송 성공 즉시 '이메일오류'='Y' PATCH가 재발송을 막으므로 **시트 컬럼 갱신이 1차 idempotency**. 이력 테이블은 감사 로그 역할. cron 재실행 시 이미 'Y'인 행은 4조건 필터에서 자동 탈락 → 중복 발송 없음. 따라서 별도 월 단위 idempotency 불필요(단, PATCH 실패 시 재발송 가능 → 운영 메모 필요).

### 2.3 태스크 분해 (Phase 1)

#### T1: 회계연도 date util 테스트 작성 (RED) (3분)
- **파일**: `src/features/smileedi/__tests__/fiscal-year.test.ts`
- **변경**: `fiscalYearRangeKST(now)` 가 (a)2026-04-15→start 20260401/end 20270331 (b)2026-02-10→20250401/20260331 (c)3/31·4/1 경계를 반환하도록 실패 테스트 작성.
- **검증**: `npm test fiscal-year` 실행 → import 실패로 RED 확인.
- **의존**: 없음

#### T2: 회계연도 date util 구현 (GREEN) (3분)
- **파일**: `src/features/smileedi/fiscal-year.ts`
- **변경**: KST 기준 월 판정 → `{ startYmd, endYmd }`('YYYYMMDD'). 하드코딩(20250301~20260228) 제거 근거. `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul'})` 패턴(school-mail-actions `todayKstYmd` 참조).
- **검증**: `npm test fiscal-year` GREEN.
- **의존**: T1

#### T3: SmileEDI 도메인 타입 정의 (2분)
- **파일**: `src/features/smileedi/types.ts`
- **변경**: `SmileEdiRow`(작성일자/품목/공급가액/세액/거래처명/담당부서-공급받는자/담당자명-공급자/승인번호/이메일오류/excelRow), `SmileEdiGroup`(operator + rows), 발송 결과 타입.
- **검증**: `npm run typecheck`.
- **의존**: 없음

#### T4: 4조건 필터 테스트 작성 (RED) (3분)
- **파일**: `src/features/smileedi/__tests__/filter.test.ts`
- **변경**: 거래처명 공백/공급가액 0/이메일오류 'Y'/승인번호 공백 각각 단독 탈락 + 4조건 모두 충족 통과를 검증하는 실패 테스트.
- **검증**: `npm test filter` RED.
- **의존**: T3

#### T5: 4조건 필터 구현 (GREEN) (3분)
- **파일**: `src/features/smileedi/filter.ts`
- **변경**: `filterSendable(rows): SmileEdiRow[]` — `Tax_invoice.py` `filter_data_by_conditions` 4조건 AND. (Python의 품목키워드 필터는 brainstorm 확정 4조건에 없으므로 제외 — 열린 질문 Q1).
- **검증**: `npm test filter` GREEN.
- **의존**: T4

#### T6: 담당자 매핑 규칙 테스트 작성 (RED) (4분)
- **파일**: `src/features/smileedi/__tests__/manager-rules.test.ts`
- **변경**: `get_manager_by_rules` 규칙 포팅 — 조가현 최우선 / (학)연세대학교+품목 강사·채용→김유정 / 재무부·국제학대학원·고위정책→윤지혜 / 언더우드→송영신 / 서강대→박시현 / 덕성여대→김슬기 / 미래캠퍼스→김유정 / 폴백. 담당자명→operator email/UPN은 env 매핑으로 주입(하드코딩 금지).
- **검증**: `npm test manager-rules` RED.
- **의존**: T3

#### T7: 담당자 매핑 규칙 구현 (GREEN) (5분)
- **파일**: `src/features/smileedi/manager-rules.ts`
- **변경**: 순수 함수 `resolveManager(row, mappingConfig)`. mappingConfig는 env(`SMILEEDI_COMPANY_MANAGER_MAP`, `SMILEEDI_MANAGER_EMAIL_MAP`)에서 파싱한 결과를 주입받음(파일 시스템 접근 X). 미설정 시 즉시 실패(폴백 금지 — donts.md).
- **검증**: `npm test manager-rules` GREEN.
- **의존**: T6

#### T8: 그룹핑 테스트+구현 (RED→GREEN) (4분)
- **파일**: `src/features/smileedi/grouping.ts` + `__tests__/grouping.test.ts`
- **변경**: `groupByManager(rows, mappingConfig): SmileEdiGroup[]` — 동일 담당자 통합, 미매핑 행 제외(excluded 반환). `service-notice/grouping.ts` 구조 차용.
- **검증**: `npm test grouping` RED→GREEN.
- **의존**: T5, T7

#### T9: SharePoint SmileEDI Excel read 쿼리 (5분)
- **파일**: `src/features/smileedi/queries.ts`
- **변경**: `fetchSmileEdiSheet()` — `receivables/queries.ts` `fetchReceivablesSheet` 패턴. 단, **header=row3**(Python `pd.read_excel(header=2)`) 고정 + env `SHAREPOINT_SMILEEDI_DRIVE_ID`/`SHAREPOINT_SMILEEDI_ITEM_ID` 누락 시 null. `getWorkbookSession` 재사용. excelRow(1-based) 보존.
- **검증**: 단위테스트는 Graph 호출 모킹 곤란 → 타입·미설정 분기만 테스트, 실연결은 dry-run 잡 실행으로 검증(T13).
- **의존**: T3

#### T10: 이메일오류 컬럼 PATCH 헬퍼 (3분)
- **파일**: `src/features/smileedi/sheet-write.ts`
- **변경**: `markEmailErrorY(sheet, rowNumbers)` — `receivables/sheet-write.ts` `patchSingleColumn` 재사용(env만 SMILEEDI_* 분기) 또는 colIdx/value='Y' 래핑. 토큰·세션 1회 발급 + 504 retry 패턴 유지.
- **검증**: `npm run typecheck`. 실 PATCH는 T13 dry-run 이후 실발송 검증.
- **의존**: T9

#### T11: 메일 템플릿 (3분)
- **파일**: `src/features/smileedi/mail-template.ts`
- **변경**: `buildSubject()` / `buildHtml(group)` — 브랜드 [운영부 상황실], 표 형태(작성일자/품목/공급가액/세액/거래처명/담당부서). 하드코딩 색상 금지(토큰/Tailwind 인라인 불가 → 메일 HTML은 인라인 스타일 허용 영역, 기존 mail-template 패턴 따름).
- **검증**: `npm run typecheck` + 스냅샷성 단위테스트(제목·핵심 행 포함).
- **의존**: T3

#### T12: mail-actions (발송+이력+PATCH) (5분)
- **파일**: `src/features/smileedi/mail-actions.ts`
- **변경**: `sendSmileEdiMails(groups, sheet, {dryRun})` — `school-mail-actions.ts` 구조 차용. dryRun=true → Graph 호출 없이 `status='dry_run'` 이력만. 실발송: `sendGraphMail({senderUserId: 담당 operator UPN})`, 성공 행 수집 → `markEmailErrorY` PATCH, 이력 insert(admin client). 1초 sleep 간격.
- **검증**: `npm run typecheck`. 발송 분기 단위테스트(sendGraphMail 모킹).
- **의존**: T8, T10, T11

#### T13: 잡 모듈 + registry 등록 (4분)
- **파일**: `src/features/automations/jobs/smileedi-mail.ts` + `registry.ts`
- **변경**: `runSmileEdiMail()` — fiscalYearRange 로그 → fetchSmileEdiSheet(null이면 ok:false 명확 메시지) → filter → group → sendSmileEdiMails → `AutomationRunResult`(details: groups/sent/failed/dryRun). registry에 `{ id:"smileedi-mail", label:"SmileEDI 세금계산서 알림", description, scheduleInfo, cooldownMinutes:60, run }` 1항목 추가.
- **검증**: `MAIL_DRY_RUN=true`로 `/dashboard/automations`에서 '지금 실행' → dry-run 이력 적재 확인. 등록은 dashboard 자동 노출(page.tsx가 registry 기반).
- **의존**: T12, T2

#### T14: 이력 테이블 마이그레이션 (4분)
- **파일**: `supabase/migrations/20260617_smileedi_mail_sends_table.sql` + `20260617b_..._rls.sql`
- **변경**: 위 2.2 스키마. RLS select admin/member, GRANT select authenticated / all service_role, `set_updated_at` 트리거. `service_notice_mail_sends` 마이그 그대로 차용.
- **검증**: DB 적용(`db-migration-apply` 메모리 참조: DATABASE_URL 풀러 + `pg --no-save`) 후 `\d` 컬럼·정책 확인, RLS로 authenticated insert 차단 확인.
- **의존**: 없음 (병렬 가능)

#### T15: env 스냅샷 + 문서 노출 (3분)
- **파일**: `src/app/dashboard/settings/_env.ts` + 운영 env 문서
- **변경**: `_env.ts` sharepoint 블록에 `smileediDriveId`/`smileediItemId` preview·configured 추가(`EnvSnapshot` 타입 확장). 시크릿(매핑은 비밀 아님)은 일반 preview, 담당자 매핑 env는 문서에만 기재.
- **검증**: `npm run typecheck` + settings 페이지 렌더 확인.
- **의존**: 없음

### 2.4 Phase 1 위험 / 롤백

| 위험 | 영향 | 완화 / 롤백 |
| ---- | ---- | ---- |
| 인증 모델 차이 (client_credentials가 SmileEDI drive/item 접근 권한 없음) | read/PATCH 401 | 사전: 해당 SharePoint drive에 OPS Azure App(앱 권한) 접근 확인. 안 되면 Q2(아래) 결정 필요 |
| 헤더 행 위치(row3) 가정 깨짐 | 파싱 오류 | header=row3 고정, 미스매치 시 ok:false 명확 메시지(폴백 금지) |
| 담당자 매핑 누락 거래처 | 미발송 | grouping excluded 카운트를 결과 details에 노출, dry-run으로 사전 확인 |
| 이메일오류 PATCH 실패 → 재발송 | 중복 메일 | PATCH 실패를 이력 error로 남기고 결과 ok:false 처리, 운영 알림 |
| 롤백 | — | registry 1줄 제거 시 즉시 비활성. 마이그는 테이블 drop. cron 미연결 상태로 머지 가능(Phase 2 전까지 수동 트리거만) |

---

## Phase 2 — `smileedi-scrape.yml` 워크플로 (스크래핑, GH Actions)

### 3.1 영향 파일 (Phase 2)

| 파일 | 변경 | 설명 |
| ---- | ---- | ---- |
| `.github/workflows/smileedi-scrape.yml` | 신규 | workflow_dispatch + setup-python + Chrome → Tax_invoice.py → 체이닝 |
| `docs/SmileEdi/Tax_invoice.py` | 수정 | 하드코딩 자격증명 기본값 제거(미설정 시 즉시 실패) + 동적 회계연도 + SMTP/메일 발송 코드 제거(메일은 OPS 잡으로 이관) + SharePoint 인증 무인화 |
| `docs/SmileEdi/requirements.txt` | 확인/수정 | selenium/msoffcrypto-tool/pandas/openpyxl/msal/requests 핀 |
| `.gitignore` | 수정 | `docs/SmileEdi/*.env`, `refresh_token.txt`, 다운로드 xlsx 차단 |
| `docs/smileedi-scrape-setup.md` | 신규 | cron-job.org → workflow_dispatch 연동 + 시크릿 설정 + 비번 로테이션 가이드 |
| (선택) `docs/SmileEdi/smileedi_config.env.example` | 신규 | 키 목록만(값 없음) |

신규 3~4 + 수정 3 ≈ 6~7 파일.

### 3.2 태스크 분해 (Phase 2)

#### T16: 하드코딩 자격증명 제거 패치 (5분)
- **파일**: `docs/SmileEdi/Tax_invoice.py` (`load_config`/`load_mail_config`)
- **변경**: `os.getenv('SMILEEDI_USERNAME','jinhakapply')` 등 **모든 기본값 인자 제거** → `os.environ['KEY']` 또는 미설정 시 `sys.exit(1)` with 명확 메시지. SMILEEDI/EXCEL/SMTP/매핑 전부.
- **검증**: env 미설정 상태 실행 → 즉시 실패 + `git grep -nE "jinhak0326|akfls"` 0건.
- **의존**: 없음

#### T17: 동적 회계연도 적용 (3분)
- **파일**: `docs/SmileEdi/Tax_invoice.py` (`load_config`)
- **변경**: `SEARCH_START_DATE`/`SEARCH_END_DATE` 하드코딩 제거 → Phase 1 `fiscal-year.ts`와 동일 규칙의 Python 산출(4/01~익년3/31, KST). env override 허용(테스트용).
- **검증**: 4월·2월 시스템 날짜 모킹(또는 인자) 실행 로그에서 검색일자 확인.
- **의존**: 없음

#### T18: SMTP/메일 발송 코드 제거 (4분)
- **파일**: `docs/SmileEdi/Tax_invoice.py` (`send_notification_email`/`_send_email_to_manager`/`analyze`/`filter`/`update_email_error*` 등 메일·필터 단계)
- **변경**: 스크래퍼는 **업로드까지만** 책임. 메일/필터/이메일오류 갱신은 OPS `smileedi-mail` 잡 담당이므로 해당 메서드 호출 제거(메서드 자체는 dead로 남기되 main 흐름에서 분리, 또는 삭제). SMTP import/시크릿 제거.
- **검증**: `python Tax_invoice.py` 로컬(또는 GH) 실행이 업로드 후 종료 + SMTP 미사용 확인.
- **의존**: 없음

#### T19: SharePoint 인증 무인화 (5분)
- **파일**: `docs/SmileEdi/Tax_invoice.py` (`get_sharepoint_access_token` 등)
- **변경**: 대화형 `input()` / `webbrowser.open` / refresh_token.txt 경로 제거 → **client_credentials**(client_id/secret/tenant, `scope=https://graph.microsoft.com/.default`) 무인 토큰. 업로드 대상은 OPS와 동일 drive(앱 권한 부여된 곳).
- **검증**: GH Actions에서 대화형 입력 없이 토큰 발급·업로드 성공 로그.
- **의존**: 없음. **열린 질문 Q2 선결 필요**(앱 권한 SharePoint 쓰기 가능 여부)

#### T20: 워크플로 작성 (5분)
- **파일**: `.github/workflows/smileedi-scrape.yml`
- **변경**: `on: workflow_dispatch`. steps: checkout → `setup-python@v5`(3.12) → Chrome 설치(`browser-actions/setup-chrome` 또는 ubuntu 기본) → `pip install -r docs/SmileEdi/requirements.txt` → `python docs/SmileEdi/Tax_invoice.py`(env: secrets 주입, HEADLESS_MODE=true) → 마지막 스텝 `curl -X POST "$OPS_CONSOLE_BASE_URL/api/automations/run?jobId=smileedi-mail" -H "Authorization: Bearer $CRON_SECRET"`. `insights-fetch.yml` 구조 차용.
- **검증**: Actions 탭 "Run workflow"(workflow_dispatch) → 로그로 로그인→업로드→체이닝 200 확인.
- **의존**: T16~T19, Phase 1 머지(smileedi-mail 잡 존재)

#### T21: .gitignore + 시크릿 노출 차단 (2분)
- **파일**: `.gitignore`
- **변경**: `docs/SmileEdi/*.env`, `docs/SmileEdi/refresh_token.txt`, `docs/SmileEdi/*.xlsx` 추가. 이미 커밋된 `docs/buseobogo.py`/`docs/SmileEdi/` 추적 상태 점검(git status에 `??`로 미추적 — 커밋 전 차단 필수).
- **검증**: `git status`에 .env/토큰/xlsx 미노출 + `git check-ignore` 확인.
- **의존**: 없음 (최우선 권장 — 머지 전 노출 방지)

#### T22: 연동·로테이션 문서 (4분)
- **파일**: `docs/smileedi-scrape-setup.md`
- **변경**: cron-job.org → `POST /repos/SONGYEONGSIN/OPS-Console/actions/workflows/smileedi-scrape.yml/dispatches`(Bearer GitHub PAT fine-grained Actions:write, body `{"ref":"main"}`) 설정. GH Actions Secrets 목록. **노출된 비번(jinhak0326/akfls12!!/akfls33!!) 즉시 로테이션 권장** 명시.
- **검증**: 문서 단독(검증=리뷰).
- **의존**: T20

### 3.3 Phase 2 위험 / 롤백

| 위험 | 영향 | 완화 / 롤백 |
| ---- | ---- | ---- |
| 이미 노출된 자격증명 Git 커밋 | 보안 사고 | **T21 최우선**. 머지 전 .gitignore + 히스토리 미포함 확인. 비번 로테이션 |
| SmileEDI DOM 변경 | 스크래퍼 깨짐 | 외부 의존 — 워크플로 실패 시 Actions 알림, 수동 fallback. Phase 분리로 메일 잡은 독립 동작 |
| client_credentials SharePoint 쓰기 권한 부재 (Q2) | 업로드 실패 | Phase 2 선결 조건. 불가 시 delegated 토큰을 GH Secret으로 사전 발급·갱신(차선) |
| Chrome/Selenium 버전 드리프트 | 런너 실패 | webdriver-manager 자동 관리 + 버전 핀 |
| 롤백 | — | 워크플로 파일 삭제 + cron-job.org 잡 비활성. Phase 1은 영향 없음 |

---

## 4. 시크릿 / 환경변수 목록

### GH Actions Secrets (Phase 2, 스크래퍼)
- `SMILEEDI_USERNAME`, `SMILEEDI_PASSWORD` — SmileEDI 로그인 (로테이션 권장)
- `EXCEL_DOWNLOAD_PASSWORD` — 암호 xlsx 복호 (로테이션 권장)
- `SHAREPOINT_TENANT_ID`, `SHAREPOINT_CLIENT_ID`, `SHAREPOINT_CLIENT_SECRET` — Graph 업로드(client_credentials)
- `SHAREPOINT_SITE_ID`, `SHAREPOINT_DRIVE_ID`, `UPLOAD_FOLDER_PATH` — 업로드 위치
- `OPS_CONSOLE_BASE_URL`, `CRON_SECRET` — 체이닝 호출 (insights-fetch.yml과 동일 secret 재사용)
- (cron-job.org 측 보관) `GITHUB_PAT` fine-grained Actions:write — workflow_dispatch 트리거

### OPS env (Phase 1, 메일 잡 — Vercel/서버)
- `SHAREPOINT_SMILEEDI_DRIVE_ID`, `SHAREPOINT_SMILEEDI_ITEM_ID` — 메일 잡이 읽을 Excel (시크릿 아님, preview 노출)
- `SMILEEDI_COMPANY_MANAGER_MAP` — 예 `(학)연세대학교:송영신,서강대학교:박시현,...` (담당자 결정)
- `SMILEEDI_MANAGER_EMAIL_MAP` — 예 `송영신:ys...@...,박시현:...` (담당자→발신 operator UPN)
- 재사용: `MAIL_DRY_RUN`(안전장치), `AZURE_AD_*`(getGraphToken), `SUPABASE_SERVICE_ROLE_KEY`(이력 insert)
- SMTP 키(`SMTP_*`, `ys1114@...` 비번) — **폐기**(Graph sendMail 전환)

---

## 5. 열린 질문 (사용자 확인 필요)

- **Q1 (품목키워드 필터)**: Python `filter_data_by_conditions`는 4조건 외에 품목키워드(`수수료,접수,강사,대입,인터넷`) AND 조건도 적용한다. brainstorm 확정 4조건에는 없음 → **품목키워드 필터는 제외**가 맞는가? 포함이면 5번째 조건으로 추가.
- **Q2 (SharePoint 앱 권한 쓰기)**: OPS의 client_credentials 토큰이 SmileEDI 업로드 drive에 read/PATCH(메일 잡) 및 write(스크래퍼 업로드) 가능한가? 불가 시 Phase 2 T19를 delegated 사전발급으로 변경.
- **Q3 (Idempotency)**: '이메일오류'='Y' PATCH만으로 재발송 방지 충분 vs 이력 테이블에 일자 단위 중복 가드 추가? (2.2 결정안: PATCH 1차 + 이력 감사 — 동의 여부)
- **Q4 (발신 operator UPN)**: cron 무인 실행 시 senderUserId를 매핑 결과 operator UPN으로 쓰는가, 아니면 단일 운영 계정(env)으로 고정하는가? brainstorm은 "설정 담당 operator UPN" — 매핑 email이 곧 발신자(자기수신 구조)인지 확인.
- **Q5 (repo owner)**: workflow_dispatch 경로가 `SONGYEONGSIN/OPS-Console`인지(brainstorm 표기) 실제 origin과 일치 확인.

---

## 6. 기존 패턴 정합성 근거 (구체 경로)

- 잡 구조: `src/features/automations/jobs/receivables-mail-school.ts` (read→group→send, dryRun, AutomationRunResult)
- 발송+이력+시트갱신: `src/features/receivables/school-mail-actions.ts` (sendGraphMail senderUserId, 이력 insert, patchSingleColumn으로 컬럼 기록)
- SharePoint Excel read: `src/features/receivables/queries.ts` (`fetchReceivablesSheet`, getWorkbookSession, header 감지, validColIdx)
- 컬럼 PATCH: `src/features/receivables/sheet-write.ts` (`patchSingleColumn`, 504 retry, columnLetter)
- 그룹핑: `src/features/service-notice/grouping.ts` (operator별 Map 묶기)
- 메일 도메인 타입: `src/features/service-notice/schemas.ts`
- 이력 마이그+RLS: `supabase/migrations/20260531b_service_notice_mail_sends.sql`
- cron 진입점: `src/app/api/automations/run/route.ts` (Bearer CRON_SECRET, enabled gate)
- registry 노출: `src/features/automations/registry.ts` 1줄 → `src/app/dashboard/automations/page.tsx`가 `getAutomationStatuses()`로 자동 렌더
- 워크플로(dispatch+체이닝): `.github/workflows/insights-fetch.yml`
- Graph sendMail: `src/lib/microsoft/sendmail.ts` (`sendGraphMail({senderUserId})`, 브랜드 로고 cid)
- 세션: `src/lib/microsoft/workbook-session.ts`
- env 스냅샷: `src/app/dashboard/settings/_env.ts`
- 원본 로직: `docs/SmileEdi/Tax_invoice.py` — filter L3447 / manager-rules L3794 / send L3916 / email-error update L3670

## 7. 구현 결정 (코드 검증 후 확정 — README와 불일치 바로잡음)
실제 Tax_invoice.py 코드 확인 결과 README의 4조건이 부정확했음. 사용자 확정:
- **필터 = 2조건** (브레인스토밍의 4조건 폐기): ①이메일오류≠'Y' ②품목키워드 매치(행 내 임의 컬럼에 `수수료/접수/강사/대입/인터넷` 중 하나 포함). 거래처명/공급가액/승인번호 조건은 실제 코드에 없으므로 구현 안 함.
- **담당자 미매핑 = 송영신 기본 폴백 유지**(env `SMILEEDI_DEFAULT_MANAGER`로 설정 가능) + "기본값으로 라우팅된 거래처"를 잡 결과 details에 리포트(신규 거래처 표면화). 제외 안 함.
- 컬럼명(header row3): 작성일자 / 품목 / 공급가액 / 세액 / 거래처명 / 담당부서-공급받는자 / 담당자명-공급자 / 승인번호 / 이메일오류.
- 매핑 규칙(get_manager_by_rules): 담당자명-공급자=="조가현"→조가현 최우선 → (학)연세대학교[품목 강사/채용→김유정 / 담당부서 재무부(자체)·국제학대학원·고위정책→윤지혜 / 언더우드국제학부→송영신 / else 송영신] → 서강대학교→박시현 → 덕성여자대학교→김슬기 → 연세대학교 미래캠퍼스→김유정 → else company_manager_map → 없으면 송영신.
