"""PR-3b 시트 쓰기 ps1(excel_sheets·excel_view·excel_summary) 원문 대조 — PowerShell 은 이 PC 에서 Excel 을 띄워
볼 수 없다. 지켜야 할 줄을 원문으로 보고, 순수 함수는 dot-source 해 가짜 COM 으로 돌린다.
poll-local·register·excel_apply 와 pims_collect 대조는 test_ps_static.py 에 있다.
"""
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from test_ps_static import code_of, function_text

HERE = Path(__file__).resolve().parent

SHEET_PS = ("excel_sheets.ps1", "excel_view.ps1", "excel_summary.ps1")  # PR-3b 시트 쓰기(dot-source)
WRITE_PS = ("excel_apply.ps1", *SHEET_PS)


def ps_code(name: str) -> str:
    """블록 주석(<# … #>)과 '#' 줄을 지운 원문 — 머리 설명에 적힌 금지어가 대조에 걸리지 않게."""
    text = re.sub(r"<#.*?#>", "", (HERE / name).read_text(encoding="utf-8-sig"), flags=re.S)
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))


def functions_text(source: str, *names: str) -> str:
    return "\n".join(function_text(source, n) for n in names)


class TestExcelSheets(unittest.TestCase):
    """excel_sheets.ps1·excel_view.ps1·excel_summary.ps1 — 실제 Excel 은 T15 에서. 여기서는 지킬 줄을 원문으로 본다."""
    @classmethod
    def setUpClass(cls):
        cls.code = {n: ps_code(n) for n in WRITE_PS}
        cls.sheets = "\n".join(cls.code[n] for n in SHEET_PS)

    def test_Delete_Insert_Copy_Save_없음(self):
        # 지우기·끼우기는 참조를 끊고, Copy 는 조건부 서식까지 복제하며, 중간 저장은 반쯤 쓴 파일을 남긴다.
        for name, src in self.code.items():
            for banned in (".Delete(", ".Insert(", ".Copy(", ".Cut(", "PasteSpecial", "SaveAs"):
                self.assertNotIn(banned, src, f"{name}: {banned}")
        self.assertNotRegex(self.sheets, r"\.Save\(")
        self.assertEqual(self.code["excel_apply.ps1"].count(".Save("), 1)

    def test_표는_U_를_안_쓴다(self):
        # U(고를 값)는 이름 정의 `고를값_*` 와 P 수식 `$U$2:$U$N` 이 박고 있다 — 쓰는 열은 A~T 스무 칸뿐.
        self.assertRegex(self.code["excel_sheets.ps1"], r"(?m)^\$TableWidth = 20\b")
        fn = functions_text(self.code["excel_sheets.ps1"], "Write-TableSheet", "Set-TableFormats", "Set-TableValues")
        self.assertNotRegex(fn, r"['\"]U\$?\d*['\"]|\bU\$?\d+\b|\bU:U\b|\b21\b")
        self.assertIn("$TableWidth", fn)
        self.assertRegex(fn, r"\$TableWidth\)\)\.ClearContents\(\)")  # 남는 행도 A~T 만 비운다

    def test_계산_모드를_안_바꾼다(self):
        for name, src in self.code.items():
            self.assertNotRegex(src, r"Calculation\s*=", name)

    def test_PS7_전용_문법이_없다(self):
        # 회사 PC 폴러는 Windows PowerShell 5.1 — `??`·`?.`·삼항은 거기서 구문 오류다.
        for name, src in self.code.items():
            self.assertNotRegex(src, r"\?\?|\?\.|\)\s+\?\s+\S+\s+:\s", name)

    def test_kind_로_갈라_dot_source(self):
        xl = self.code["excel_apply.ps1"]
        self.assertRegex(xl, r"(?m)^\. \(Join-Path \$PSScriptRoot 'excel_sheets\.ps1'\)")
        self.assertIn("'compare'", xl)
        self.assertIn("Invoke-SheetPayload", xl)
        self.assertIn("Assert-SheetPayload", xl)  # Excel 을 띄우기 전에 payload 부터 본다
        for fn in ("Write-TableSheet", "Write-ViewSheet", "Write-MetaSheet", "Write-SummarySheet"):
            self.assertRegex(self.sheets, rf"(?m)^function {fn}\b")

    def test_표_문자열_칸은_서식부터_P_는_Formula(self):
        fn = function_text(self.code["excel_sheets.ps1"], "Write-TableSheet")
        self.assertLess(fn.index("Set-TableFormats"), fn.index("Set-TableValues"))
        vals = function_text(self.code["excel_sheets.ps1"], "Set-TableValues")
        self.assertIn("'Formula'", vals)
        fmts = function_text(self.code["excel_sheets.ps1"], "Set-TableFormats")
        self.assertIn("'@'", fmts)
        self.assertIn("'General'", fmts)

    def test_General_은_속성_대입이_아니라_InvokeMember_로(self):
        # 한글 Excel 은 pwsh 의 속성 대입 `.NumberFormat = 'General'` 을 0x800A03EC 로 거부한다(T15b 실측 — '@'·'0' 은 된다).
        # InvokeMember(문화권 null)로 넣은 'General' 만 받는다 — 변수로 넘기는 대입도 'General' 이 섞일 수 있어 막는다.
        for name, src in self.code.items():
            for rhs in re.findall(r"\.NumberFormat\s*=\s*([^;\r\n}]+)", src):
                rhs = rhs.strip()
                self.assertNotIn("General", rhs, f"{name}: {rhs}")
                self.assertFalse(rhs.startswith("$") and rhs != "$s.NumberFormat", f"{name}: {rhs}")
        fn = function_text(self.code["excel_sheets.ps1"], "Set-NumberFormat")
        self.assertIn("InvokeMember('NumberFormat'", fn)
        for name in ("excel_sheets.ps1", "excel_view.ps1"):
            self.assertIn("Set-NumberFormat", self.code[name], name)

    def test_한_칸_Value2_는_형이_박힌_대입이거나_InvokeMember(self):
        # pwsh 7 의 COM 바인더는 프로세스에서 처음 형 없는 값으로 넣은 Value2 의 형을 기억해, 다른 형(문자열 뒤 숫자)을
        # 다른 줄에서 넣어도 InvalidCastException 을 낸다(T15b 실측 — 요약 9행 B열). `[string]`·`[double]` 이 박힌 식이나
        # InvokeMember 는 된다 — 그래서 형이 그때그때 다른 값은 Set-Value2 로만 넣는다.
        for name, src in self.code.items():
            for rhs in re.findall(r"\.Value2\s*=\s*([^;\r\n}]+)", src):
                rhs = rhs.strip()
                self.assertRegex(rhs, r"^(\[string\]|\[double\]|'|\()", f"{name}: {rhs}")
        fn = function_text(self.code["excel_sheets.ps1"], "Set-Value2")
        self.assertIn("InvokeMember('Value2'", fn)
        self.assertIn("Set-Value2", function_text(self.code["excel_summary.ps1"], "Write-SummaryValues"))
        self.assertIn("Set-Value2", function_text(self.code["excel_summary.ps1"], "Add-SummaryLinks"))

    def test_메타는_A_G_전부_서식부터(self):
        fn = function_text(self.code["excel_sheets.ps1"], "Write-MetaSheet")
        self.assertLess(fn.index(".NumberFormat = '@'"), fn.index("Set-RangeProperty"))
        self.assertIn("$MetaWidth", fn)  # A~G 일곱 칸 전부 — 키·값만이 아니라 기록일도
        self.assertIn(".Visible = 0", fn)  # xlSheetHidden — veryHidden(2) 이 아니다
        self.assertNotIn(".Visible = 2", fn)
        self.assertIn("Worksheets.Add(", self.code["excel_sheets.ps1"])

    def test_있는_수정_시트가_맨_끝이_아니면_끝으로_옮긴다(self):
        # verify 는 `_수정` 이 맨 끝이길 요구한다(L_META_PLACE) — 뒤에 시트가 붙은 파일을 그대로 두면 매 실행 막힌다.
        # Move 는 시트 순서만 바꾼다(참조·서식은 그대로) — 금지 목록의 Delete·Insert·Copy 와 다르다.
        fn = function_text(self.code["excel_sheets.ps1"], "Get-MetaSheet")
        self.assertRegex(fn, r"\$s\.Index\s+-ne\s+\$wb\.Sheets\.Count")  # 마지막이 아닐 때만
        self.assertRegex(fn, r"\$s\.Move\(\[Type\]::Missing,\s*\$wb\.Sheets\.Item\(\$wb\.Sheets\.Count\)\)")
        self.assertLess(fn.index(".Move("), fn.index("return $s"))
        self.assertEqual(self.sheets.count(".Move("), 1)  # 다른 시트는 옮기지 않는다

    def test_뷰_서식은_칸별_속성으로(self):
        src = self.code["excel_view.ps1"]
        self.assertIn("ModifyAppliesToRange(", src)
        self.assertIn("Address($false, $false)", src)
        fn = function_text(src, "Write-ViewSheet")
        # 수식(General → Formula → HasFormula) 다음에 새 행 서식 — 순서가 바뀌면 '@' 가 수식을 글자로 만든다
        order = ["Write-ViewFormulas", "Copy-RowFormat", "Write-CountFormula", "Update-ViewCf"]
        self.assertEqual([fn.index(s) for s in order], sorted(fn.index(s) for s in order))
        self.assertIn("$sd.oldRows", fn)  # 옛 끝은 payload 의 옛 행 수로(End(xlUp) 는 대조만)

    def test_요약은_지우고_값_병합_링크_서식_순서(self):
        src = self.code["excel_summary.ps1"]
        fn = function_text(src, "Write-SummarySheet")
        order = ["Assert-SummaryClearable", "ClearHyperlinks()", "UnMerge()", "Cells.Clear()", "Write-SummaryValues", ".Merge()",
                 "Add-SummaryLinks", "Set-SummaryStyles", "Set-SummaryLayout"]
        self.assertEqual([fn.index(s) for s in order], sorted(fn.index(s) for s in order))

    def test_요약_링크는_ScreenTip_을_넘긴다(self):
        fn = function_text(self.code["excel_summary.ps1"], "Add-SummaryLinks")
        self.assertRegex(fn, r"Hyperlinks\.Add\(\$anchor, '', \$sub, \$tip\)")

    def test_요약_행_높이_열_너비는_payload_에서(self):
        # summary_layout.ROW_HEIGHT·COL_WIDTHS 가 하나뿐인 원천 — ps1 에 같은 표를 두지 않는다.
        src = self.code["excel_summary.ps1"]
        for v in ("35.1", "20.1", "30.0"):
            self.assertNotIn(v, src)
        for field in (".rowHeights", ".colWidths", ".gridlines"):
            self.assertIn(field, src)

    def test_요약_스타일_키는_summary_layout_과_같다(self):
        from summary_layout import STYLE_KEYS
        fn = function_text(self.code["excel_summary.ps1"], "Set-SummaryStyle")
        self.assertEqual(sorted(re.findall(r"(?m)^\s+'([a-z-]+)'\s+\{", fn)), sorted(STYLE_KEYS))
        self.assertIn("default", fn)


@unittest.skipUnless(shutil.which("powershell"), "Windows PowerShell 없음")
class TestExcelSheetsBehaviour(unittest.TestCase):
    """excel_sheets.ps1 을 dot-source 해(함수 정의뿐 — Excel 을 띄우지 않는다) 순수 함수·가짜 COM 으로 돌린다."""

    def run_ps(self, body: str) -> str:
        script = ("[Console]::OutputEncoding = [Text.Encoding]::UTF8\n$ErrorActionPreference = 'Stop'\n"
                  f". '{HERE / 'excel_sheets.ps1'}'\n{FAKE_CF}\n{body}")
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "t.ps1"
            path.write_text(script, encoding="utf-8-sig")
            out = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(path)],
                capture_output=True, timeout=60,
            )
        self.assertEqual(out.returncode, 0, out.stderr.decode("utf-8", "replace"))
        return out.stdout.decode("utf-8").strip()

    def test_CF_주소는_달러_쉼표_공백_순서를_정규화(self):
        got = self.run_ps("ConvertTo-RangeKey '$G$9:$G$13,$E$9:$E$13'; ConvertTo-RangeKey 'E9:E13 G9:G13';"
                          "ConvertTo-RangeKey 'e9:e9'; ConvertTo-ComAddress 'E9:E12  G9:G12'")
        self.assertEqual(got.splitlines(), ["E9:E13,G9:G13", "E9:E13,G9:G13", "E9", "E9:E12,G9:G12"])

    def test_같은_범위_규칙은_규칙마다_바꾼다(self):
        got = self.run_ps("$ws = New-FakeSheet @('$E$9:$E$13', '$E$9:$E$13', '$A$9:$H$13')\n"
                          "Update-ViewCf $ws @([pscustomobject]@{range='E9:E13'; newRange='E9:E12'})\n"
                          "($ws.Rules | ForEach-Object { $_.Addr }) -join ' / '")
        self.assertEqual(got.splitlines(), ["2", "E9:E12 / E9:E12 / $A$9:$H$13"])

    def test_범위가_안_맞으면_throw(self):
        got = self.run_ps("$ws = New-FakeSheet @('$E$9:$E$14')\n"
                          "try { Update-ViewCf $ws @([pscustomobject]@{range='E9:E13'; newRange='E9:E12'}); 'no' }"
                          " catch { 'threw' }")
        self.assertEqual(got, "threw")

    def test_바꾼_수가_다르면_throw(self):
        # ModifyAppliesToRange 가 조용히 안 먹은 경우 — 다시 세어 보고 멈춘다
        got = self.run_ps("$ws = New-FakeSheet @('$E$9:$E$13') -Stuck\n"
                          "try { Update-ViewCf $ws @([pscustomobject]@{range='E9:E13'; newRange='E9:E12'}); 'no' }"
                          " catch { 'threw' }")
        self.assertEqual(got, "threw")

    def test_칸_종류와_서식_구간(self):
        got = self.run_ps("(@('x', 3, '', [decimal]1.5, '=1') | ForEach-Object { Get-CellKind $_ }) -join ','\n"
                          "$runs = Get-FormatRuns @('t','t','','n','n','t'); (@(foreach ($x in $runs) { $x -join '-' })) -join ' '\n"
                          "try { Get-CellKind $true; 'no' } catch { 'threw' }")
        self.assertEqual(got.splitlines(), ["t,n,,n,t", "0-1-t 3-4-n 5-5-t", "threw"])

    def test_payload_검사는_Excel_전에_거른다(self):
        got = self.run_ps(
            "$ok = [pscustomobject]@{kind='table'; sheet='_학교'; beforeRows=1; columns=@(" +
            ",".join(f"'{chr(65 + i)}'" for i in range(20)) +
            "); textColumns=@('B'); rows=@(,@(1,'테스트대학교A','','','','','','','','','','','','','','=1','','','',''))}\n"
            "Assert-SheetPayload $ok; 'ok'\n"
            "$u = $ok.PSObject.Copy(); $u.columns = @($ok.columns + 'U')\n"
            "try { Assert-SheetPayload $u; 'no' } catch { 'threw-u' }\n"
            "$k = [pscustomobject]@{kind='chart'; sheet='x'}\n"
            "try { Assert-SheetPayload $k; 'no' } catch { 'threw-kind' }\n"
            "$v = [pscustomobject]@{kind='view'; sheet='v'; rows=1; rowFormulas=@(,@('=1')); countCell='L6';"
            " countFormula='=1'; sourceNote='A4'; noteText='n'; cf=@()}\n"
            "try { Assert-SheetPayload $v; 'no' } catch { 'threw-old' }\n"
            "$v | Add-Member NoteProperty oldRows 3; Assert-SheetPayload $v; 'ok-view'")
        self.assertEqual(got.splitlines(), ["ok", "threw-u", "threw-kind", "threw-old", "ok-view"])

    # ---- 수식 칸: General 을 먼저 걸고 쓴 뒤 HasFormula 를 다시 본다(verify 는 수식과 '=' 글자를 못 가른다)
    TABLE_ROW = "@(,@(1,'a','','','','','','','','','','','','','','=1','','','',''))"

    def test_표_P_는_General_후_Formula_후_확인(self):
        got = self.run_ps(f"$ws = New-FakeGrid '@'\nSet-TableValues $ws {self.TABLE_ROW}\n$ws.Log -join ' '")
        log = got.split()
        self.assertLess(log.index("fmt:c16-16:General"), log.index("formula:c16-16"))

    def test_표_P_가_글자로_굳으면_throw(self):
        got = self.run_ps(f"$ws = New-FakeGrid -Stuck\ntry {{ Set-TableValues $ws {self.TABLE_ROW}; 'no' }}"
                          " catch { $_.Exception.Message }")
        self.assertIn("P", got)
        self.assertIn("HasFormula", got)

    def test_보기_수식_열은_General_후_Formula_후_확인(self):
        got = self.run_ps("$ws = New-FakeGrid '@'\n"
                          "Write-ViewFormulas $ws @(@('=a','','=b'), @('=a','','=b')) '01'\n$ws.Log -join ' '")
        log = got.split()
        self.assertEqual([x for x in log if x.startswith("fmt:")], ["fmt:c1-1:General", "fmt:c3-3:General"])
        self.assertLess(log.index("fmt:c3-3:General"), log.index("formula:c1-3"))

    def test_보기_수식이_글자로_굳으면_시트와_열을_적고_throw(self):
        got = self.run_ps("$ws = New-FakeGrid -Stuck\n"
                          "try { Write-ViewFormulas $ws @(,@('=a','','=b')) '01. 학교별 현황'; 'no' }"
                          " catch { $_.Exception.Message }")
        self.assertIn("01. 학교별 현황", got)
        self.assertIn("A열", got)

    def test_건수_칸도_General_후_확인(self):
        ok = self.run_ps("$ws = New-FakeGrid '@'\nWrite-CountFormula $ws 'L6' '=1' '01'\n$ws.Log -join ' '")
        self.assertEqual(ok.split(), ["fmt:L6:General", "formula:L6"])
        bad = self.run_ps("$ws = New-FakeGrid -Stuck\ntry { Write-CountFormula $ws 'L6' '=1' '01'; 'no' }"
                          " catch { 'threw' }")
        self.assertEqual(bad, "threw")


# 가짜 COM — 시트.Cells.FormatConditions(Count·Item) → 규칙.AppliesTo.Address(a, b)·ModifyAppliesToRange(rng)
FAKE_CF = r"""
function New-FakeSheet([string[]]$addrs, [switch]$Stuck) {
  $rules = @(foreach ($a in $addrs) {
    $fc = [pscustomobject]@{ Addr = $a; Stuck = [bool]$Stuck }
    $ap = [pscustomobject]@{ Owner = $fc }
    $ap | Add-Member ScriptMethod Address { param($r, $c) $this.Owner.Addr }
    $fc | Add-Member NoteProperty AppliesTo $ap
    $fc | Add-Member ScriptMethod ModifyAppliesToRange { param($rng) if (-not $this.Stuck) { $this.Addr = $rng.Addr } }
    $fc
  })
  $fcs = [pscustomobject]@{ List = $rules }
  $fcs | Add-Member ScriptProperty Count { $this.List.Count }
  $fcs | Add-Member ScriptMethod Item { param($i) $this.List[$i - 1] }
  $ws = [pscustomobject]@{ Rules = $rules; Cells = [pscustomobject]@{ FormatConditions = $fcs } }
  $ws | Add-Member ScriptMethod Range { param($a) [pscustomobject]@{ Addr = $a } }
  $ws
}

# 가짜 칸 격자 — 열마다 NumberFormat 을 기억하고, Formula 를 넣는 순간의 서식이 '@' 면(또는 -Stuck) 그 열은
# HasFormula 가 거짓(Excel 이 수식을 글자로 굳히는 동작). 대입 순서는 Log 에 'fmt:열:값'·'formula:열' 로 남는다.
function New-FakeGrid([string]$Init = 'General', [switch]$Stuck) {
  $ws = [pscustomobject]@{ Log = (New-Object System.Collections.ArrayList); Init = $Init; Stuck = [bool]$Stuck
                           Fmt = @{}; Has = @{} }
  $ws | Add-Member ScriptMethod Cells { param($r, $c) [pscustomobject]@{ R = $r; C = $c } }
  $ws | Add-Member ScriptMethod Range { param($a, $b) New-FakeRange $this $a $b }
  $ws
}
function New-FakeRange($ws, $a, $b) {
  if ($a -is [string]) { $keys = @($a); $name = $a }
  else { $keys = @($a.C..$b.C | ForEach-Object { "c$_" }); $name = "c$($a.C)-$($b.C)" }
  $rg = [pscustomobject]@{ Ws = $ws; Keys = $keys; Name = $name }
  $rg | Add-Member ScriptProperty NumberFormat { '' } {
    param($v); foreach ($k in $this.Keys) { $this.Ws.Fmt[$k] = $v }; [void]$this.Ws.Log.Add("fmt:$($this.Name):$v") }
  $rg | Add-Member ScriptProperty Formula { '' } {
    param($v)
    foreach ($k in $this.Keys) {
      $f = $this.Ws.Fmt[$k]; if ($null -eq $f) { $f = $this.Ws.Init }
      $this.Ws.Has[$k] = (-not $this.Ws.Stuck) -and ($f -ne '@')
    }
    [void]$this.Ws.Log.Add("formula:$($this.Name)") }
  $rg | Add-Member ScriptProperty Value2 { $null } { param($v); [void]$this.Ws.Log.Add("value:$($this.Name)") }
  $rg | Add-Member ScriptProperty HasFormula {
    $vals = @($this.Keys | ForEach-Object { [bool]$this.Ws.Has[$_] })
    if (-not ($vals -contains $false)) { $true } elseif (-not ($vals -contains $true)) { $false } else { $null } }
  $rg
}
# 가짜에는 InvokeMember 가 없다 — 같은 이름의 속성에 그대로 대입한다
function Set-RangeProperty($range, [string]$name, $values) { $range.$name = $values }
function Set-NumberFormat($range, [string]$fmt) { $range.NumberFormat = $fmt }
"""


@unittest.skipUnless(shutil.which("powershell"), "Windows PowerShell 없음")
class TestPsParse(unittest.TestCase):
    """구문 검사만(ParseFile) — 실행하지 않는다. 5.1(회사 PC 폴러)과 7(pwsh, 있으면) 둘 다."""

    def parse_errors(self, exe: str, name: str) -> str:
        cmd = ("$e = $null; [void][System.Management.Automation.Language.Parser]::ParseFile("
               f"'{HERE / name}', [ref]$null, [ref]$e); $e.Count; $e | ForEach-Object {{ $_.Message }}")
        out = subprocess.run([exe, "-NoProfile", "-Command", cmd], capture_output=True, timeout=60)
        return out.stdout.decode("utf-8", "replace").strip()

    def test_구문_오류_0(self):
        exes = ["powershell"] + (["pwsh"] if shutil.which("pwsh") else [])
        for exe in exes:
            for name in WRITE_PS:
                self.assertEqual(self.parse_errors(exe, name).splitlines()[:1], ["0"], f"{exe} {name}")


class TestNoXlsmSave(unittest.TestCase):
    """xlsm 을 openpyxl 로 다시 저장하지 않는다 — 쓰기는 Excel COM, 매크로는 zip 파트 교체뿐."""

    def test_xlsm_재저장_금지(self):
        for f in ("workbook_step.py", "body_step.py", "verify.py", "vba.py", "compare.py", "sheet_table.py", "views.py",
                  "summary_sheet.py", "merge_schools.py", "merge_numbers.py", "sejong.py", "edits.py"):
            self.assertNotRegex(code_of(f), r"\.save\(", f)
        # PowerShell 은 메서드 이름 대소문자를 안 가린다 — 시트 쓰기 ps1 셋은 `.save(`·`.SaveAs(` 도 막는다
        for f in SHEET_PS:
            self.assertNotRegex(ps_code(f), r"(?i)\.save(as)?\(", f)


class TestEncoding(unittest.TestCase):
    def test_ps1_은_BOM_있는_UTF8(self):
        # 이 PC 의 Windows PowerShell 5.1 은 BOM 없는 파일을 CP949 로 읽어 한글 문자열이 깨진다.
        for name in ("poll-local.ps1", "register-poll-task.ps1", "excel_apply.ps1", *SHEET_PS):
            self.assertTrue((HERE / name).read_bytes().startswith(b"\xef\xbb\xbf"), name)


if __name__ == "__main__":
    unittest.main()
