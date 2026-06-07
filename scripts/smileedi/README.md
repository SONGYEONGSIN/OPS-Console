# SmileEDI 스크래퍼 (Phase 2)

SmileEDI 사이트에서 역발행 세금계산서를 스크래핑해 SharePoint `정산/역발행 세금계산서.xlsx`에 적재한다.
**메일 발송·이메일오류 갱신은 하지 않는다** — OPS-Console 자동화 잡 `smileedi-mail`(Phase 1)이 담당한다.

## 실행 흐름

```
cron-job.org (스케줄)
  └─ POST https://api.github.com/repos/SONGYEONGSIN/OPS-Console/actions/workflows/smileedi-scrape.yml/dispatches
       Header: Authorization: Bearer <GitHub PAT (fine-grained, Actions: read+write)>
       Body:   {"ref":"main"}
       │
       ▼
GitHub Actions: .github/workflows/smileedi-scrape.yml
  ├─ setup-python + Chrome
  ├─ python scripts/smileedi/tax_invoice.py  (SKIP_MAIL=true → 스크래핑+업로드만)
  └─ POST {OPS_CONSOLE_BASE_URL}/api/automations/run?jobId=smileedi-mail  (Bearer CRON_SECRET)
       │
       ▼
OPS-Console smileedi-mail 잡: 조건부 담당자 메일 + 이메일오류='Y' 갱신 + 이력
```

> 대시보드 `/dashboard/automations`에서 `smileedi-mail` **토글이 ON**이어야 cron 체이닝이 실행된다(enabled 게이트).

## 검색기간

`SEARCH_START_DATE`/`SEARCH_END_DATE` 미지정 시 **회계연도 4/01~익년 3/31(KST)을 자동 산출**(매년 +1). 고정하려면 env로 `YYYYMMDD` 지정.

## GitHub Actions Secrets (Settings → Secrets and variables → Actions)

| Secret | 설명 |
|---|---|
| `SMILEEDI_USERNAME` / `SMILEEDI_PASSWORD` | SmileEDI 로그인 (하드코딩 제거됨 — 필수) |
| `SMILEEDI_EXCEL_PASSWORD` | 암호화 Excel 복호 비밀번호 |
| `SHAREPOINT_TENANT_ID` / `SHAREPOINT_CLIENT_ID` / `SHAREPOINT_CLIENT_SECRET` | Graph 인증 |
| `SHAREPOINT_SITE_ID` / `SHAREPOINT_SMILEEDI_DRIVE_ID` | 업로드 대상 |
| `OPS_CONSOLE_BASE_URL` / `CRON_SECRET` | 체이닝 호출 |

## ⚠️ 보안

- **노출됐던 비밀번호는 로테이션 필수** — 원본 `docs/SmileEdi/`에 평문 하드코딩되어 있었음(현재 git 차단). SmileEDI 로그인/Excel/SMTP 비번을 모두 교체할 것.
- 원본 `docs/SmileEdi/`는 `.gitignore`로 커밋 차단(시크릿 포함). 정리본 이 디렉터리만 추적하며 자격증명 기본값은 제거됨.

## ⚠️ 운영 검증 필요 (Q2)

`tax_invoice.py`의 SharePoint 업로드 인증이 client_credentials(앱 권한)로 동작하는지 첫 실행에서 확인.
원본은 delegated(`refresh_token.txt`) 방식이었으므로, 무인 CI에서 401이 나면 앱 권한(Sites.Selected 등) 부여 또는 토큰 사전 발급 전략으로 전환해야 한다.
