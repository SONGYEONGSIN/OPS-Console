import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from parse import EXPECTED_HEADER, DevStatusFailure, parse_work_status  # noqa: E402

NAME = "운영자A"  # 담당자 칸 자리값 — 어디에도 새면 안 된다


def row(sid="1000001", test_open="2026-11-10 14:00:00", cells=8, span=True, real_deploy="-"):
    first = (
        f'<td class="td_block"><b>테스트대학교</b><br><span> {sid} </span></td>'
        if span
        else '<td class="td_block">테스트대학교</td>'
    )
    rest = [
        f"<td>{NAME}</td>",
        "<td>2026-12-01 ~ 2026-12-05</td>",
        "<td>-</td>",
        "<td>-</td>",
        "<td>-</td>",
        f"<td>\n  {test_open}\n</td>",
        f"<td>{real_deploy}</td>",
    ]
    return "<tr>" + first + "".join(rest[: cells - 1]) + "</tr>"


# 실제 페이지는 두 머리글 안에 <br /> 가 있다("개발<br />요청", "테스트<br />오픈")
REAL_BR = {"개발 요청": "개발<br />요청", "테스트 오픈": "테스트<br />오픈"}


def page(rows, header=EXPECTED_HEADER, table=True):
    ths = " ".join(f"<th>{REAL_BR.get(h, h)}</th>" for h in header)
    body = (
        '<table summary="작업진행현황"><caption>작업진행현황</caption>'
        '<colgroup><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>'
        f"<thead><tr>{ths}</tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>"
    )
    return f"<html><body>{body if table else '<p>로그인</p>'}</body></html>"


class ParseWorkStatusTest(unittest.TestCase):
    def assertCode(self, html, code):
        with self.assertRaises(DevStatusFailure) as cm:
            parse_work_status(html)
        self.assertEqual(cm.exception.code, code)

    def test_정상_일시와_대시가_섞여도_원문을_돌려준다(self):
        got = parse_work_status(
            page([row("1000001", "2026-11-10 14:00:00"), row("1000002", "-")])
        )
        self.assertEqual(
            got, [(1000001, "2026-11-10 14:00:00", "-"), (1000002, "-", "-")]
        )

    def test_실제_머리글_br과_caption과_colgroup이_있어도_통과한다(self):
        html = page([row()])
        self.assertIn("개발<br />요청", html)
        self.assertIn("<caption>", html)
        self.assertEqual(parse_work_status(html), [(1000001, "2026-11-10 14:00:00", "-")])

    def test_닫히지_않은_첫_행은_행_하나만_돌려주지_않는다(self):
        html = page([row("1000001").replace("</tr>", ""), row("1000002")])
        self.assertCode(html, "row_shape")

    def test_표_중간에서_잘린_응답은_실패(self):
        full = page([row("1000001"), row("1000002")])
        for marker in ("</tbody>", "1000002"):
            cut = full[: full.index(marker)]
            with self.assertRaises(DevStatusFailure) as cm:
                parse_work_status(cut)
            self.assertEqual(cm.exception.code, "table_missing")
            self.assertIn("표가 닫히지 않았다", cm.exception.reason)

    def test_td_block_클래스에_다른_토큰이_있어도_통과(self):
        html = page([row().replace('class="td_block"', 'class="x td_block y"')])
        self.assertEqual(parse_work_status(html), [(1000001, "2026-11-10 14:00:00", "-")])

    def test_속성_순서가_달라도_통과(self):
        html = page([row()]).replace(
            '<table summary="작업진행현황">', '<table class="t" id="a" summary="작업진행현황">'
        )
        self.assertEqual(parse_work_status(html), [(1000001, "2026-11-10 14:00:00", "-")])

    def test_nbsp와_공백이_ID와_테스트오픈_둘레에_있어도_통과(self):
        html = page([row("&nbsp;1000001&nbsp;", "&nbsp; 2026-11-10 14:00:00 &nbsp;")])
        self.assertEqual(parse_work_status(html), [(1000001, "2026-11-10 14:00:00", "-")])

    def test_담당자_칸_안의_중첩_표_이름은_새지_않는다(self):
        nested = row().replace(
            f"<td>{NAME}</td>", f"<td><table><tr><td>{NAME}</td></tr></table></td>"
        )
        self.assertNotIn(NAME, repr(parse_work_status(page([nested]))))
        bad = nested.replace("<td>-</td></tr>", "</tr>")
        with self.assertRaises(DevStatusFailure) as cm:
            parse_work_status(page([bad]))
        self.assertNotIn(NAME, str(cm.exception))

    def test_표_없음(self):
        self.assertCode(page([row()], table=False), "table_missing")

    def test_머리글_변경(self):
        self.assertCode(
            page([row()], header=EXPECTED_HEADER[:7] + ("배포",)), "header_changed"
        )

    def test_결과_없음_행(self):
        self.assertCode(
            page(['<tr><td colspan="8">검색 결과가 존재하지 않습니다.</td></tr>']),
            "empty",
        )

    def test_행_0개(self):
        self.assertCode(page([]), "empty")

    def test_칸_수(self):
        self.assertCode(page([row(cells=7)]), "row_shape")

    def test_span_6자리(self):
        self.assertCode(page([row("100001")]), "row_shape")

    def test_span_없음(self):
        self.assertCode(page([row(span=False)]), "row_shape")

    def test_테스트오픈_이상값(self):
        self.assertCode(page([row(test_open="2026-11-10")]), "row_shape")

    def test_리얼배포_일시와_대시가_섞여도_원문을_돌려준다(self):
        got = parse_work_status(
            page([
                row("1000001", "2026-11-10 14:00:00", real_deploy="2026-11-12 09:00:00"),
                row("1000002", "2026-11-10 14:00:00"),
                row("1000003", "-"),
                row("1000004", "-", real_deploy="&nbsp; 2026-11-13 10:30:00 "),
            ])
        )
        self.assertEqual(
            got,
            [
                (1000001, "2026-11-10 14:00:00", "2026-11-12 09:00:00"),
                (1000002, "2026-11-10 14:00:00", "-"),
                (1000003, "-", "-"),
                (1000004, "-", "2026-11-13 10:30:00"),
            ],
        )

    def test_리얼배포_이상값(self):
        for bad in ("2026-11-12", "배포완료", "", "2026-11-12 09:00"):
            with self.subTest(bad=bad):
                with self.assertRaises(DevStatusFailure) as cm:
                    parse_work_status(page([row("1000001"), row("1000002", real_deploy=bad)]))
                self.assertEqual(cm.exception.code, "row_shape")
                self.assertIn("행 2", cm.exception.reason)
                self.assertIn("리얼배포", cm.exception.reason)

    def test_중복(self):
        self.assertCode(page([row("1000001"), row("1000001")]), "duplicate_id")

    def test_중첩_표는_무시한다(self):
        nested = row().replace(
            f"<td>{NAME}</td>", "<td><table><tr><td>x</td></tr></table></td>"
        )
        self.assertEqual(
            parse_work_status(page([nested])), [(1000001, "2026-11-10 14:00:00", "-")]
        )

    def test_실패문구에_행_번호가_있다(self):
        with self.assertRaises(DevStatusFailure) as cm:
            parse_work_status(page([row("1000001"), row(cells=7)]))
        self.assertIn("행 2", cm.exception.reason)
        self.assertEqual(str(cm.exception), f"row_shape: {cm.exception.reason}")

    def test_이름이_반환값과_실패문구에_없다(self):
        self.assertNotIn(NAME, repr(parse_work_status(page([row()]))))
        for bad in (
            page([row(cells=7)]),
            page([row("1000001"), row("1000001")]),
            page([row(test_open="x")]),
            page([row(real_deploy="x")]),
        ):
            with self.assertRaises(DevStatusFailure) as cm:
                parse_work_status(bad)
            self.assertNotIn(NAME, str(cm.exception))


if __name__ == "__main__":
    unittest.main()
