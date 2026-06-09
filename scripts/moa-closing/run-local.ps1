# 서비스 마감 스크래퍼 — 로컬 실행 래퍼 (Windows 작업 스케줄러가 호출)
#
# 회사/가정 PC(residential급 IP)에서 헤드리스로 실행 → Cloudflare 통과 → OPS prod 적재.
# 격주 판정은 scrape.py 내부 게이트(should_run_this_week)가 하므로 작업은 매주 월요일에
# 등록하고 off주에는 스크래퍼가 스스로 [SKIP] 종료한다.
# 자격증명 등은 레포 루트 .env.local에서 scrape.py가 자동 로드한다.

$ErrorActionPreference = "Stop"
# scripts/moa-closing → scripts → repo root
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo

$env:HEADLESS_MODE = "true"
# CLOSING_DRY_RUN 미설정 = 실제 적재. 테스트만 하려면 아래 줄 주석 해제:
# $env:CLOSING_DRY_RUN = "true"

$log = Join-Path $repo "scripts\moa-closing\run-local.log"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"=== $ts 시작 (HEADLESS=$($env:HEADLESS_MODE) DRY_RUN=$($env:CLOSING_DRY_RUN)) ===" |
    Out-File -Append -Encoding utf8 $log

python "scripts\moa-closing\scrape.py" *>> $log
$code = $LASTEXITCODE

"=== $ts 종료 (exit $code) ===" | Out-File -Append -Encoding utf8 $log
exit $code
