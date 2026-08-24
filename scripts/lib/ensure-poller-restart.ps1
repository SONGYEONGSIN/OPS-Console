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

  if ($xml -match '<TimeTrigger>') {
    Write-Output ("SKIP {0} — 이미 시각 트리거가 있습니다" -f $t.TaskName)
    continue
  }

  # **TimeTrigger 여야 한다.** LogonTrigger 에 Repetition 을 붙이면 '로그온 이벤트가
  # 일어난 뒤' 반복하므로, 이미 로그온한 상태에서는 예약이 아예 안 잡힌다
  # (2026-08-24 그렇게 붙였다가 NextRunTime 이 빈 채로 2시간 반 방치됐다).
  # 잘 도는 5분 폴러들이 쓰는 구조를 그대로 따른다.
  $start = (Get-Date).AddMinutes(-1).ToString("yyyy-MM-ddTHH:mm:ss")
  $tt = '<TimeTrigger><StartBoundary>' + $start + '</StartBoundary>' +
        '<Repetition><Interval>PT5M</Interval><Duration>P3650D</Duration>' +
        '<StopAtDurationEnd>true</StopAtDurationEnd></Repetition></TimeTrigger>'
  # 지난번 LogonTrigger 에 붙였던 반복은 걷어낸다 — 아무 일도 안 하면서 지저분하다.
  $cleaned = $xml -replace '<LogonTrigger>\s*<Repetition>.*?</Repetition>\s*</LogonTrigger>', '<LogonTrigger />'
  $new = $cleaned -replace '</Triggers>', ($tt + '</Triggers>')
  if ($new -eq $cleaned) {
    Write-Output ("FAIL {0} — Triggers 를 못 찾았습니다. 백업: {1}" -f $t.TaskName, $backupDir)
    continue
  }
  Register-ScheduledTask -TaskName $t.TaskName -Xml $new -User $env:USERNAME -Force | Out-Null

  # **설정이 들어갔는지가 아니라 예약이 잡혔는지를 본다.** 지난번엔 반복 간격이
  # 붙은 것만 보고 됐다고 했는데, NextRunTime 이 비어 아무 일도 안 일어났다.
  $next = (Get-ScheduledTaskInfo -TaskName $t.TaskName).NextRunTime
  if ($next) {
    Write-Output ("OK   {0} — 다음 실행 {1}" -f $t.TaskName, $next)
  } else {
    Write-Output ("FAIL {0} — 반복은 붙었지만 예약이 안 잡혔습니다. 백업: {1}" -f $t.TaskName, $backupDir)
  }

  # 재등록하면 돌던 프로세스가 멈춘다 — 바로 다시 띄운다.
  Start-ScheduledTask -TaskName $t.TaskName
}
Write-Output ("백업: {0}" -f $backupDir)
