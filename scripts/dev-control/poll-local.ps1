# 개발 탭 원서제어 '수동 분석' — 로컬 폴러 (회사 PC, 작업 스케줄러가 5분마다 호출)
#
# 분석은 원서GEN 로그인(MOA 계정) + claude -p(이 PC의 OAuth 구독)가 필요해 Vercel에서
# 실행 불가 → 웹 '지금 분석' 요청(dev_control_analyze_requests pending)을 claim해
# 해당 service_id만 dev-control-analyze.mjs로 재수집·분석하고 완료를 보고한다.
# pending이 없으면 즉시 종료. 매일 08:30 전체 실행(dev-control-analyze.cmd)과 독립.
#
# 자격: 레포 루트 .env.local의 CRON_SECRET / OPS_CONSOLE_BASE_URL 사용.
# 등록: register-poll-task.ps1 (5분 간격).

$ErrorActionPreference = "Stop"
# scripts/dev-control → scripts → repo root
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo

# --- .env.local에서 키 읽기 ---
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
$secret = Get-DotEnv $envPath "CRON_SECRET"
$base = (Get-DotEnv $envPath "OPS_CONSOLE_BASE_URL").TrimEnd("/")
if (-not $secret -or -not $base) {
    Write-Host "[poll] CRON_SECRET / OPS_CONSOLE_BASE_URL 미설정 — 종료"
    exit 1
}

$headers = @{ Authorization = "Bearer $secret" }
$uri = "$base/api/dev-controls/analyze-request"

# --- 1) pending claim ---
$claim = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
if (-not $claim.request) {
    # 대기 요청 없음 — 정상 종료
    exit 0
}
$id = $claim.request.id
$serviceId = $claim.request.service_id
Write-Host "[poll] 요청 claim: $id (service $serviceId, by $($claim.request.requested_by))"

# --- 2) 해당 service_id만 분석 (dev-control-analyze.cmd와 동일 node 경로) ---
$ok = $false
$msg = ""
try {
    $node = "C:\Program Files\nodejs\node.exe"
    & $node (Join-Path $repo "scripts\dev-control-analyze.mjs") "$serviceId"
    $code = $LASTEXITCODE
    $ok = ($code -eq 0)
    $msg = "exit $code"
} catch {
    $msg = "poller 예외: $($_.Exception.Message)"
}

# --- 3) 완료 보고 ---
$body = @{ id = $id; ok = $ok; message = $msg } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri $uri -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $body | Out-Null
Write-Host "[poll] 완료 보고: ok=$ok ($msg)"
exit 0
