<#
.SYNOPSIS
  상주 폴러가 죽어도 5분 안에 살아나게 한다.

.DESCRIPTION
  2026-08-24 어시스턴트 폴러가 절전 복귀 뒤 죽어 **1시간 방치**됐다. 작업에
  `RestartCount 999 / 1분` 이 걸려 있었는데도 안 살아났다 — Windows 의 "실패 시 다시
  시작"은 **프로세스가 스스로 종료한 경우에는 잘 듣지 않는다.**

  확실한 방법은 반복 트리거다. `MultipleInstances=IgnoreNew` 가 이미 걸려 있어
  **살아 있으면 새 인스턴스가 안 뜨고, 죽어 있을 때만 살아난다.**

  5분마다 도는 PowerShell 폴러들에는 이미 이 트리거가 있다. 상주 폴러 둘만 없었다.

.NOTES
  **관리자 권한으로 실행해야 한다.** 기존 작업 수정은 일반 권한으로 막힌다
  (0x80070005). 바꾸기 전 작업 정의를 XML 로 백업한다.
#>
$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal(
  [Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Error "관리자 권한이 필요합니다. PowerShell 을 '관리자로 실행' 한 뒤 다시 돌리세요."
  exit 1
}

$backupDir = Join-Path $env:TEMP ("ops-console-task-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# 한글 작업 이름 대신 실행 인자로 찾는다 — 콘솔 인코딩에 걸리지 않는다.
$targets = Get-ScheduledTask | Where-Object {
  $_.Actions.Arguments -match 'serve-local|extract-local'
}
if (-not $targets) { Write-Output "상주 폴러 작업을 못 찾았습니다."; exit 0 }

$n = 0
foreach ($t in $targets) {
  $n++
  $xml = Export-ScheduledTask -TaskName $t.TaskName
  [IO.File]::WriteAllText((Join-Path $backupDir "$n.xml"), $xml, [Text.Encoding]::Unicode)

  if ($xml -match '<Repetition>') {
    Write-Output ("SKIP {0} — 이미 반복 트리거가 있습니다" -f $t.TaskName)
    continue
  }
  $rep = '<LogonTrigger><Repetition><Interval>PT5M</Interval>' +
         '<StopAtDurationEnd>false</StopAtDurationEnd></Repetition></LogonTrigger>'
  $new = $xml -replace '<LogonTrigger\s*/>', $rep
  if ($new -eq $xml) {
    Write-Output ("FAIL {0} — LogonTrigger 를 못 찾았습니다. 백업: {1}" -f $t.TaskName, $backupDir)
    continue
  }
  Register-ScheduledTask -TaskName $t.TaskName -Xml $new -User $env:USERNAME -Force | Out-Null
  Write-Output ("OK   {0} — 5분 반복 추가" -f $t.TaskName)
}
Write-Output ("백업: {0}" -f $backupDir)
