# 서비스 마감 스크랩 — Windows 작업 스케줄러 등록 (이 PC에서 1회 실행)
#
# 매주 월요일 10:00에 run-local.ps1을 실행하도록 등록한다. 격주 off주는 스크래퍼가
# 스스로 [SKIP] 종료하므로 트리거는 매주로 둔다. 로그인한 사용자 컨텍스트로 실행되어야
# .env.local / Chrome 접근이 가능하므로 관리자 권한은 불필요(현재 사용자로 등록).
#
# 사용:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\moa-closing\register-task.ps1
# 해제:  Unregister-ScheduledTask -TaskName "OPS-Console-서비스마감-스크랩" -Confirm:$false

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runner = Join-Path $repo "scripts\moa-closing\run-local.ps1"
if (-not (Test-Path $runner)) { throw "runner 없음: $runner" }

$taskName = "OPS-Console-서비스마감-스크랩"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`""

# 매주 월요일 10:00 (격주 판정은 스크래퍼 내부 게이트)
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 10:00am

# PC가 그 시각에 꺼져 있었으면 다음에 켜질 때 실행. 배터리에서도 실행.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Force `
    -Description "Moa 서비스마감 스크랩 → OPS 적재. 매주 월 10:00(격주는 스크래퍼가 판정). 회사/가정 IP라 Cloudflare 통과." | Out-Null

Write-Host "[OK] 등록 완료: '$taskName' — 매주 월 10:00 (off주는 스크래퍼가 자동 스킵)"
Write-Host "     지금 1회 테스트:  Start-ScheduledTask -TaskName '$taskName'"
Write-Host "     로그 확인:        Get-Content scripts\moa-closing\run-local.log -Tail 40"
