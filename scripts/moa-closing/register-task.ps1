# 서비스 마감 스크랩 — Windows 작업 스케줄러 등록 (이 PC에서 1회 실행)
#
# 매주 월요일 10:00에 run-local.ps1을 실행. 격주 off주는 스크래퍼가 스스로 [SKIP] 종료하므로
# 트리거는 매주로 둔다. 헤드리스라 화면(데스크톱 세션)이 필요 없다.
#
# 기본(로그온 시에만 실행):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/moa-closing/register-task.ps1
#
# 무인(로그오프 상태에서도 실행 — Windows 비밀번호 저장):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/moa-closing/register-task.ps1 -Unattended
#   -> 실행 시 Windows 로그인 비밀번호 프롬프트가 뜬다(작업에 암호화 저장). PC는 켜져 있어야 하며,
#      회사가 비밀번호를 바꾸면 이 작업을 -Unattended로 다시 등록해야 한다(저장된 비번이 만료되므로).
#
# 해제: Unregister-ScheduledTask -TaskName "OPS-Console-Closing-Scrape" -Confirm:$false

param([switch]$Unattended)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runner = Join-Path $repo "scripts\moa-closing\run-local.ps1"
if (-not (Test-Path $runner)) { throw "runner 없음: $runner" }

$taskName = "OPS-Console-Closing-Scrape"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`""

# 매주 월요일 10:00 (격주 판정은 스크래퍼 내부 게이트)
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 10:00am

# 꺼져 있었으면 다음 켜질 때 실행, 절전이면 깨워서 실행 시도, 배터리에서도 실행.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

$desc = "Moa 서비스마감 스크랩 -> OPS 적재. 매주 월 10:00(격주는 스크래퍼가 판정). 회사/가정 IP라 Cloudflare 통과."

if ($Unattended) {
    # 로그온 여부와 무관하게 실행 — Windows 자격증명(비밀번호) 저장 필요.
    $user = "$env:USERDOMAIN\$env:USERNAME"
    $cred = Get-Credential -UserName $user `
        -Message "Windows 로그인 비밀번호 (로그오프 상태에서도 작업이 실행되도록 저장)"
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -RunLevel Limited `
        -User $cred.UserName -Password $cred.GetNetworkCredential().Password `
        -Description $desc -Force | Out-Null
    Write-Host "[OK] 무인 등록 완료: '$taskName' (로그온 여부 무관 실행, 매주 월 10:00)"
    Write-Host "     주의: 회사가 비밀번호를 바꾸면 -Unattended로 재등록 필요."
}
else {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Description $desc -Force | Out-Null
    Write-Host "[OK] 등록 완료: '$taskName' (로그온 시에만 실행, 매주 월 10:00)"
    Write-Host "     로그오프 상태에서도 돌리려면:  register-task.ps1 -Unattended"
}

Write-Host "     지금 1회 테스트:  Start-ScheduledTask -TaskName '$taskName'"
Write-Host "     로그 확인:        Get-Content scripts\moa-closing\run-local.log -Tail 40"
