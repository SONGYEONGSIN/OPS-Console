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

# 살아있음을 남긴다 — 이 스크립트는 5분마다 한 번 돌고 끝나므로 그 실행이 곧 심박이다.
# 큐가 조용하면 이게 생사의 유일한 증거다(2026-08-20 어시스턴트 폴러가 12시간 죽어 있었다).
. (Join-Path $PSScriptRoot "../lib/Heartbeat.ps1")
Send-PollerHeartbeat -BaseUrl $base -Secret $secret -PollerId "dev-control"

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
# 종류를 안 주는 구버전 요청은 분석으로 본다.
$kind = if ($claim.request.kind) { $claim.request.kind } else { "analyze" }
Write-Host "[poll] 요청 claim: $id / $kind (service $serviceId, by $($claim.request.requested_by))"

# --- 2) 해당 service_id만 처리 (dev-control-analyze.cmd와 동일 node 경로) ---
#
# 무엇을 할지는 요청이 정한다:
#   analyze — 원서GEN 로그인 + 수집 + 분석 (운영자가 확인할 것)
#   spec    — 저장된 raw_code 로 학교 안내용 명세 (수집·로그인 없음)
#
# 새 폴러를 만들지 않고 여기서 가른다 — 회사 PC에 등록할 작업이 하나 더 늘면
# 그게 곧 죽는 지점이다(등록 누락으로 자동화가 통째로 안 돈 적이 여러 번 있다).
$script = if ($kind -eq "spec") { "scripts\dev-control-spec.mjs" } else { "scripts\dev-control-analyze.mjs" }

$ok = $false
$msg = ""
# python 폴러와 같은 이유로 실행 구간만 Continue 로 낮춘다 — stderr 한 줄에 터지면
# 진짜 원인이 통째로 유실된다. 성패는 exit code 로 판단한다.
$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    $node = "C:\Program Files\nodejs\node.exe"
    $output = & $node (Join-Path $repo $script) "$serviceId" 2>&1 | ForEach-Object {
        Write-Host $_
        $_
    }
    $code = $LASTEXITCODE
    $ok = ($code -eq 0)
    if ($ok) {
        $msg = "$kind exit 0"
    } else {
        # **이유 없이 'exit 1' 만 남으면 운영자가 손쓸 수 없다.** 마지막 줄에 원인이
        # 들어 있다(2026-09-04 ETIMEDOUT 이 화면에 안 떠 원인 추적이 막혔다).
        $tail = (($output | Select-Object -Last 2) -join " / ")
        if ($tail.Length -gt 250) { $tail = $tail.Substring($tail.Length - 250) }
        $msg = "$kind exit $code — $tail"
    }
} catch {
    $msg = "poller 예외: $($_.Exception.Message)"
} finally {
    $ErrorActionPreference = $prev
}

# --- 3) 완료 보고 ---
$body = @{ id = $id; ok = $ok; message = $msg } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri $uri -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $body | Out-Null
Write-Host "[poll] 완료 보고: ok=$ok ($msg)"
exit 0
