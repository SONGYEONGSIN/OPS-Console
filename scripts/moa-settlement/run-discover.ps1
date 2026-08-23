# Moa 정산 화면 디스커버리 — 회사 PC 에서 한 번 실행.
#
# 마감 스크래퍼(scripts/moa-closing)와 같은 자격증명을 쓴다. 창을 띄워 두는 게 기본이다 —
# 무엇이 뜨는지 눈으로 같이 봐야 출력이 읽힌다.

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

$envFile = Join-Path $repo ".env.local"
foreach ($k in @("MOA_USERNAME", "MOA_PASSWORD", "MAKE_SMS_CODE_URL")) {
    if (-not [Environment]::GetEnvironmentVariable($k)) {
        $v = Get-DotEnv $envFile $k
        if (-not $v) { throw "$k 가 없습니다 (.env.local 확인)" }
        Set-Item -Path "env:$k" -Value $v
    }
}

# 창을 띄운다 — 디스커버리는 사람이 같이 보는 작업이다.
if (-not $env:HEADLESS_MODE) { $env:HEADLESS_MODE = "false" }

python scripts\moa-settlement\discover.py
