# Brainstorm: SmileEdi 세금계산서 스크래핑+조건부 메일 파이프라인 OPS-Console 자동화 이식

## 의도
- 산출물: SmileEDI 세금계산서 (1) 스크래핑(로그인→검색→암호화 Excel 다운로드→복호) (2) SharePoint 업로드 (3) Excel 분석→조건부 담당자 메일→이메일오류 상태 갱신 — 전 파이프라인을 OPS-Console 자동화 체계로 이식. 사용자 결정: 스크래핑까지 전체 자동화(GitHub Actions+브라우저 런너)
- 사용자: 운영부 admin. 현재는 누군가의 PC에서 Python 수동/스케줄 실행 → OPS-Console /dashboard/automations에서 상태 확인 + 수동 트리거, 평소엔 cron 자동
- 트리거: 지금 docs/SmileEdi가 standalone Python(특정 PC 의존)이라 운영 연속성·가시성 부재. OPS-Console 자동화로 들어오면 이력/모니터링/수동재실행 일원화
- 성공 기준: (1) 매일 스케줄로 스크래핑→SharePoint 적재 무인 동작 (2) 조건(거래처명≠공백 ∧ 공급가액≠0 ∧ 이메일오류≠Y ∧ 승인번호≠공백) 충족 건만 담당자 메일 발송, 발송 건수 이력 적재 (3) 이메일오류 컬럼 갱신 (4) MAIL_DRY_RUN 안전장치 (5) 특정 PC 의존 제거

## 제약
- 기술: **Next.js 서버리스/cron→/api/automations/run 런타임에서 헤드리스 브라우저(Selenium/Playwright) 구동 불가** → 스크래핑은 GitHub Actions(브라우저 가능) 등 별도 런너 필수. 암호화 xlsx 복호(현재 msoffcrypto-tool, Python)·로그인 팝업 처리가 까다로운 부분. SharePoint 업로드/Excel 분석/sendMail은 기존 lib/microsoft(Graph workbook-session + sendMail)로 커버
- 비즈니스: SmileEDI 자격증명·Excel 비밀번호 등 시크릿은 GitHub Actions Secrets로 관리(코드/Git 노출 금지). 사이트 DOM 변경 시 스크래퍼 깨짐 리스크(외부 의존)
- 코드베이스: 자동화 잡 패턴 = registry.ts 1줄 + jobs/{id}.ts 1모듈, cron은 .github/workflows + cron-job.org → /api/automations/run(Bearer CRON_SECRET). weekly-report 잡(SharePoint+Teams)·receivables-deposit-match(workbook PATCH)가 최근접 analog. 메일 파트는 이 패턴에 정확히 적합

## 대안 비교

| 항목 | 대안 A: 하이브리드 (Python 스크래퍼 GH Actions 재사용 + OPS 메일 잡) | 대안 B: 전면 TS/Playwright 재작성 + 메일 잡 | 대안 Z: do nothing (PC standalone 유지) |
| --- | --- | --- | --- |
| 핵심 | 검증된 Python/Selenium을 GH Actions(스케줄, Chrome) 그대로 실행→SharePoint 적재. 메일/상태갱신은 신규 OPS 잡 `smileedi-mail`(Graph) | 스크래퍼를 TS+Playwright로 재작성해 단일 언어. 메일도 OPS 잡 | 그대로 둠 |
| 비용 | 중상 (워크플로 + 메일 잡 + 시크릿 + 대시보드) — but 스크래퍼 재사용 | 상 (복호/로그인팝업/다운로드 TS 재구현) | 0 |
| 위험 | 낮음(스크래퍼 검증됨) / 중(메일 포팅) | 높음 (Playwright 복호·팝업·암호 xlsx 재현 리스크) | 높음 (PC 의존·가시성 0·연속성 위험 지속) |
| 가역성 | 높음 (단계 분리) | 중 | - |
| 학습효과 | OPS↔GH Actions 런너 분리 + 브라우저 작업 격리 패턴 정립 | TS 브라우저 자동화 스택 | - |

## 추천 + 근거
- **추천: 대안 A (하이브리드, 2단계 분리 구현)**
- 근거: (1) 스크래핑은 이미 동작하는 Python/Selenium이 자산 — GH Actions에서 Chrome+Python 그대로 돌리면 재작성 리스크 0. (2) 메일/상태갱신은 기존 OPS 자동화 패턴(workbook-session + sendMail + 이력)과 1:1 매핑이라 안전하게 신규 잡으로 흡수. (3) 단계 분리로 점진 검증 가능
  - **Phase 1 (선행, 저위험)**: `smileedi-mail` 잡 — 이미 SharePoint에 있는 Excel을 읽어 조건부 담당자 메일 + 이메일오류 갱신 + 이력. dry-run 우선. 즉시 가치
  - **Phase 2**: GH Actions 워크플로 — 스케줄로 Python 스크래퍼 실행(로그인→검색→복호→SharePoint 업로드), 말미에 /api/automations/run?job=smileedi-mail 체이닝(또는 별도 스케줄)
- **기각된 대안 B**: 복호(msoffcrypto)·로그인 팝업·암호 xlsx 다운로드를 TS로 재현하는 비용/리스크가 단일언어 이득을 초과. 스크래퍼가 자주 깨지는 외부 의존이라 "재작성"보다 "검증본 격리 실행"이 합리적. 향후 스크래퍼 안정화·전면 TS화 필요 시 B 전환
- **대안 Z 기각**: PC 의존·가시성 부재가 이식의 동기 자체

## 다음 단계
- 규모: GH Actions 워크플로 + jobs/smileedi-mail + registry + Excel 분석/조건 필터/매핑 + sendMail 템플릿 + 시크릿 문서 + 대시보드/이력 + 테스트 → **20+ 파일급, HARD-GATE 전체 설계**
- 권장: **planner 에이전트 분석 필수 → /plan 으로 Phase 1/2 분해**. Phase 1(메일 잡)부터 TDD 구현 권장. 시크릿(SMILEEDI_*, EXCEL_DOWNLOAD_PASSWORD, COMPANY/MANAGER 매핑)은 GH Actions Secrets + OPS env 스냅샷 노출 정책 확인

## 결정 업데이트 (트리거 배선 확정)
사용자 결정: 런타임 = **대안 A (GitHub Actions + 기존 Python/Selenium 재사용)**, 스케줄러 = **cron-job.org**.
- cron-job.org는 HTTP만 가능 → GitHub `workflow_dispatch` API를 호출해 워크플로 기동:
  `POST /repos/SONGYEONGSIN/OPS-Console/actions/workflows/smileedi-scrape.yml/dispatches` (Bearer GitHub PAT, body {"ref":"main"})
- 워크플로(smileedi-scrape.yml): setup-python + Chrome → 기존 Tax_invoice.py 실행(로그인→검색→복호→SharePoint 업로드) → 마지막 스텝에서 `/api/automations/run?jobId=smileedi-mail`(Bearer CRON_SECRET) 체이닝
- 메일 절반(smileedi-mail 서버 잡)은 기존 자동화 패턴 그대로
- **신규 시크릿**: GitHub PAT(fine-grained, Actions:write) → cron-job.org 헤더에 보관. (대안: 이 워크플로만 GH 네이티브 schedule cron — 일원화 깨짐/지연 이슈로 비권장)
- 기존 잡과의 차이: 다른 잡은 cron-job.org→OPS API 직접, SmileEdi 스크래퍼는 cron-job.org→GitHub(브라우저 필요)

## 결정 업데이트 2 (기간·발송·보안 확정)
1. **검색 기간 (b)**: 회계연도 4/01~익년 3/31, **동적 산출**. 규칙: 오늘이 4월 이후면 올해 4/01~익년 3/31, 3월 이전이면 작년 4/01~올해 3/31 → 매년 자동 +1. 하드코딩(20250301~20260228) 제거
2. **발송계정**: SMTP(ys1114@jinhakapply.com) 폐기 → 기존 Graph `sendMail({senderUserId})` 패턴. senderUserId = 운영자 본인 메일박스(수동=로그인 admin, cron=설정 담당 operator UPN). SMTP 시크릿 제거, 브랜드 [운영부 상황실] 통일
3. **보안 (필수)**: Tax_invoice.py에 자격증명이 os.getenv 기본값으로 하드코딩됨(SMILEEDI jinhakapply/jinhak0326, EXCEL akfls12!!, SMTP akfls33!!). 전부 GitHub Actions Secrets로 외부화 + 코드 기본값 제거(없으면 즉시 실패) + .gitignore로 .env/자격증명 커밋 차단 + 노출된 비번 로테이션 권장
