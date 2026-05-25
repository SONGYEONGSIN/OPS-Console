# Brainstorm: 미수채권 자동화 — Google Apps Script → OPS-Console 이전

## 의도

- **산출물**:
  - 운영자 본인용 미수채권 알림 메일 (평일 10시 자동 + 수동 트리거)
  - 입금 내역 자동 매칭 잡 (Excel ↔ Excel, 매시간 + 수동 트리거)
  - 입금완료 버튼 (receivables 페이지 inline action — GAS Web App 대체)
  - GitHub Actions schedule cron 2개 (`receivables-mail-operator`, `receivables-deposit-match`)
  - GAS 완전 폐기 (트리거 삭제 + Web App 비활성)
- **사용자**:
  - 운영부 admin (자동화 실행 메뉴에서 status 조회·수동 트리거)
  - 운영자 본인 (매일 10시 자기 미수 알림 메일 수신, 메일 내 "입금완료" 버튼 클릭)
- **트리거 (왜 지금)**: 운영 도구가 GAS·SharePoint·OPS-Console로 흩어져 있어 OPS-Console로 **단일 도구 통합**. 자동화 실행 메뉴가 이미 존재하지만 잡 1개(`insights-collect`)만 등록되어 있어 활용도 낮음
- **성공 기준**:
  - GAS 5 기능 모두 OPS-Console에서 동작 (메일 수신·매칭·완료 표시·실행 이력)
  - 자동화 실행 메뉴에서 마지막 실행 시각·결과·수동 트리거 가능
  - GAS 완전 폐기 후 메일 누락 0건 / K열 입금완료 표기 정상
  - 매칭 정확도 GAS 대비 동등 이상 (현재 GAS의 `notifyAmountMismatch_` 알림 빈도 ≤ GAS)

## 제약

### 기술
- **Microsoft Graph 인증**: OPS-Console은 Azure AD client_credentials grant (Application permission) → refresh token 관리 불필요. GAS의 OAuth flow 폐기 가능
- **Excel range PATCH**: 매칭 결과 J/K열 업데이트는 cell 단위 PATCH (Graph API). 대량 처리 시 throttling 주의
- **Timezone**: cron 실행 KST 기준 (이미 `insights-fetch.yml`이 한국 08:00 = UTC 23:00 패턴 사용 중)
- **시트 구조 의존**: GAS의 컬럼 매핑(B=청구일자/D=거래처명/...)을 OPS-Console parser에 동일 적용. 시트 변경 시 깨짐 — 운영팀과 동기화 필요
- **메일 발송 권한**: 운영자 본인 메일박스로 발송하려면 GAS의 운영자별 OAuth 토큰 대신 Graph `Mail.Send` Application permission 사용 (`sendMail` 엔드포인트에 sender 지정 가능, OPS-Console에 이미 패턴 있음)

### 비즈니스
- **GAS 잘 돌고 있음** — 절박한 트리거 아니므로 단계적 진행 가능, 단 마이그레이션 기간 중복 발송 방지 필수 (GAS 트리거 일시 비활성 ↔ OPS-Console 활성 시점 조율)
- **메일 수신자 영향**: 운영자 + 학교담당자 양쪽에 발송. 형식·송신자 변경 시 사용자 혼란 가능 → 기존 HTML 톤 유지
- **데이터 일관성**: K열 적요를 GAS와 OPS-Console 두 시스템이 동시에 쓰면 race condition. 한 번에 한 시스템만 쓰도록 보장

### 코드베이스
- ✅ **이미 있는 인프라**:
  - `src/features/receivables/mail-actions.ts` — 학교담당자용 메일 (GAS `sendSchoolInvoicesMail`와 동일 기능, 폐기 가능)
  - `src/features/automations/registry.ts` — 잡 추가 패턴 (1줄 + jobs/ 모듈 1개)
  - `src/app/dashboard/automations/AutomationHub` — 수동 실행·상태 조회 UI
  - `.github/workflows/insights-fetch.yml` — schedule cron 패턴
  - `src/lib/microsoft/sendmail.ts` + `auth.ts` — Graph sendMail + token 관리
- ❌ **신규 필요**:
  - 운영자 메일 템플릿 (`mail-template-operator.ts`)
  - 입금 매칭 모듈 (parser + 정규화 + Levenshtein 유사도 + N:1/N:M 합산)
  - 입금완료 server action (Excel K열 PATCH)
  - 자동화 잡 2개 + workflow yml 2개

## 대안 비교

| 항목 | A. 단계 분할 (PR 4개) | B. Big-bang 단일 PR | C. 부분 이전 (메일만) | Z. do nothing |
|------|----------------------|---------------------|---------------------|--------------|
| 비용 | 2~3주, PR 4개 | 5+일 집중, PR 1개 | 1주, PR 1개 | 0 (다만 GAS 토큰 관리 지속) |
| 위험 | 낮음 — 각 단계 검증·롤백 가능 | **높음** — 회귀 클러스터, 한꺼번에 다 끊김 가능 | 중간 — K열 두 시스템 동시 쓰기 위험 | 중간 — 도구 통합 가치 미실현 |
| 가역성 | 단계별 revert | PR 1개 revert는 가능하나 운영 데이터 dirty | revert는 가능 | (해당 없음) |
| 학습 효과 | 점진적, 각 단계 인사이트 누적 | 한 번에 완성, 중간 학습 없음 | 매칭 로직 학습 X | 0 |
| GAS와 충돌 | 단계마다 GAS 해당 부분 비활성 (정밀 제어) | OPS-Console 배포 직전 GAS 일괄 중단 | 메일만 충돌, 매칭은 GAS 그대로 | (해당 없음) |

## 추천 + 근거

### 추천: **대안 A — 단계 분할 (4 PR)**

**선택 근거**:
1. **위험 분산**: 매칭 로직(가장 복잡)은 별도 PR로 격리 — 운영자 메일 단순 작업으로 빠르게 가치 전달 후 검증 시간 확보
2. **GAS와 충돌 정밀 제어**: 각 PR 배포 직후 해당 GAS 트리거 비활성 (`createWeekday10amTriggers` 삭제 → OPS-Console 활성), 부분 마이그레이션 가능
3. **OPS-Console 인프라 잘 정립**: `automations` 메뉴 + GitHub Actions 패턴 + Graph sendMail 모두 있음 → 신규 잡 등록 비용 낮음. 단계별 추가가 자연스러움
4. **검증 가능**: PR-1(메일) 후 며칠 운영하며 회귀 확인 → PR-2(매칭)로 이동. 한 번에 다 가는 것보다 안전

### 단계 구성

| PR | 범위 | 파일 수 | GAS 폐기 항목 |
|---|---|---|---|
| **PR-1** | 운영자 미수채권 알림 + 자동화 잡 + workflow yml | ~6 (S) | `sendAllInvoicesMail` + 평일 10시 트리거 |
| **PR-2** | 입금 매칭 (parse + normalize + similarity + N:M) + 잡 + workflow | ~10 (L) | `autoMatchDeposits` + 매시간 트리거 + `notifyAmountMismatch_` |
| **PR-3** | 입금완료 버튼 (receivables 페이지 inline action) | ~3 (S) | `doGet` Web App + `markPaid_` |
| **PR-4** | GAS 트리거 일괄 삭제 + Web App 배포 회수 + 문서화 | 1~2 (S) | 전체 GAS 폐기 |

### 기각된 대안

**B. Big-bang**: 회귀 위험 너무 큼. 입금 매칭 로직은 정규화·유사도·N:M 합산 등 정밀 작업이라 격리 검증 필수. 한 PR로 묶으면 디버깅 어려움

**C. 부분 이전 (메일만)**: K열 적요를 GAS 매칭 + OPS-Console 입금완료 버튼이 동시에 쓰면 race. "전부 이전" 정책과 부합 안 함. 사용자가 "완전 폐기" 선택했으므로 부적합

**Z. do nothing**: 사용자 의도("OPS-Console로 단일 도구 통합")와 정면 배치. GAS refresh token 끊김 알림 메일이 코드에 박혀 있다는 사실 자체가 운영 부담 존재 증거

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260526-015532-receivables-automation-migration.md`
- 변경 규모 합계 ~20 files → **HARD-GATE 전체 등급** → `/plan` 또는 `planner` 에이전트 분석 필수
- 권장 후속: **`/plan from-brainstorm 20260526-015532-receivables-automation-migration.md`** 또는 PR-1만 직접 구현하면서 PR-2~4는 후속 brainstorm/plan
- PR-2(입금 매칭)는 별도 brainstorm 권장 — 정규화 알고리즘·유사도 threshold·N:M 매칭 정책 등 세부 결정 사항이 많음
