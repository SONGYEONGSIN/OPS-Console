# GAS 미수채권 자동화 폐기 가이드

Google Apps Script로 운영하던 미수채권 자동화 시스템을 OPS-Console로 이전 완료한 후 GAS를 안전하게 폐기하는 단계별 가이드.

## 배경

이전에는 GAS 단일 스크립트(`미수채권 자동 메일링 시스템`)가 다음 5 기능을 담당:

1. 운영자용 미수채권 알림 (Gmail) — 평일 10시
2. 학교담당자용 세금계산서 확인 메일 (Outlook Graph) — 평일 10시
3. 입금 내역 자동 매칭 (Excel ↔ Excel) — 매시간
4. 입금완료 버튼 (GAS Web App `doGet`) — 운영자 메일 속 수동 클릭
5. 입금완료 시 K열 적요 업데이트

OPS-Console로 4-PR 시리즈를 거쳐 모두 이전 + 일부 단순화:

| 기능 | OPS-Console 위치 | 상태 |
|---|---|---|
| ① 운영자 알림 | `receivables-mail-operator` (PR #229) | 신규 |
| ② 학교담당자 메일 | `receivables/mail-actions.ts` (이미 있음) | 기존 |
| ③ 입금 매칭 | `receivables-deposit-match` (PR #230) | 신규 |
| ④ 입금완료 버튼 | **폐기** (PR #231) | 자동 매칭으로 대체 |
| ⑤ K열 업데이트 | 입금 매칭이 자동 처리 | 자동화 |

## 폐기 전 사전 조건 (반드시 모두 충족)

다음 조건이 모두 완료된 후에 GAS 폐기를 진행한다.

- [ ] PR #229 (운영자 알림) main 머지 + Supabase 마이그 apply
- [ ] Vercel env: `MAIL_DRY_RUN=true` 초기 → 1주 dry-run 운영 후 `false` 전환
- [ ] PR #229 평일 10시 cron 1주 운영 — `receivables_operator_mail_sends`에 실 sent 이력 적재 확인
- [ ] PR #230 (입금 매칭) main 머지 + 마이그 + `SHAREPOINT_DEPOSIT_ITEM_ID` 설정
- [ ] PR #230 dry-run 1주 운영 → `receivables_match_runs` payload를 GAS 결과와 수동 비교 → ≥ 95% 일치 확인
- [ ] `MAIL_MATCH_DRY_RUN=false` 전환 → 매시간 cron 1주 안정 운영
- [ ] PR #231 (메일 버튼 제거) 머지 — 새 메일에는 액션 버튼 없음

## 폐기 단계

### 1. GAS 트리거 비활성 (5 분)

Google Apps Script 콘솔 (`https://script.google.com/`) 접속 → 대상 프로젝트 선택.

**트리거 메뉴 (🕒 좌측 사이드바)**:

| 트리거 함수 | 빈도 | 처리 |
|---|---|---|
| `sendAllInvoicesMail` | 평일 10시 | **삭제** |
| `autoMatchDeposits` | 매시간 | **삭제** |
| `createWeekday10amTriggers` 호출 결과 | — | 위 두 트리거가 이걸로 생성됐을 가능성 — 모두 일괄 삭제 |
| `createSingleAutoMatchTrigger` 호출 결과 | — | 동일 |

> ⚠️ **삭제 순서**: PR #230 (입금 매칭) 머지 직후 `autoMatchDeposits` 트리거를 **즉시 삭제**. K열 race 회피.
> 그 다음 PR #229 머지 직후 `sendAllInvoicesMail` 트리거 삭제.

### 2. GAS Web App 비활성 (3 분)

`doGet` 함수가 운영자 메일 속 "입금완료" 버튼 클릭을 처리하던 Web App:

- PR #231 머지 후 새 메일에는 버튼 없음
- 기존 발송된 메일에 남은 링크는 계속 GAS Web App을 호출할 수 있음
- 다음 중 하나로 차단:

**옵션 A — Web App 배포 회수 (권장)**:
- 배포 메뉴 → 배포 관리 → 현재 배포 선택 → 새 배포 만들기에서 "사용자 액세스 권한" → "본인만"으로 변경
- 결과: 다른 사용자 클릭 시 "Sorry, the file you have requested does not exist" 응답

**옵션 B — `doGet` 함수 폐기 안내로 교체**:
```js
function doGet(e) {
  return ContentService
    .createTextOutput("이 기능은 OPS-Console로 이전되어 폐기되었습니다. https://ops-console.example.com/dashboard/receivables")
    .setMimeType(ContentService.MimeType.TEXT);
}
```
배포 갱신 후 적용. 사용자에게 안내 페이지로 noise 없는 차단.

### 3. Refresh Token 회수 (2 분)

GAS가 Microsoft Graph용으로 보유한 refresh token:

- Script Properties → `REFRESH_TOKEN` 키 삭제
- Azure AD 콘솔 → 앱 등록 → `OPS-Console-GAS` (또는 동일 client_id) → 인증서 및 비밀번호에서 보유 token revoke (선택 — token expiry 자연 만료도 OK)

### 4. 코드 백업 + 폐기 (10 분)

GAS 스크립트 자체는 보존 가치 있으므로 폐기 전 백업:

```bash
# 로컬에 archive
gh repo clone google-apps-script-archive  # 또는 적당한 사설 저장소
mkdir -p deprecated/gas-receivables-2026/
# GAS 콘솔에서 전체 코드 복사 → deprecated/gas-receivables-2026/code.gs 로 저장
# README.md에 폐기 시점·이전 PR 번호·OPS-Console 신규 위치 명시
git commit -m "archive: GAS 미수채권 자동화 (2026-05 OPS-Console 이전)"
git push
```

원본 GAS 프로젝트는 **이름 prefix를 `[ARCHIVED]`로 변경** + 공유 권한 read-only 회수. 직접 삭제는 권하지 않음 (이력 추적).

### 5. 운영팀 안내 (필수)

다음 채널로 폐기 사실 공지:

- Slack 운영 채널: "오늘부로 GAS 미수채권 자동화 폐기. 모든 기능은 OPS-Console로 이전됨. 메일 속 '입금완료' 버튼은 더 이상 없으며, 입금이 확인되면 자동화(매시간)가 K열을 자동 표기. 문의는 송영신."
- 운영 매뉴얼 갱신 (`SHAREPOINT_MANUAL_ITEM_ID` 폴더)
- 다음 평일 10시 cron 실행 후 운영자 메일 수신 정상 확인

## 신규 환경변수 체크리스트

OPS-Console 운영을 위해 다음 env가 **Vercel + GitHub Actions Secrets** 양쪽에 설정되어야 함.

| 변수 | 위치 | 값 | 비고 |
|---|---|---|---|
| `CRON_SECRET` | Vercel + GH Secrets | strong random string | cron API trigger 인증 |
| `OPS_CONSOLE_BASE_URL` | GH Secrets | 배포 URL | mjs trigger가 호출 |
| `SHAREPOINT_DEPOSIT_ITEM_ID` | Vercel | Graph driveItem ID | 운영팀과 조율 |
| `MAIL_DRY_RUN` | Vercel | `false` (운영) | 운영자 알림 메일 |
| `MAIL_MATCH_DRY_RUN` | Vercel | `false` (운영) | 입금 매칭 PATCH |
| `MAIL_REMINDER_THRESHOLD_DAYS` | Vercel | `10` (기본) | 운영자 알림 경과일수 |

`.env.example` 참고. 신규 변수는 PR #229·#230에서 추가.

## 롤백 시나리오

OPS-Console 자동화에 심각한 회귀가 발견되면:

1. **즉시 GAS 트리거 재활성**:
   - Google Apps Script 콘솔 → 트리거 추가 → `sendAllInvoicesMail` (평일 10시) + `autoMatchDeposits` (매시간)
   - GAS는 폐기 전 백업되어 있으므로 코드 복원 가능
2. **OPS-Console cron 비활성**:
   - `.github/workflows/receivables-mail-operator.yml` + `.github/workflows/receivables-deposit-match.yml`의 `schedule:` 섹션 주석 처리 → 머지
   - 또는 GitHub Actions UI에서 workflow disable
3. **회귀 분석 + 핫픽스 → 재머지 → cron 재활성**

## FAQ

**Q. 운영자 메일에서 입금완료 버튼이 없어졌는데, 운영자가 직접 적요를 표기하고 싶다면?**
A. 자동 매칭(매시간)이 실패한 경우만 수동 처리 필요. 그 케이스는 admin(`ys1114@jinhakapply.com`)이 mismatch 알림 메일로 받음. 운영자가 직접 적요를 바꾸려면 SharePoint Excel에서 K열 셀 편집 (기존 방식).

**Q. 매칭이 GAS와 미세하게 다른 결과를 낸다면?**
A. 1:1 포팅했지만 fixture 케이스 외 edge가 있을 수 있음. `receivables_match_runs` 테이블 payload(jsonb)에 raw matched/mismatch가 저장됨 — GAS 로그와 비교 후 fixture 추가 + 코드 수정.

**Q. GAS의 `notifyAmountMismatch_` 메일 형식이 그리워요.**
A. `mismatch-mail.ts`가 동일 톤으로 admin에게 발송. 차이점: 발신자가 GAS 본인 계정 → OPS-Console Azure AD Application 발신.

## 관련 PR

- [#229 PR-1 운영자 알림](https://github.com/SONGYEONGSIN/OPS-Console/pull/229)
- [#230 PR-2 입금 매칭](https://github.com/SONGYEONGSIN/OPS-Console/pull/230)
- [#231 PR-3 메일 버튼 제거](https://github.com/SONGYEONGSIN/OPS-Console/pull/231)
- 본 가이드: PR-4 (GAS 폐기)
