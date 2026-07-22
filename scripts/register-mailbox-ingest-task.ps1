# 메일함 ingest — Windows 작업 스케줄러 등록 (이 PC에서 1회 실행)
#
# 10분마다 mailbox-ingest.cmd 실행 → Outlook 수집 + auto_draft 운영자 대상 claude -p 회신 초안.
# claude -p OAuth 구독은 로그인 사용자 세션에서만 유효하므로 기본은 InteractiveToken(로그온 시에만).
# 이는 claude -p를 쓰는 OPS-DevControlAnalyze와 동일한 검증된 실행 모드다.
#
# 등록:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-mailbox-ingest-task.ps1
# 해제:
#   Unregister-ScheduledTask -TaskName "OPS-Console-Mailbox-Ingest" -Confirm:$false
#
# 주의: 이 작업을 등록하면 다른 머신(집 Mac mini 등)의 mailbox-ingest 크론은 반드시 중지해야 한다.
#       두 곳이 동시에 돌면 last_synced_at 레이스로 서로 새 메일을 놓쳐 초안이 안 생길 수 있다.

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$cmd = Join-Path $repo "scripts\mailbox-ingest.cmd"
if (-not (Test-Path $cmd)) { throw "래퍼 없음: $cmd" }

$taskName = "OPS-Console-Mailbox-Ingest"

$action = New-ScheduledTaskAction -Execute $cmd

# 10분마다 반복 (지금부터, 사실상 무기한).
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 10) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

$desc = "메일함 ingest — Outlook 수집 + claude -p AI 회신 초안 (10분 간격, 로그온 시). Mac mini 크론에서 이전."

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description $desc -Force | Out-Null

Write-Host "[OK] 등록 완료: '$taskName' (로그온 시에만, 10분 간격)"
Write-Host "     지금 1회 테스트:  Start-ScheduledTask -TaskName '$taskName'"
Write-Host "     [중요] 집 Mac mini의 mailbox-ingest 크론(launchd)을 반드시 중지하세요 (중복 실행 방지)."
