# 주간업무보고 개발/테스트 구분 수집 — Windows 작업 스케줄러 등록 (이 PC에서 1회 실행)
#
# 매주 수요일 09:30에 run-local.ps1을 실행. 마감 스크랩(평일 09:00)이 아직 도는 중이면
# 래퍼가 끝날 때까지 기다린다. 헤드리스라 화면(데스크톱 세션)이 필요 없다.
#
# 기본(로그온 시에만 실행):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/moa-dev-status/register-task.ps1
#
# 무인(로그오프 상태에서도 실행 — S4U, 비밀번호 불필요): 권장
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/moa-dev-status/register-task.ps1 -Unattended
#
# 무인(비밀번호 저장 방식 — S4U가 안 될 때 폴백):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/moa-dev-status/register-task.ps1 -StorePassword
#
# 해제: Unregister-ScheduledTask -TaskName "OPS-Console-Ops-Weekly-Dev-Status" -Confirm:$false

param([switch]$Unattended, [switch]$StorePassword)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runner = Join-Path $repo "scripts\moa-dev-status\run-local.ps1"
if (-not (Test-Path $runner)) { throw "runner 없음: $runner" }

$taskName = "OPS-Console-Ops-Weekly-Dev-Status"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`""

# 매주 수요일 09:30
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Wednesday -At 09:30am

# 꺼져 있었으면 다음 켜질 때 실행, 절전이면 깨워서 실행 시도, 배터리에서도 실행.
# 겹쳐 실행되면(두 Moa 로그인이 SMS 를 섞는다) 새 실행은 무시한다.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 45)

$desc = "Moa 개발/테스트 현황 수집 -> 주간업무보고 적재. 매주 수 09:30(마감 스크랩 실행 중이면 대기)."

$user = "$env:USERDOMAIN\$env:USERNAME"

if ($StorePassword) {
    $cred = Get-Credential -UserName $user `
        -Message "Windows 로그인 비밀번호 (로그오프 상태에서도 작업이 실행되도록 저장)"
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -RunLevel Limited `
        -User $cred.UserName -Password $cred.GetNetworkCredential().Password `
        -Description $desc -Force | Out-Null
    Write-Host "[OK] 무인(비밀번호 저장) 등록 완료: '$taskName' (로그온 여부 무관)"
    Write-Host "     주의: 회사가 비밀번호를 바꾸면 -StorePassword로 재등록 필요."
}
elseif ($Unattended) {
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Principal $principal `
        -Description $desc -Force | Out-Null
    Write-Host "[OK] 무인(S4U, 비밀번호 불필요) 등록 완료: '$taskName' (로그온 여부 무관)"
    Write-Host "     네트워크 제약 등으로 안 되면:  register-task.ps1 -StorePassword"
}
else {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Description $desc -Force | Out-Null
    Write-Host "[OK] 등록 완료: '$taskName' (로그온 시에만 실행, 매주 수 09:30)"
    Write-Host "     로그오프 상태에서도 돌리려면:  register-task.ps1 -Unattended"
}

Write-Host "     지금 1회 테스트:  Start-ScheduledTask -TaskName '$taskName'  (Moa 로그인 = 실제 SMS 발송)"
Write-Host "     로그 확인:        Get-Content scripts\moa-dev-status\run-local.log -Tail 40"
