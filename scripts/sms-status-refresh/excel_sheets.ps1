<#
PR-3b 시트 쓰기 — excel_apply.ps1 이 dot-source 한다. 함수·상수 정의뿐이고 위에서 아무것도 실행하지 않는다.

payload kind (모양은 각 모듈 docstring):
- table   `_학교`·`_서류`·`_번호` — 2행부터 A~T 를 덮고 남는 행은 A~T 만 ClearContents. U(고를 값)는 안 쓴다
          (이름 정의 `고를값_*`·P 수식 `$U$2:$U$N` 이 박고 있다). 문자열 칸은 '@' 를 먼저 걸고 값(`-`·`=`·`+` 로
          시작하는 글이 수식이 되거나 날짜·숫자 모양 글이 숫자로 바뀌지 않게), 숫자 칸은 General, P 는 Formula.
          textColumns 는 열 문자(A~T)다 — 06·07(compare) 의 textColumns 는 머리글 이름이라 다르다.
- view    01~03 보기 — excel_view.ps1
- summary 00. 요약 — excel_summary.ps1
- meta    `_수정` — 숨김(Visible=0)·맨 끝, A~G 전부 '@' 를 먼저 걸고 머리글+행을 쓴다. 행은 원본+이번(이어 감)
- Delete·Insert·Copy·Save 는 쓰지 않는다(저장은 excel_apply 가 한 번). Calculation 도 바꾸지 않는다.
#>
. (Join-Path $PSScriptRoot 'excel_view.ps1')
. (Join-Path $PSScriptRoot 'excel_summary.ps1')

$TableWidth = 20      # A~T
$TableFirstRow = 2
$PCol = 16            # P — 검색 일치 순번 수식
$MetaWidth = 7        # A~G = 구분·시트·키·열·값·사유·기록일

# pwsh 7 의 COM 바인더는 Range 에 object[,] 를 바로 못 넣는다 — InvokeMember 로 넣는다(5.1 도 같은 길)
function Set-RangeProperty($range, [string]$name, [object[,]]$values) {
  [void]$range.GetType().InvokeMember($name, [System.Reflection.BindingFlags]::SetProperty, $null, $range, @(,$values))
}

function Get-ColumnLetter([int]$c) { return [string][char](64 + $c) }

# 칸 종류: 't' 문자열 · 'n' 숫자 · '' 빈 칸. bool·객체는 JSON 으로 운반할 수 없는 칸이라 멈춘다
function Get-CellKind($v) {
  if ($null -eq $v) { return '' }
  if ($v -is [string]) { if ($v -eq '') { return '' }; return 't' }
  if ($v -is [bool]) { throw '칸 값이 bool — 운반할 수 없다' }
  if ($v -is [int] -or $v -is [long] -or $v -is [double] -or $v -is [decimal]) { return 'n' }
  throw ("모르는 칸 타입: " + $v.GetType().Name)
}

function ConvertTo-CellValue($v) {
  $k = Get-CellKind $v
  if ($k -eq 't') { return [string]$v }
  if ($k -eq 'n') { return [double]$v }
  return $null
}

# 같은 종류가 이어진 구간 @(시작, 끝, 종류) — 빈 칸은 서식을 건드리지 않으므로 구간으로 내지 않는다
function Get-FormatRuns([string[]]$kinds) {
  $runs = New-Object System.Collections.ArrayList
  $start = 0
  for ($i = 1; $i -le $kinds.Count; $i++) {
    if ($i -lt $kinds.Count -and $kinds[$i] -eq $kinds[$start]) { continue }
    if ($kinds[$start] -ne '') { [void]$runs.Add(@($start, ($i - 1), $kinds[$start])) }
    $start = $i
  }
  return ,$runs.ToArray()
}

# ---------------------------------------------------------------- payload 검사 (Excel 을 띄우기 전)
function Assert-TablePayload($sd) {
  $cols = @($sd.columns)
  if ($cols.Count -ne $TableWidth) { throw "$($sd.sheet): 쓰는 열이 A~T 스무 칸이 아니다($($cols.Count))" }
  for ($c = 1; $c -le $TableWidth; $c++) {
    if ([string]$cols[$c - 1] -ne (Get-ColumnLetter $c)) { throw "$($sd.sheet): 열 순서가 A~T 아님" }
  }
  $text = @($sd.textColumns | ForEach-Object { [string]$_ })
  foreach ($t in $text) { if ($cols -notcontains $t -or $t -eq 'P') { throw "$($sd.sheet): textColumns 밖의 열 $t" } }
  if ([int]$sd.beforeRows -lt 0) { throw "$($sd.sheet): beforeRows 음수" }
  foreach ($row in @($sd.rows)) {
    $cells = @($row)
    if ($cells.Count -ne $TableWidth) { throw "$($sd.sheet): 행 칸 수 $($cells.Count) ≠ 20" }
    if (-not ([string]$cells[$PCol - 1]).StartsWith('=')) { throw "$($sd.sheet): P 칸이 수식 아님" }
    for ($c = 1; $c -le $TableWidth; $c++) {
      if ($c -eq $PCol) { continue }
      $k = Get-CellKind $cells[$c - 1]
      if ($k -eq 'n' -and $text -contains (Get-ColumnLetter $c)) { throw "$($sd.sheet): 텍스트 열 $(Get-ColumnLetter $c) 에 숫자" }
    }
  }
}

function Assert-MetaPayload($sd) {
  if (@($sd.header).Count -ne $MetaWidth) { throw "$($sd.sheet): 머리글이 일곱 칸 아님" }
  foreach ($row in @($sd.rows)) {
    if (@($row).Count -ne $MetaWidth) { throw "$($sd.sheet): 행이 일곱 칸 아님" }
  }
}

function Assert-SheetPayload($sd) {
  switch ([string]$sd.kind) {
    'table'   { Assert-TablePayload $sd }
    'view'    { Assert-ViewPayload $sd }
    'summary' { Assert-SummaryPayload $sd }
    'meta'    { Assert-MetaPayload $sd }
    default   { throw "모르는 payload kind: $($sd.kind)" }
  }
}

function Invoke-SheetPayload($xl, $wb, $sd) {
  switch ([string]$sd.kind) {
    'table'   { return Write-TableSheet $wb $sd }
    'view'    { return Write-ViewSheet $wb $sd }
    'summary' { return Write-SummarySheet $xl $wb $sd }
    'meta'    { return Write-MetaSheet $wb $sd }
    default   { throw "모르는 payload kind: $($sd.kind)" }
  }
}

# ---------------------------------------------------------------- table
# 수식을 쓴 범위가 전부 수식인가 — '@' 칸에 들어간 수식은 글자로 굳고, verify(openpyxl)는 수식과 '=' 글자를
# 가르지 못한다. 여기서만 막을 수 있다. HasFormula 는 섞이면 $null, 없으면 $false
function Assert-HasFormula($range, [string]$what) {
  $has = $range.HasFormula
  if ($has -ne $true) { throw "$what — 수식이 글자로 들어감(HasFormula=$has)" }
}

# 칸 종류별 서식 — textColumns 열은 통째로 '@', 나머지는 칸 종류 구간마다. P 는 Set-TableValues 가 수식 직전에 General
function Set-TableFormats($ws, $rows, $textColumns) {
  $text = @($textColumns | ForEach-Object { [string]$_ })
  $last = $TableFirstRow + $rows.Count - 1
  for ($c = 1; $c -le $TableWidth; $c++) {
    if ($c -eq $PCol) { continue }
    $whole = $ws.Range($ws.Cells($TableFirstRow, $c), $ws.Cells($last, $c))
    if ($text -contains (Get-ColumnLetter $c)) { $whole.NumberFormat = '@'; continue }
    $kinds = [string[]]@(foreach ($r in $rows) { Get-CellKind @($r)[$c - 1] })
    $runs = Get-FormatRuns $kinds
    foreach ($run in $runs) {
      $fmt = '@'
      if ($run[2] -eq 'n') { $fmt = 'General' }
      $ws.Range($ws.Cells($TableFirstRow + $run[0], $c), $ws.Cells($TableFirstRow + $run[1], $c)).NumberFormat = $fmt
    }
  }
}

# 값은 한 덩어리 Value2(P 자리는 비움), P 는 General → Formula → HasFormula 확인
function Set-TableValues($ws, $rows) {
  $n = $rows.Count
  $vals = New-Object 'object[,]' $n, $TableWidth
  $forms = New-Object 'object[,]' $n, 1
  for ($r = 0; $r -lt $n; $r++) {
    $cells = @($rows[$r])
    for ($c = 0; $c -lt $TableWidth; $c++) {
      if ($c -eq $PCol - 1) { $forms[$r, 0] = [string]$cells[$c]; continue }
      $vals[$r, $c] = ConvertTo-CellValue $cells[$c]
    }
  }
  $last = $TableFirstRow + $n - 1
  Set-RangeProperty $ws.Range($ws.Cells($TableFirstRow, 1), $ws.Cells($last, $TableWidth)) 'Value2' $vals
  $p = $ws.Range($ws.Cells($TableFirstRow, $PCol), $ws.Cells($last, $PCol))
  $p.NumberFormat = 'General'
  Set-RangeProperty $p 'Formula' $forms
  Assert-HasFormula $p "$($ws.Name) P열"
}

function Write-TableSheet($wb, $sd) {
  $ws = $wb.Worksheets.Item([string]$sd.sheet)
  $rows = @($sd.rows)
  $n = $rows.Count
  $before = [int]$sd.beforeRows
  if ($n -gt 0) {
    Set-TableFormats $ws $rows $sd.textColumns
    Set-TableValues $ws $rows
  }
  if ($before -gt $n) {
    [void]$ws.Range($ws.Cells($TableFirstRow + $n, 1), $ws.Cells($TableFirstRow + $before - 1, $TableWidth)).ClearContents()
  }
  return ("{0}={1}" -f $sd.sheet, $n)
}

# ---------------------------------------------------------------- meta (_수정)
function Get-UsedLastRow($ws) {
  $u = $ws.UsedRange
  return $u.Row + $u.Rows.Count - 1
}

# 있으면 맨 끝으로(verify 가 맨 끝을 요구한다), 없으면 맨 끝 시트 뒤에 만든다
function Get-MetaSheet($wb, [string]$name) {
  foreach ($s in $wb.Worksheets) {
    if ($s.Name -eq $name) {
      if ($s.Index -ne $wb.Sheets.Count) { [void]$s.Move([Type]::Missing, $wb.Sheets.Item($wb.Sheets.Count)) }
      return $s
    }
  }
  $ws = $wb.Worksheets.Add([Type]::Missing, $wb.Sheets.Item($wb.Sheets.Count))
  $ws.Name = $name
  return $ws
}

function Write-MetaSheet($wb, $sd) {
  $ws = Get-MetaSheet $wb ([string]$sd.sheet)
  $ws.Visible = 0
  $header = @($sd.header)
  $rows = @($sd.rows)
  $m = $rows.Count + 1
  $old = Get-UsedLastRow $ws
  # 값보다 먼저 A~G 전부 텍스트 — 키·값·기록일이 숫자·날짜로 바뀌면 다음 실행의 str 비교가 갈린다
  $all = $ws.Range($ws.Cells(1, 1), $ws.Cells([Math]::Max($m, $old), $MetaWidth))
  $all.NumberFormat = '@'
  $vals = New-Object 'object[,]' $m, $MetaWidth
  for ($c = 0; $c -lt $MetaWidth; $c++) { $vals[0, $c] = [string]$header[$c] }
  for ($r = 0; $r -lt $rows.Count; $r++) {
    $cells = @($rows[$r])
    for ($c = 0; $c -lt $MetaWidth; $c++) {
      $s = [string]$cells[$c]
      if ($s -eq '') { $vals[$r + 1, $c] = $null } else { $vals[$r + 1, $c] = $s }
    }
  }
  Set-RangeProperty $ws.Range($ws.Cells(1, 1), $ws.Cells($m, $MetaWidth)) 'Value2' $vals
  if ($old -gt $m) { [void]$ws.Range($ws.Cells($m + 1, 1), $ws.Cells($old, $MetaWidth)).ClearContents() }
  return ("{0}={1}" -f $sd.sheet, $rows.Count)
}
