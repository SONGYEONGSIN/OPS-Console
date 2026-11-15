<#
01~03 보기 시트를 숨김 표 n 행에 맞춘다 — excel_sheets.ps1 이 dot-source 한다(정의뿐).

payload(views.py): {kind:view, sheet, source, rows:n, oldRows, sourceNote:"A4", noteText, countCell, countFormula,
                    rowFormulas:[[…]] (9~n+8행), cf:[{range, newRange}] (openpyxl sqref, 공백 구분)}
- 옛 끝 = 8 + oldRows(시트의 End(xlUp) 와 대조만). 9~n+8행 수식 열은 General → Formula → HasFormula 확인.
  rowFormulas 를 Formula 로. 새로 생긴 행의 서식은 9행에서 칸별 속성으로 옮긴다
  (Copy 는 조건부 서식까지 복제해 CF 묶음 수가 늘어난다). n+9행부터 옛 끝까지는 ClearContents 뒤 선(위 선 빼고)을
  없음으로, 높이를 기본으로(Clear-ViewTail — ClearFormats 는 CF 를 갈라 쓰지 않는다).
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
  $changed = 0
  foreach ($p in $plan) {
    foreach ($fc in $p.Hits) {
      if ($p.Old -ne $p.New) { [void]$fc.ModifyAppliesToRange($ws.Range($p.Com)) }
      $changed++
    }
  }
  # 판정은 다시 세기 — ModifyAppliesToRange 가 조용히 안 먹은 것도 여기서 드러난다
  foreach ($p in $plan) {
    $now = (Get-CfAt $ws $p.New).Count
    if ($now -ne $p.Hits.Count + $p.AtNew) { throw "조건부 서식 바꾼 수 다름: $($p.New) 기대 $($p.Hits.Count + $p.AtNew) / 실제 $now" }
  }
  return $changed
}

# 수식이 있어야 할 열 번호(1부터) — rowFormulas 첫 행에서 '=' 로 시작하는 칸
function Get-FormulaColumns($formulas) {
  $row0 = @($formulas[0])
  return ,@(for ($j = 0; $j -lt $row0.Count; $j++) { if (([string]$row0[$j]).StartsWith('=')) { $j + 1 } })
}

# 옛 끝 = 8 + 옛 숨김 표 행 수(payload). 수식 첫 열의 End(xlUp) 와 대조만 — 다르면 각주 등 규칙 밖 칸이 있다
function Get-ViewOldLast($ws, $formulas, [int]$oldRows) {
  $oldLast = $ViewFirstRow - 1 + $oldRows
  $cols = Get-FormulaColumns $formulas
  $end = [Math]::Max($ws.Cells($ws.Rows.Count, $cols[0]).End($XlUp).Row, $ViewFirstRow - 1)
  if ($end -ne $oldLast) { throw "보기 옛 끝 $oldLast 행(8 + 옛 $oldRows) ≠ 시트 마지막 수식 $end 행" }
  return $oldLast
}

# 9~n+8행 수식 — 수식 열마다 General 을 먼저(기존 행·줄었다 다시 는 꼬리 행이 '@' 여도) → Formula → 열마다 HasFormula
function Write-ViewFormulas($ws, $formulas, [string]$sheet) {
  $n = $formulas.Count
  $width = @($formulas[0]).Count
  $newLast = $ViewFirstRow + $n - 1
  $cols = Get-FormulaColumns $formulas
  foreach ($c in $cols) { Set-ComProp $ws.Range($ws.Cells($ViewFirstRow, $c), $ws.Cells($newLast, $c)) 'NumberFormat' 'General' }
  $arr = New-Object 'object[,]' $n, $width
  for ($r = 0; $r -lt $n; $r++) {
    $cells = @($formulas[$r])
    for ($c = 0; $c -lt $width; $c++) { $arr[$r, $c] = [string]$cells[$c] }
  }
  Set-ComProp $ws.Range($ws.Cells($ViewFirstRow, 1), $ws.Cells($newLast, $width)) 'Formula' $arr
  foreach ($c in $cols) {
    Assert-HasFormula $ws.Range($ws.Cells($ViewFirstRow, $c), $ws.Cells($newLast, $c)) "$sheet $(Get-ColumnLetter $c)열"
  }
}

function Write-CountFormula($ws, [string]$cell, [string]$formula, [string]$sheet) {
  $c = $ws.Range($cell)
  Set-ComProp $c 'NumberFormat' 'General'
  Set-ComProp $c 'Formula' ([string]$formula)
  Assert-HasFormula $c "$sheet $cell"
}

function Copy-Border($from, $to) {
  if ($from.LineStyle -eq $XlNone) { Set-ComProp $to 'LineStyle' ([int]$XlNone); return }
  Set-ComProp $to 'LineStyle' ([int]$from.LineStyle); Set-ComProp $to 'Weight' ([int]$from.Weight)
  Set-ComProp $to 'Color' ([double]$from.Color)
}

function Copy-CellFormat($s, $t, [bool]$multi) {
  # 서식 복사는 Local 끼리 — pwsh 로 읽은 NumberFormat 은 'G/표준' 처럼 지역화돼 있어 InvokeMember 로 넣으면 오류 없이 엉뚱한 서식이 된다
  Set-ComProp $t 'NumberFormatLocal' ([string]$s.NumberFormatLocal)
  $sf = $s.Font; $tf = $t.Font
  Set-ComProp $tf 'Name' ([string]$sf.Name); Set-ComProp $tf 'Size' ([double]$sf.Size); Set-ComProp $tf 'Bold' ([bool]$sf.Bold)
  Set-ComProp $tf 'Italic' ([bool]$sf.Italic); Set-ComProp $tf 'Color' ([double]$sf.Color); Set-ComProp $tf 'Underline' ([int]$sf.Underline)
  Set-ComProp $t 'HorizontalAlignment' ([int]$s.HorizontalAlignment); Set-ComProp $t 'VerticalAlignment' ([int]$s.VerticalAlignment)
  Set-ComProp $t 'WrapText' ([bool]$s.WrapText)
  if ($s.IndentLevel -gt 0) { Set-ComProp $t 'IndentLevel' ([int]$s.IndentLevel) }
  if ($s.Interior.Pattern -eq $XlNone) { Set-ComProp $t.Interior 'Pattern' ([int]$XlNone) }
  else { Set-ComProp $t.Interior 'Pattern' ([int]$s.Interior.Pattern); Set-ComProp $t.Interior 'Color' ([double]$s.Interior.Color) }
  Copy-Border $s.Borders(7) $t.Borders(7)     # 왼쪽
  Copy-Border $s.Borders(10) $t.Borders(10)   # 오른쪽
  Copy-Border $s.Borders(9) $t.Borders(9)     # 아래
  if ($multi) { Copy-Border $s.Borders(9) $t.Borders(12) }  # 행 사이 = 9행의 아래 선
}

# 새 행(from~to)에 9행 서식 — 열마다 한 번에
function Copy-RowFormat($ws, [int]$from, [int]$to, [int]$width) {
  if ($to -lt $from) { return }
  Set-ComProp $ws.Range("$($from):$($to)") 'RowHeight' ([double]$ws.Rows($ViewFirstRow).RowHeight)
  for ($c = 1; $c -le $width; $c++) {
    $t = $ws.Range($ws.Cells($from, $c), $ws.Cells($to, $c))
    Copy-CellFormat $ws.Cells($ViewFirstRow, $c) $t ($to -gt $from)
  }
}

# 줄면 남는 행(from~to) — 내용 다음에 선·높이도 지운다. 그대로 두면 빈 줄에 선이 그어진 채 남아 표가 새 끝에서
# 닫히지 않는다(D1). 위 선(8)은 건드리지 않는다: Excel 은 그 선을 새 마지막 줄의 아래 선과 같은 선으로 본다.
# ClearFormats 는 쓰지 않는다 — 아직 옛 CF 범위 안인 이 행을 갈라 뒤의 Update-ViewCf 가 옛 키를 못 찾는다
function Clear-ViewTail($ws, [int]$from, [int]$to, [int]$width, [int]$newLast) {
  $tail = $ws.Range($ws.Cells($from, 1), $ws.Cells($to, $width))
  $sides = @(7, 9, 10)                 # 왼쪽·아래·오른쪽
  if ($width -gt 1) { $sides += 11 }   # 칸 사이
  if ($to -gt $from) { $sides += 12 }  # 행 사이
  foreach ($i in $sides) { Set-ComProp $tail.Borders($i) 'LineStyle' ([int]$XlNone) }
  Set-ComProp $ws.Range("$($from):$($to)") 'RowHeight' ([double]$ws.StandardHeight)
  # 새 마지막 줄의 아래 선은 9행 것으로 다시 — 남는 행을 지운 일이 닫는 선을 건드리지 않게
  for ($c = 1; $c -le $width; $c++) { Copy-Border $ws.Cells($ViewFirstRow, $c).Borders(9) $ws.Cells($newLast, $c).Borders(9) }
}

function Assert-ViewPayload($sd) {
  $n = [int]$sd.rows
  $f = @($sd.rowFormulas)
  if ($n -lt 1 -or $f.Count -ne $n) { throw "$($sd.sheet): rowFormulas $($f.Count) ≠ rows $n" }
  if ($null -eq $sd.oldRows -or [int]$sd.oldRows -lt 1) { throw "$($sd.sheet): oldRows(옛 숨김 표 행 수) 없음" }
  if ((Get-FormulaColumns $f).Count -eq 0) { throw "$($sd.sheet): 행 수식이 없다" }
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
  $oldLast = Get-ViewOldLast $ws $formulas ([int]$sd.oldRows)
  $newLast = $ViewFirstRow + $n - 1
  # 수식 먼저(General → Formula → HasFormula), 새 행 서식은 그 뒤 — 들어간 수식은 서식이 바뀌어도 글자가 되지 않는다
  Write-ViewFormulas $ws $formulas ([string]$sd.sheet)
  Copy-RowFormat $ws ($oldLast + 1) $newLast $width
  if ($oldLast -gt $newLast) {
    $u = $ws.UsedRange
    $lastCol = [Math]::Max($width, $u.Column + $u.Columns.Count - 1)
    [void]$ws.Range($ws.Cells($newLast + 1, 1), $ws.Cells($oldLast, $lastCol)).ClearContents()
    Clear-ViewTail $ws ($newLast + 1) $oldLast $width $newLast
  }
  Write-CountFormula $ws ([string]$sd.countCell) ([string]$sd.countFormula) ([string]$sd.sheet)
  Set-ComProp $ws.Range([string]$sd.sourceNote) 'Value2' ([string]$sd.noteText)
  $moved = Update-ViewCf $ws $sd.cf
  return ("{0}={1} cf={2}" -f $sd.sheet, $n, $moved)
}
