<#
「06. Moa 대조」·「07. PIMS 대조」 시트를 현황 xlsm 작업 사본에 같은 자리에서 다시 쓴다 (Excel COM).
다른 시트·매크로·수식·이름 정의는 건드리지 않는다.

사용법 (Data 는 {"sheets": [<build_moa_sheet>, <build_pims_sheet>]} 모양의 JSON):
  pwsh -NoProfile -ExecutionPolicy Bypass -File excel_apply.ps1 `
       -Workbook "...\work\SMS 발신번호 사전등록 현황_YYMMDD.xlsm" -Data "...\sheets.json" -PidFile "...\excel.pid"

- 시트가 이미 있으면 지우지 않고 그 자리에서 비운 뒤(필터 해제 · 전체 Clear · 행 높이 기본값) 다시 쓴다.
  없으면 afterSheet 바로 뒤에 새로 만든다. 시트 순서와 다른 시트를 가리키는 참조가 그대로 남는다.
- 매크로는 강제 비활성(AutomationSecurity=3), 화면·경고·이벤트 끔. 같은 이름·같은 형식(xlsm, 52)으로 저장한다.
- 저장은 모든 시트를 쓴 뒤 한 번. 중간에 실패하면 저장하지 않고 닫은 뒤 다시 던진다(파일은 그대로).
- 이 스크립트가 띄운 EXCEL 프로세스만 정리한다. 그 PID 를 PidFile 에 적어 둔다 — COM 으로 뜬 Excel 은
  pwsh 의 자식이 아니라서, 시간 초과로 pwsh 를 죽인 Python 이 이 파일의 PID 만 골라 끝낸다.
- 모양은 「03. 번호 목록」에서 읽어 맞춘다(제목 1행·안내 2~3행·헤더 8행·데이터 9행~, 행 높이·글꼴·테두리).
- 마지막 출력 줄: 성공이면 "excel cleanup: …", 실패면 "FAILED at line N: …" (정리 뒤에 적는다).
#>
param(
  [Parameter(Mandatory = $true)][string]$Workbook,
  [Parameter(Mandatory = $true)][string]$Data,
  [Parameter(Mandatory = $true)][string]$PidFile,
  [string]$StyleSheet = '03. 번호 목록'
)
$ErrorActionPreference = 'Stop'
$d = Get-Content -LiteralPath $Data -Raw -Encoding utf8 | ConvertFrom-Json
$sheets = @($d.sheets)

# 열별 너비·정렬 (03 의 감각: 짧은 값 가운데, 긴 글은 왼쪽 + 들여쓰기 1) — 순서는 JSON header 와 같아야 한다
$colSpec = [ordered]@{
  'No' = @(5.38, 'c'); '결과' = @(9.38, 'c'); '발신번호' = @(16.38, 'c'); '세종 학교명' = @(27.38, 'l');
  '세종 등록일자' = @(11.38, 'c'); 'Moa 대학명' = @(36.38, 'l'); 'Moa 등록상태' = @(19.38, 'c');
  'Moa 서비스 수' = @(8.38, 'c'); 'Moa 최근 등록일' = @(11.38, 'c'); '비고' = @(40.38, 'l');
  'PIMS 대학명' = @(36.38, 'l'); 'PIMS 등록상태' = @(19.38, 'c'); 'PIMS 등록 수' = @(8.38, 'c');
  'PIMS 최근 등록일' = @(11.38, 'c')
}
# Excel 을 띄우기 전에 데이터부터 본다 — 모르는 헤더나 빈 입력이면 파일을 열지도 않는다
if ($sheets.Count -eq 0) { throw '시트 데이터가 없다' }
foreach ($sd in $sheets) {
  foreach ($k in $sd.header) { if (-not $colSpec.Contains($k)) { throw "열 정의에 없는 헤더: $k" } }
}
$xlCenter = -4108; $xlLeft = -4131; $xlEdgeLeft = 7; $xlEdgeTop = 8; $xlEdgeBottom = 9; $xlEdgeRight = 10
$xlInsideV = 11; $xlInsideH = 12; $xlContinuous = 1

# pwsh 7 의 COM 바인더는 Range.Value2 에 object[,] 를 바로 못 넣는다 — InvokeMember 로 넣는다
function Set-RangeValue2($range, [object[,]]$values) {
  [void]$range.GetType().InvokeMember('Value2', [System.Reflection.BindingFlags]::SetProperty, $null, $range, @(,$values))
}

# 있으면 그 시트, 없으면 afterSheet 바로 뒤에 새로 만든다 (지우고 다시 만들지 않는다)
function Get-TargetSheet($wb, $sd) {
  $names = @($wb.Worksheets | ForEach-Object { $_.Name })
  if ($names -contains $sd.sheet) { return $wb.Worksheets.Item($sd.sheet) }
  if ($names -notcontains $sd.afterSheet) { throw "'$($sd.afterSheet)' 시트가 없다" }
  $ws = $wb.Worksheets.Add([Type]::Missing, $wb.Worksheets.Item($sd.afterSheet))
  $ws.Name = $sd.sheet
  return $ws
}

# 같은 자리에서 비운다: 필터 해제 → 값·서식·병합 전부 Clear → 행 높이를 기본으로
function Clear-SheetInPlace($ws) {
  $ws.AutoFilterMode = $false
  $ws.Cells.Clear()
  $ws.Rows.RowHeight = $ws.StandardHeight
}

# 시트 바탕 글꼴 + 1~3행 제목·안내 — 03 의 A1~A3 서식과 행 높이
function Write-SheetHeading($ws, $src, $sd) {
  $s9 = $src.Range('A9')
  $ws.Cells.Font.Name = $s9.Font.Name
  $ws.Cells.Font.Size = $s9.Font.Size
  $ws.Range('A1').Value2 = [string]$sd.title
  $ws.Range('A2').Value2 = '▪ ' + $sd.guide[0]
  $ws.Range('A3').Value2 = '▪ ' + $sd.guide[1]
  foreach ($r in 1, 2, 3) {
    $s = $src.Cells($r, 1); $t = $ws.Cells($r, 1)
    $t.Font.Name = $s.Font.Name; $t.Font.Size = $s.Font.Size; $t.Font.Bold = $s.Font.Bold; $t.Font.Color = $s.Font.Color
    $t.HorizontalAlignment = $s.HorizontalAlignment; $t.VerticalAlignment = $s.VerticalAlignment; $t.WrapText = $false
    $ws.Rows($r).RowHeight = $src.Rows($r).RowHeight
  }
}

# 4~7행 요약: 4 여백 / 5 이름 / 6 건수 / 7 주석 — 03 의 여백(5행)·검색 칸(6행)·주석(7행) 서식
function Write-SheetSummary($ws, $src, $sd) {
  $ws.Rows(4).RowHeight = $src.Rows(5).RowHeight
  $ws.Rows(5).RowHeight = $src.Rows(7).RowHeight
  $ws.Rows(6).RowHeight = $src.Rows(6).RowHeight
  $ws.Rows(7).RowHeight = $src.Rows(7).RowHeight
  $note = $src.Range('F7'); $big = $src.Range('E6'); $line = $src.Range('A8').Borders($xlEdgeBottom)
  for ($i = 0; $i -lt $sd.summary.Count; $i++) {
    $lab = $ws.Cells(5, 2 + $i); $val = $ws.Cells(6, 2 + $i)
    $lab.NumberFormat = '@'
    $lab.Value2 = [string]$sd.summary[$i][0]
    $lab.Font.Name = $note.Font.Name; $lab.Font.Size = $note.Font.Size; $lab.Font.Color = $note.Font.Color
    $lab.HorizontalAlignment = $xlCenter; $lab.VerticalAlignment = $xlCenter
    $val.NumberFormat = '#,##0'
    $val.Value2 = [double]$sd.summary[$i][1]
    $val.Font.Name = $big.Font.Name; $val.Font.Size = $big.Font.Size; $val.Font.Bold = $true
    $val.HorizontalAlignment = $xlCenter; $val.VerticalAlignment = $xlCenter
  }
  $box = $ws.Range($ws.Cells(5, 2), $ws.Cells(6, 1 + $sd.summary.Count))
  foreach ($e in $xlEdgeTop, $xlEdgeBottom, $xlEdgeLeft, $xlEdgeRight, $xlInsideV) {
    $b = $box.Borders($e); $b.LineStyle = $xlContinuous; $b.Weight = $line.Weight; $b.Color = $line.Color
  }
  $n7 = $ws.Cells(7, 2)
  $n7.NumberFormat = '@'
  $n7.Value2 = '※ ' + $sd.summaryNote
  $n7.Font.Name = $note.Font.Name; $n7.Font.Size = $note.Font.Size; $n7.Font.Color = $note.Font.Color
  $n7.VerticalAlignment = $xlCenter; $n7.WrapText = $false
}

# 8행 헤더 — 03 의 A8 서식
function Write-SheetHeader($ws, $src, $sd) {
  $h = $src.Range('A8'); $line = $h.Borders($xlEdgeBottom)
  $nCol = $sd.header.Count
  $hr = [int]$sd.headerRow
  $hdr = $ws.Range($ws.Cells($hr, 1), $ws.Cells($hr, $nCol))
  $arr = New-Object 'object[,]' 1, $nCol
  for ($c = 0; $c -lt $nCol; $c++) { $arr[0, $c] = [string]$sd.header[$c] }
  $hdr.NumberFormat = '@'
  Set-RangeValue2 $hdr $arr
  $hdr.Font.Name = $h.Font.Name; $hdr.Font.Size = $h.Font.Size; $hdr.Font.Bold = $h.Font.Bold; $hdr.Font.Color = $h.Font.Color
  $hdr.HorizontalAlignment = $h.HorizontalAlignment; $hdr.VerticalAlignment = $h.VerticalAlignment; $hdr.WrapText = $h.WrapText
  $hb = $hdr.Borders($xlEdgeBottom); $hb.LineStyle = $xlContinuous; $hb.Weight = $line.Weight; $hb.Color = $line.Color
  $ws.Rows($hr).RowHeight = $src.Rows(8).RowHeight
}

# 9행~ 데이터 — 텍스트 열은 값보다 먼저 '@' 로 잡아 번호 앞자리 0·날짜가 바뀌지 않게. 행이 0 이면 아무것도 안 쓴다
function Write-SheetBody($ws, $src, $sd) {
  $n = $sd.rows.Count
  if ($n -eq 0) { return }
  $nCol = $sd.header.Count
  $first = [int]$sd.firstDataRow; $last = $first + $n - 1
  $s9 = $src.Range('A9')
  for ($c = 0; $c -lt $nCol; $c++) {
    $col = $ws.Range($ws.Cells($first, $c + 1), $ws.Cells($last, $c + 1))
    if ($sd.textColumns -contains $sd.header[$c]) { $col.NumberFormat = '@' } else { $col.NumberFormat = '0' }
  }
  $arr = New-Object 'object[,]' $n, $nCol
  for ($r = 0; $r -lt $n; $r++) {
    for ($c = 0; $c -lt $nCol; $c++) {
      $v = $sd.rows[$r][$c]
      if ($null -eq $v -or ($v -is [string] -and $v -eq '')) { $arr[$r, $c] = $null }
      elseif ($v -is [string]) { $arr[$r, $c] = $v }
      else { $arr[$r, $c] = [double]$v }
    }
  }
  $body = $ws.Range($ws.Cells($first, 1), $ws.Cells($last, $nCol))
  Set-RangeValue2 $body $arr
  $body.Font.Name = $s9.Font.Name; $body.Font.Size = $s9.Font.Size
  $body.VerticalAlignment = $s9.VerticalAlignment; $body.WrapText = $true
  $rowLine = $s9.Borders($xlEdgeBottom)
  foreach ($e in $xlEdgeTop, $xlEdgeBottom, $xlInsideH) {
    $b = $body.Borders($e); $b.LineStyle = $xlContinuous; $b.Weight = $rowLine.Weight; $b.Color = $rowLine.Color
  }
  $i = 1
  foreach ($k in $sd.header) {
    $ws.Columns($i).ColumnWidth = $colSpec[$k][0]
    $col = $ws.Range($ws.Cells($first, $i), $ws.Cells($last, $i))
    if ($colSpec[$k][1] -eq 'l') { $col.HorizontalAlignment = $xlLeft; $col.IndentLevel = 1 } else { $col.HorizontalAlignment = $xlCenter }
    $i++
  }
  $minH = $src.Rows(9).RowHeight
  [void]$body.Rows.AutoFit()
  for ($r = $first; $r -le $last; $r++) { if ($ws.Rows($r).RowHeight -lt $minH) { $ws.Rows($r).RowHeight = $minH } }
}

# 자동 필터(헤더 행) + 틀 고정(첫 데이터 행) + 눈금선 끔(03 과 같게)
function Set-SheetView($xl, $ws, $sd) {
  $nCol = $sd.header.Count
  $hr = [int]$sd.headerRow; $first = [int]$sd.firstDataRow
  $last = [Math]::Max($first + $sd.rows.Count - 1, $hr)
  [void]$ws.Range($ws.Cells($hr, 1), $ws.Cells($last, $nCol)).AutoFilter()
  [void]$ws.Activate()
  $win = $xl.ActiveWindow
  $win.FreezePanes = $false
  $win.ScrollRow = 1; $win.ScrollColumn = 1
  [void]$ws.Range("A$first").Select()
  $win.FreezePanes = $true
  $win.DisplayGridlines = $false
  $win.Zoom = 100
  [void]$ws.Range('A1').Select()
}

$before = @(Get-Process EXCEL -ErrorAction SilentlyContinue | ForEach-Object Id)
$xl = New-Object -ComObject Excel.Application
$mine = @(Get-Process EXCEL -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id } | ForEach-Object Id)
$wb = $null; $src = $null; $failure = $null
$applied = @()
try {
  # 띄우자마자 자기 PID 부터 남긴다 — 이후 어디서 멈추든 Python 이 이 PID 만 정리할 수 있게
  Set-Content -LiteralPath $PidFile -Value ($mine -join "`n") -Encoding ascii
  if ($mine.Count -eq 0) { throw '새로 뜬 EXCEL 프로세스를 찾지 못했다 — 멈춤' }
  $xl.AutomationSecurity = 3
  $xl.Visible = $false
  $xl.DisplayAlerts = $false
  $xl.EnableEvents = $false
  $xl.ScreenUpdating = $false
  $wb = $xl.Workbooks.Open($Workbook, 0, $false)
  if ($wb.FileFormat -ne 52) { throw "xlsm(52) 이 아니다: $($wb.FileFormat)" }
  $origActive = $wb.ActiveSheet.Name
  $src = $wb.Worksheets.Item($StyleSheet)

  foreach ($sd in $sheets) {
    $ws = Get-TargetSheet $wb $sd
    try {
      Clear-SheetInPlace $ws
      Write-SheetHeading $ws $src $sd
      Write-SheetSummary $ws $src $sd
      Write-SheetHeader $ws $src $sd
      Write-SheetBody $ws $src $sd
      Set-SheetView $xl $ws $sd
      $applied += ("{0}={1}" -f $sd.sheet, $sd.rows.Count)
    }
    finally { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) }
  }

  # 원래 열려 있던 시트로 되돌리고 같은 이름·같은 형식으로 저장 — 저장은 여기 한 번뿐
  [void]$wb.Worksheets.Item($origActive).Activate()
  $wb.Save()
  Write-Output ("applied: " + ($applied -join '; '))
  $wb.Close($false)
}
catch {
  $failure = "FAILED at line " + $_.InvocationInfo.ScriptLineNumber + ": " + $_.InvocationInfo.Line.Trim()
  if ($null -ne $wb) { try { $wb.Close($false) } catch { } }  # 저장하지 않고 닫는다
  throw
}
finally {
  foreach ($o in $src, $wb) { if ($null -ne $o) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($o) } }
  # 새로 뜬 프로세스를 확인한 경우에만 끈다 — 못 찾았다면 사용자가 쓰던 Excel 에 붙은 것일 수 있다
  if ($mine.Count -gt 0) { $xl.Quit() }
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
  $xl = $null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers(); [GC]::Collect()
  foreach ($p in $mine) {
    for ($t = 0; $t -lt 15 -and (Get-Process -Id $p -ErrorAction SilentlyContinue); $t++) { Start-Sleep -Seconds 1 }
    if (Get-Process -Id $p -ErrorAction SilentlyContinue) { Write-Output "own EXCEL $p did not exit in 15s — stopping it"; Stop-Process -Id $p -Force }
  }
  Write-Output ("excel cleanup: own=" + ($mine -join ',') + " pre-existing=" + $before.Count)
  if ($null -ne $failure) { Write-Output $failure }
}
