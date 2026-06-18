# entertest 폴러 작업 스케줄러 등록 — 5분 간격.
$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "poll-local.ps1"
$taskName = "OPS-EntertestPoller"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description "OPS entertest 테스트 실행 요청 폴러 (5분 간격)" -Force

Write-Host "등록 완료: $taskName (5분 간격)"
