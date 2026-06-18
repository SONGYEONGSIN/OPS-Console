# entertest 테스트 러너 — 로컬 실행 래퍼 (poll-local.ps1이 호출).
# 회사 PC(residential IP)에서 실제 Chrome으로 Cloudflare 브라우저 게이트 통과.
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo

# 폴러 경로는 항상 '실제 ingest 실행'이다 — 셸에 남은 디스커버리/체크온리 플래그를 강제로 끈다.
$env:ENTERTEST_DISCOVER = ""
$env:ENTERTEST_CHECKS_ONLY = ""

$log = Join-Path $repo "scripts\entertest\run-local.log"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"=== $ts 시작 (run=$($env:ENTERTEST_RUN_ID) url=$($env:ENTERTEST_TARGET_URL)) ===" |
    Out-File -Append -Encoding utf8 $log

python "scripts\entertest\test_run.py" *>> $log
$code = $LASTEXITCODE

"=== $ts 종료 (exit $code) ===" | Out-File -Append -Encoding utf8 $log
exit $code
