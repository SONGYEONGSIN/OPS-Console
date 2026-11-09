"""vba.py — 매크로 파트 바이트 복원과 모듈 소스 해시."""
import builtins
import io
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

import fixtures
import vba
from contract import StepFailure

SHEETS = {"03. 번호 목록": [["번호"], ["010-0000-0001"]], "_학교": [["테스트대학교A"]]}
ORIGINAL = b"original-vba-project-bytes" * 40


def _with_stored(data: bytes) -> bytes:
    """압축하지 않은(STORED) 파트 하나를 더 끼운다 — 복원 뒤에도 STORED 여야 한다."""
    out = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(data)) as src, zipfile.ZipFile(out, "w") as dst:
        for info in src.infolist():
            dst.writestr(info, src.read(info.filename), compress_type=info.compress_type)
        dst.writestr("customXml/item1.xml", b"<stored/>" * 20, compress_type=zipfile.ZIP_STORED)
    return out.getvalue()


def _parts(path: Path) -> dict[str, tuple[bytes, int]]:
    with zipfile.ZipFile(path) as z:
        return {i.filename: (z.read(i.filename), i.compress_type) for i in z.infolist()}


class VbaPartTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def _write(self, name: str, data: bytes) -> Path:
        p = self.dir / name
        p.write_bytes(data)
        return p

    def test_매크로_파트를_찾는다(self):
        p = self._write("a.xlsm", fixtures.make_xlsm_like(SHEETS, ORIGINAL))
        self.assertEqual(vba.vba_part(p), ("xl/vbaProject.bin", ORIGINAL))

    def test_매크로_파트가_없으면_None(self):
        p = self._write("a.xlsx", fixtures.make_xlsx([["테스트대학교A"]]))
        self.assertIsNone(vba.vba_part(p))

    def test_원본_바이트로_되돌리고_다른_파트는_그대로(self):
        before = self._write("before.xlsm", fixtures.make_xlsm_like(SHEETS, ORIGINAL))
        after = self._write("after.xlsm", _with_stored(fixtures.make_xlsm_like(SHEETS, b"short")))
        old = _parts(after)

        with mock.patch("vba.tempfile.mkstemp", wraps=tempfile.mkstemp) as mk:
            sizes = vba.restore_vba(before, after)

        self.assertEqual(Path(mk.call_args.kwargs["dir"]).resolve(), after.resolve().parent)

        new = _parts(after)
        self.assertEqual(sizes, (len(b"short"), len(ORIGINAL)))
        self.assertEqual(new["xl/vbaProject.bin"][0], ORIGINAL)
        self.assertEqual(list(new), list(old))  # 파트 순서·목록 그대로
        self.assertEqual(new["customXml/item1.xml"], (b"<stored/>" * 20, zipfile.ZIP_STORED))
        for name, (data, ctype) in old.items():
            if name != "xl/vbaProject.bin":
                self.assertEqual(new[name], (data, ctype), name)
        self.assertEqual(sorted(p.name for p in self.dir.iterdir()), ["after.xlsm", "before.xlsm"])

    def test_매크로_파트가_없으면_verify_failed(self):
        before = self._write("before.xlsm", fixtures.make_xlsm_like(SHEETS, ORIGINAL))
        after = self._write("after.xlsx", fixtures.make_xlsx([["테스트대학교A"]]))
        untouched = after.read_bytes()

        with self.assertRaises(StepFailure) as cm:
            vba.restore_vba(before, after)

        self.assertEqual(cm.exception.code, "verify_failed")
        self.assertEqual(cm.exception.detail, "작업 사본에 매크로 파트 없음")
        self.assertEqual(after.read_bytes(), untouched)
        self.assertEqual(sorted(p.name for p in self.dir.iterdir()), ["after.xlsx", "before.xlsm"])

    def test_원본에_매크로_파트가_없어도_verify_failed(self):
        before = self._write("before.xlsx", fixtures.make_xlsx([["테스트대학교A"]]))
        after = self._write("after.xlsm", fixtures.make_xlsm_like(SHEETS, b"short"))

        with self.assertRaises(StepFailure) as cm:
            vba.restore_vba(before, after)

        self.assertEqual(cm.exception.code, "verify_failed")

    def test_oletools_없음을_숨기지_않는다(self):
        p = self._write("a.xlsm", fixtures.make_xlsm_like(SHEETS, ORIGINAL))
        real_import = builtins.__import__

        def no_oletools(name, *args, **kwargs):
            if name.split(".")[0] == "oletools":
                raise ImportError("oletools 없음(테스트)")
            return real_import(name, *args, **kwargs)

        with mock.patch("builtins.__import__", side_effect=no_oletools):
            with self.assertRaises(ImportError):
                vba.vba_module_hashes(p)


if __name__ == "__main__":
    unittest.main()
