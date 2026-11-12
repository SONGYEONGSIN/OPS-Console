<#
01~03 보기 시트를 숨김 표 n 행에 맞춘다 — excel_sheets.ps1 이 dot-source 한다(정의뿐).

payload(views.py): {kind:view, sheet, source, rows:n, sourceNote:"A4", noteText, countCell, countFormula,
                    rowFormulas:[[…]] (9~n+8행), cf:[{range, newRange}] (openpyxl sqref, 공백 구분)}
- 9~n+8행에 rowFormulas 를 Formula 로. 새로 생긴 행의 서식은 9행에서 칸별 속성으로 옮긴다
  (Copy 는 조건부 서식까지 복제해 CF 묶음 수가 늘어난다). n+9행부터 옛 끝까지는 ClearContents.
- CF: cf[].range 와 AppliesTo.Address(False, False) 를 `$`·쉼표·공백·순서를 지운 키로 맞춰 규칙마다
  ModifyAppliesToRange(newRange). 같은 범위에 규칙이 여럿이면 전부 바꾸고, 다시 세어 수가 다르면 멈춘다.
#>
$ViewFirstRow = 9
$XlUp = -4162
$XlNone = -4142

# 주소 → 비교 키: `$` 제거, 쉼표·공백으로 쪼개 대문자, `E9:E9` → `E9`, 정렬(ordinal) 후 쉼표로
function ConvertTo-RangeKey([string]$address) {
  $parts = New-Object System.Collections.ArrayList
  foreach ($p in (($address -replace '\$', '') -split '[,\s]+')) {
    if ($p -eq '') { continue }
    $u = $p.ToUpperInvariant()
    $ends = $u.Split(':')
    if ($ends.Count -eq 2 -and $ends[0] -eq $ends[1]) { $u = $ends[0] }
    [void]$parts.Add($u)
  }
  $arr = [string[]]$parts.ToArray()
  [Array]::Sort($arr, [StringComparer]::Ordinal)
  return ($arr -join ',')
}

# openpyxl sqref(공백 구분) → COM Range 주소(쉼표 구분)
function ConvertTo-ComAddress([string]$sqref) {
  return ((@($sqref -split '\s+') | Where-Object { $_ -ne '' }) -join ',')
}

function Get-CfAt($ws, [string]$key) {
  $fcs = $ws.Cells.FormatConditions
  $out = New-Object System.Collections.ArrayList
  for ($i = 1; $i -le $fcs.Count; $i++) {
    $fc = $fcs.Item($i)
    if ((ConvertTo-RangeKey $fc.AppliesTo.Address($false, $false)) -eq $key) { [void]$out.Add($fc) }
  }
  return ,$out.ToArray()
}

# 바꾸기 전에 전부 찾아 둔다(앞 항목을 바꾼 결과가 뒤 항목 찾기에 섞이지 않게). 돌려주는 값 = 바꾼 규칙 수
function Update-ViewCf($ws, $cf) {
  $plan = New-Object System.Collections.ArrayList
  foreach ($e in @($cf)) {
    $old = ConvertTo-RangeKey ([string]$e.range); $new = ConvertTo-RangeKey ([string]$e.newRange)
    $hits = Get-CfAt $ws $old
    if ($hits.Count -eq 0) { throw "조건부 서식 범위 $old 를 못 찾음" }
    $atNew = (Get-CfAt $ws $new).Count
    if ($old -eq $new) { $atNew -= $hits.Count }
    [void]$plan.Add([pscustomobject]@{ Old = $old; New = $new; Com = (ConvertTo-ComAddress ([string]$e.newRange)); Hits = $hits; AtNew = $atNew })
  }
  $changed = 0; $expected = 0
  foreach ($p in $plan) {
    $expected += $p.Hits.Count
    foreach ($fc in $p.Hits) {
      if ($p.Old -ne $p.New) { [void]$fc.ModifyAppliesToRange($ws.Range($p.Com)) }
      $changed++
    }
  }
  foreach ($p in $plan) {
    $now = (Get-CfAt $ws $p.New).Count
    if ($now -ne $p.Hits.Count + $p.AtNew) { throw "조건부 서식 바꾼 수 다름: $($p.New) 기대 $($p.Hits.Count + $p.AtNew) / 실제 $now" }
  }
  if ($changed -ne $expected) { throw "조건부 서식 바꾼 수 다름: 기대 $expected / 실제 $changed" }
  return $changed
}

# 옛 데이터 끝 행 = 수식이 있는 첫 열의 마지막 칸(수식이 빈 글자를 내도 End 는 칸으로 본다), 8 이상
function Get-ViewOldLast($ws, $formulas) {
  $row0 = @($formulas[0])
  for ($j = 0; $j -lt $row0.Count; $j++) {
    if ([string]$row0[$j] -ne '') {
      $end = $ws.Cells($ws.Rows.Count, $j + 1).End($XlUp).Row
      return [Math]::Max($end, $ViewFirstRow - 1)
    }
  }
  throw "행 수식이 전부 빈 칸"
}

# cf 의 9행 시작 범위 끝(= 8 + 옛 행 수)과 시트에서 잰 옛 끝이 같아야 한다 — 다르면 각주 등 규칙 밖 칸이 있다
function Assert-ViewOldLast($cf, [int]$oldLast) {
  foreach ($e in @($cf)) {
    foreach ($part in (([string]$e.range) -split '\s+')) {
      if ($part -match '^\$?[A-Z]+\$?9:\$?[A-Z]+\$?(\d+)$' -and [int]$Matches[1] -ne $oldLast) {
        throw "보기 옛 끝 $oldLast 행 ≠ 조건부 서식 끝 $($Matches[1]) 행"
      }
    }
  }
}

function Copy-Border($from, $to) {
  if ($from.LineStyle -eq $XlNone) { $to.LineStyle = $XlNone; return }
  $to.LineStyle = $from.LineStyle; $to.Weight = $from.Weight; $to.Color = $from.Color
}

function Copy-CellFormat($s, $t, [bool]$multi) {
  $t.NumberFormat = $s.NumberFormat
  $t.Font.Name = $s.Font.Name; $t.Font.Size = $s.Font.Size; $t.Font.Bold = $s.Font.Bold
  $t.Font.Italic = $s.Font.Italic; $t.Font.Color = $s.Font.Color; $t.Font.Underline = $s.Font.Underline
  $t.HorizontalAlignment = $s.HorizontalAlignment; $t.VerticalAlignment = $s.VerticalAlignment; $t.WrapText = $s.WrapText
  if ($s.IndentLevel -gt 0) { $t.IndentLevel = $s.IndentLevel }
  if ($s.Interior.Pattern -eq $XlNone) { $t.Interior.Pattern = $XlNone }
  else { $t.Interior.Pattern = $s.Interior.Pattern; $t.Interior.Color = $s.Interior.Color }
  Copy-Border $s.Borders(7) $t.Borders(7)     # 왼쪽
  Copy-Border $s.Borders(10) $t.Borders(10)   # 오른쪽
  Copy-Border $s.Borders(9) $t.Borders(9)     # 아래
  if ($multi) { Copy-Border $s.Borders(9) $t.Borders(12) }  # 행 사이 = 9행의 아래 선
}

# 새 행(from~to)에 9행 서식 — 열마다 한 번에
function Copy-RowFormat($ws, [int]$from, [int]$to, [int]$width) {
  if ($to -lt $from) { return }
  $ws.Range("$($from):$($to)").RowHeight = $ws.Rows($ViewFirstRow).RowHeight
  for ($c = 1; $c -le $width; $c++) {
    $t = $ws.Range($ws.Cells($from, $c), $ws.Cells($to, $c))
    Copy-CellFormat $ws.Cells($ViewFirstRow, $c) $t ($to -gt $from)
  }
}

function Assert-ViewPayload($sd) {
  $n = [int]$sd.rows
  $f = @($sd.rowFormulas)
  if ($n -lt 1 -or $f.Count -ne $n) { throw "$($sd.sheet): rowFormulas $($f.Count) ≠ rows $n" }
  $w = @($f[0]).Count
  foreach ($row in $f) { if (@($row).Count -ne $w -or $w -lt 1) { throw "$($sd.sheet): 행 수식 칸 수가 다름" } }
  if (-not ([string]$sd.countFormula).StartsWith('=')) { throw "$($sd.sheet): countFormula 가 수식 아님" }
  if ([string]$sd.sourceNote -notmatch '^A[1-8]$') { throw "$($sd.sheet): sourceNote 가 A1~A8 아님" }
  foreach ($e in @($sd.cf)) { if (-not $e.range -or -not $e.newRange) { throw "$($sd.sheet): cf 항목에 range·newRange 없음" } }
}

function Write-ViewSheet($wb, $sd) {
  $ws = $wb.Worksheets.Item([string]$sd.sheet)
  $n = [int]$sd.rows
  $formulas = @($sd.rowFormulas)
  $width = @($formulas[0]).Count
  $oldLast = Get-ViewOldLast $ws $formulas
  Assert-ViewOldLast $sd.cf $oldLast
  $newLast = $ViewFirstRow + $n - 1
  $arr = New-Object 'object[,]' $n, $width
  for ($r = 0; $r -lt $n; $r++) {
    $cells = @($formulas[$r])
    for ($c = 0; $c -lt $width; $c++) { $arr[$r, $c] = [string]$cells[$c] }
  }
  # 수식 먼저, 서식은 그 뒤 — 9행이 '@' 여도 이미 들어간 수식은 글자가 되지 않는다
  Set-RangeProperty $ws.Range($ws.Cells($ViewFirstRow, 1), $ws.Cells($newLast, $width)) 'Formula' $arr
  Copy-RowFormat $ws ($oldLast + 1) $newLast $width
  if ($oldLast -gt $newLast) {
    $u = $ws.UsedRange
    $lastCol = [Math]::Max($width, $u.Column + $u.Columns.Count - 1)
    [void]$ws.Range($ws.Cells($newLast + 1, 1), $ws.Cells($oldLast, $lastCol)).ClearContents()
  }
  $ws.Range([string]$sd.countCell).Formula = [string]$sd.countFormula
  $ws.Range([string]$sd.sourceNote).Value2 = [string]$sd.noteText
  $moved = Update-ViewCf $ws $sd.cf
  return ("{0}={1} cf={2}" -f $sd.sheet, $n, $moved)
}
