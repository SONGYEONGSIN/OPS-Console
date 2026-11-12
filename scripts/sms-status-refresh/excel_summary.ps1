<#
「00. 요약」을 출처 배치로 다시 쓴다 — excel_sheets.ps1 이 dot-source 한다(정의뿐).

payload(summary_sheet.py): {kind:summary, sheet, rows, links:{칸:"시트!셀"}, merged:[…], tips:{칸:툴팁},
                            styles:{칸:스타일 키}, layout:{rowHeights, colWidths, gridlines}, warnings}
순서: ClearHyperlinks·UnMerge·Cells.Clear → 값 → 병합 → 하이퍼링크(ScreenTip = tips) → 스타일 → 행 높이·열 너비·눈금선.
- 스타일은 출처 layout.py(put·link·font·HEAD_B·ROW_B·TOT_B·TOTAL)·summary.py(section·line·note) 를 키별로 옮겼다.
  색도 출처 ARGB 값 그대로(ps1 이라 디자인 토큰 대상 아님).
- 행 높이·열 너비 표는 summary_layout.py 하나뿐 — payload layout 으로 받는다.
- Cells.Clear 는 조건부 서식·유효성까지 지운다. 출처 summary.py 는 요약에 둘 다 만들지 않고 사전 확인에서도
  요약 CF·유효성은 나오지 않았다 — 보존할 것이 없다고 보고, 있으면 지우기 전에 멈춘다(지운 채 저장하지 않는다).
  틀 고정은 창 속성이라 Clear 가 건드리지 않는다.
#>
$SumFont = 'NanumGothic'
$SumBlack = 'FF000000'; $SumLine = 'FFE7E6E6'; $SumLink = 'FF0563C1'; $SumFoot = 'FF808080'; $SumTotal = 'FFF2F2F2'

function ConvertTo-OleColor([string]$argb) {
  $r = [Convert]::ToInt32($argb.Substring(2, 2), 16)
  $g = [Convert]::ToInt32($argb.Substring(4, 2), 16)
  $b = [Convert]::ToInt32($argb.Substring(6, 2), 16)
  return $r + 256 * $g + 65536 * $b
}

# 출처 layout.font(size, bold, color, link)
function Set-SumFont($c, [double]$size, [bool]$bold, [string]$color, [bool]$link) {
  $c.Font.Name = $SumFont; $c.Font.Size = $size; $c.Font.Bold = $bold
  $c.Font.Color = ConvertTo-OleColor $color
  if ($link) { $c.Font.Underline = 2 } else { $c.Font.Underline = -4142 }
}

# 출처 CEN(가운데·가운데·줄바꿈) / LEFT(왼쪽·가운데·들여쓰기 1·줄바꿈)
function Set-SumAlign($c, [string]$how) {
  $c.VerticalAlignment = -4108; $c.WrapText = $true
  if ($how -eq 'l') { $c.HorizontalAlignment = -4131; $c.IndentLevel = 1 } else { $c.HorizontalAlignment = -4108 }
}

# 가는 실선 한 변 (8 위 · 9 아래)
function Set-SumEdge($c, [int]$edge, [string]$color) {
  $b = $c.Borders($edge); $b.LineStyle = 1; $b.Weight = 2; $b.Color = ConvertTo-OleColor $color
}

# 출처 TOT_B(위 검은 선) + TOTAL(회색 바탕)
function Set-SumTotal($c) {
  Set-SumEdge $c 8 $SumBlack
  $c.Interior.Pattern = 1; $c.Interior.Color = ConvertTo-OleColor $SumTotal
}

function Set-SummaryStyle($c, [string]$key) {
  switch ($key) {
    'title'       { Set-SumFont $c 14 $true $SumBlack $false }
    'intro'       { Set-SumFont $c 10 $false $SumBlack $false }
    'section'     { Set-SumFont $c 12 $true $SumBlack $false }
    'foot'        { Set-SumFont $c 9 $false $SumFoot $false }
    'head'        { Set-SumFont $c 10 $true $SumBlack $false; Set-SumAlign $c 'c'; Set-SumEdge $c 9 $SumBlack }
    'label'       { Set-SumFont $c 10 $false $SumBlack $false; Set-SumAlign $c 'l'; Set-SumEdge $c 9 $SumLine }
    'cell'        { Set-SumFont $c 10 $false $SumBlack $false; Set-SumAlign $c 'c'; Set-SumEdge $c 9 $SumLine }
    'link'        { Set-SumFont $c 10 $false $SumLink $true; Set-SumAlign $c 'c'; Set-SumEdge $c 9 $SumLine }
    'list'        { Set-SumFont $c 10 $false $SumBlack $false; Set-SumAlign $c 'l'; Set-SumEdge $c 9 $SumLine }
    'label-total' { Set-SumFont $c 10 $true $SumBlack $false; Set-SumAlign $c 'l'; Set-SumTotal $c }
    'cell-total'  { Set-SumFont $c 10 $true $SumBlack $false; Set-SumAlign $c 'c'; Set-SumTotal $c }
    'link-total'  { Set-SumFont $c 10 $true $SumLink $true; Set-SumAlign $c 'c'; Set-SumTotal $c }
    default       { throw "모르는 요약 스타일: $key" }
  }
}

function Assert-SummaryPayload($sd) {
  $n = @($sd.rows).Count
  if ($null -eq $sd.layout -or @($sd.layout.rowHeights).Count -ne $n) { throw "$($sd.sheet): layout.rowHeights ≠ 행 수 $n" }
  if (@($sd.layout.colWidths).Count -lt 1) { throw "$($sd.sheet): layout.colWidths 없음" }
  foreach ($p in $sd.links.PSObject.Properties) {
    if (([string]$p.Value).IndexOf('!') -lt 1) { throw "$($sd.sheet): 링크 대상 모양이 시트!셀 아님($($p.Name))" }
    if (-not [string]$sd.tips.($p.Name)) { throw "$($sd.sheet): 링크 $($p.Name) 에 툴팁 없음" }
  }
}

# Clear 가 지울 것 중 원본에 있으면 안 되는 것(조건부 서식·유효성) — 있으면 멈춘다
function Assert-SummaryClearable($ws) {
  $cf = $ws.Cells.FormatConditions.Count
  if ($cf -gt 0) { throw "요약에 조건부 서식 $cf 개 — Cells.Clear 가 지운다" }
  $dv = 0
  # SpecialCells 는 해당 칸이 없으면 오류를 낸다 — 그 오류가 '유효성 없음' 이다
  try { $dv = $ws.Cells.SpecialCells(-4174).Count } catch { $dv = 0 }
  if ($dv -gt 0) { throw "요약에 유효성 $dv 칸 — Cells.Clear 가 지운다" }
}

# 문자열은 '@' 먼저(사람이 쓴 확인 필요 유형·대상이 수식·숫자로 바뀌지 않게), 숫자는 General(Clear 기본)
function Write-SummaryValues($ws, $rows) {
  for ($r = 0; $r -lt $rows.Count; $r++) {
    $cells = @($rows[$r])
    for ($c = 0; $c -lt $cells.Count; $c++) {
      $k = Get-CellKind $cells[$c]
      if ($k -eq '') { continue }
      $cell = $ws.Cells($r + 1, $c + 1)
      if ($k -eq 't') { $cell.NumberFormat = '@' }
      $cell.Value2 = ConvertTo-CellValue $cells[$c]
    }
  }
}

# SubAddress = '시트'!셀, ScreenTip = tips — 매크로가 툴팁 낫표 안 값을 검색 칸에 넣는다
function Add-SummaryLinks($ws, $sd) {
  foreach ($p in $sd.links.PSObject.Properties) {
    $loc = [string]$p.Value
    $i = $loc.LastIndexOf('!')
    $sub = "'" + $loc.Substring(0, $i).Replace("'", "''") + "'!" + $loc.Substring($i + 1)
    $tip = [string]$sd.tips.($p.Name)
    $anchor = $ws.Range($p.Name)
    $keep = $anchor.Value2
    [void]$ws.Hyperlinks.Add($anchor, '', $sub, $tip)
    $anchor.Value2 = $keep   # 표시 글자로 값이 글자가 되지 않게 숫자로 되돌린다
  }
}

# 병합 칸의 왼쪽 위(확인 필요 대상 `list`)는 나중에 — 병합 안 다른 칸의 `cell` 정렬이 병합 전체를 덮지 않게
function Set-SummaryStyles($ws, $sd) {
  $heads = @{}
  foreach ($m in @($sd.merged)) { $heads[([string]$m).Split(':')[0]] = $true }
  foreach ($pass in 0, 1) {
    foreach ($p in $sd.styles.PSObject.Properties) {
      if ($heads.ContainsKey($p.Name) -ne ($pass -eq 1)) { continue }
      Set-SummaryStyle $ws.Range($p.Name) ([string]$p.Value)
    }
  }
}

function Set-SummaryLayout($xl, $ws, $layout) {
  $ws.Rows.RowHeight = $ws.StandardHeight
  $h = @($layout.rowHeights)
  for ($r = 0; $r -lt $h.Count; $r++) { if ($null -ne $h[$r]) { $ws.Rows($r + 1).RowHeight = [double]$h[$r] } }
  $w = @($layout.colWidths)
  for ($c = 0; $c -lt $w.Count; $c++) { $ws.Columns($c + 1).ColumnWidth = [double]$w[$c] }
  [void]$ws.Activate()
  $xl.ActiveWindow.DisplayGridlines = [bool]$layout.gridlines
}

function Write-SummarySheet($xl, $wb, $sd) {
  $ws = $wb.Worksheets.Item([string]$sd.sheet)
  Assert-SummaryClearable $ws
  [void]$ws.Cells.ClearHyperlinks()
  [void]$ws.Cells.UnMerge()
  [void]$ws.Cells.Clear()
  Write-SummaryValues $ws @($sd.rows)
  foreach ($m in @($sd.merged)) { [void]$ws.Range([string]$m).Merge() }
  Add-SummaryLinks $ws $sd
  Set-SummaryStyles $ws $sd
  Set-SummaryLayout $xl $ws $sd.layout
  return ("{0}={1} links={2}" -f $sd.sheet, @($sd.rows).Count, @($sd.links.PSObject.Properties).Count)
}
