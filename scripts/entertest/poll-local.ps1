# entertest 테스트 — 로컬 폴러 (회사 PC, 작업 스케줄러가 N분마다 호출)
#
# OPS의 '테스트 실행 요청'(entertest_test_runs pending)을 claim해 run-local.ps1을 실행하고
# 비정상 종료 시에만 완료(error) 보고한다. 정상 결과는 test_run.py가 /ingest로 직접 적재.
# 자격: 레포 루트 .env.local의 CRON_SECRET / OPS_CONSOLE_BASE_URL.

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo

function Get-DotEnv([string]$path, [string]$key) {
    if (-not (Test-Path $path)) { return "" }
    foreach ($line in Get-Content $path) {
        if ($line -match "^\s*$([regex]::Escape($key))\s*=\s*(.*)$") {
            return $matches[1].Trim().Trim('"')
        }
    }
    return ""
}

$envPath = Join-Path $repo ".env.local"
# 프로세스 env가 설정돼 있으면 우선(로컬 테스트 시 localhost로 오버라이드 가능), 없으면 .env.local.
$secret = if ($env:CRON_SECRET) { $env:CRON_SECRET } else { Get-DotEnv $envPath "CRON_SECRET" }
$base = if ($env:OPS_CONSOLE_BASE_URL) { $env:OPS_CONSOLE_BASE_URL } else { Get-DotEnv $envPath "OPS_CONSOLE_BASE_URL" }
$base = $base.TrimEnd("/")
if (-not $secret -or -not $base) {
    Write-Host "[poll] CRON_SECRET / OPS_CONSOLE_BASE_URL 미설정 — 종료"
    exit 1
}

$headers = @{ Authorization = "Bearer $secret" }
$uri = "$base/api/entertest/test-request"

# 1) pending claim
$claim = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
if (-not $claim.request) { exit 0 }
$id = $claim.request.id
Write-Host "[poll] 요청 claim: $id ($($claim.request.target_url))"

# 2) run-local 실행 (run_id/url/account 전달)
$ok = $false
$msg = ""
try {
    $env:ENTERTEST_RUN_ID = $id
    $env:ENTERTEST_TARGET_URL = $claim.request.target_url
    $env:ENTERTEST_ACCOUNT = $claim.request.test_account
    & (Join-Path $PSScriptRoot "run-local.ps1")
    $code = $LASTEXITCODE
    $ok = ($code -eq 0)
    $msg = "exit $code"
} catch {
    $msg = "poller 예외: $($_.Exception.Message)"
}

# 3) 비정상 종료만 error 보고 (정상은 test_run.py가 ingest로 적재)
if (-not $ok) {
    $body = @{ id = $id; ok = $false; message = $msg } | ConvertTo-Json -Compress
    Invoke-RestMethod -Method Post -Uri $uri -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $body | Out-Null
    Write-Host "[poll] error 보고: $msg"
}
exit 0
