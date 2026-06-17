# 서비스 마감 로컬 폴러 — Windows 작업 스케줄러 등록 (이 PC에서 1회 실행)
#
# 5분마다 poll-local.ps1을 실행해 OPS의 '로컬 실행 요청'(pending)을 확인.
# pending이 있으면 run-local.ps1을 실행하고, 없으면 즉시 종료(가벼움).
# register-task.ps1(매주 월 정기 실행)과 별개로, 웹 버튼 기반 on-demand 실행용.
#
# 기본(로그온 시에만):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/moa-closing/register-poll-task.ps1
# 무인(로그오프 상태에서도 — S4U, 비밀번호 불필요): 권장
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/moa-closing/register-poll-task.ps1 -Unattended
# 무인(비밀번호 저장 폴백):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/moa-closing/register-poll-task.ps1 -StorePassword
#
# 해제: Unregister-ScheduledTask -TaskName "OPS-Console-Closing-Poll" -Confirm:$false

param([switch]$Unattended, [switch]$StorePassword)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runner = Join-Path $repo "scripts\moa-closing\poll-local.ps1"
if (-not (Test-Path $runner)) { throw "poller 없음: $runner" }

$taskName = "OPS-Console-Closing-Poll"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`""

# 5분마다 반복 (지금부터, 사실상 무기한). 정기 트리거가 아니라 on-demand 요청 폴링용.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

$desc = "OPS 로컬 실행 요청 폴러. 5분마다 pending 확인 → run-local 실행. 회사/가정 IP라 Cloudflare 통과."

$user = "$env:USERDOMAIN\$env:USERNAME"

if ($StorePassword) {
    $cred = Get-Credential -UserName $user `
        -Message "Windows 로그인 비밀번호 (로그오프 상태에서도 폴러가 실행되도록 저장)"
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -RunLevel Limited `
        -User $cred.UserName -Password $cred.GetNetworkCredential().Password `
        -Description $desc -Force | Out-Null
    Write-Host "[OK] 무인(비밀번호 저장) 폴러 등록 완료: '$taskName' (5분 간격)"
}
elseif ($Unattended) {
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Principal $principal `
        -Description $desc -Force | Out-Null
    Write-Host "[OK] 무인(S4U) 폴러 등록 완료: '$taskName' (5분 간격, 로그온 여부 무관)"
}
else {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Description $desc -Force | Out-Null
    Write-Host "[OK] 폴러 등록 완료: '$taskName' (로그온 시에만, 5분 간격)"
    Write-Host "     로그오프 상태에서도 돌리려면:  register-poll-task.ps1 -Unattended"
}

Write-Host "     지금 1회 테스트:  Start-ScheduledTask -TaskName '$taskName'"
