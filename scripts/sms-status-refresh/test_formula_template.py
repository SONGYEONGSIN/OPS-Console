"""formula_template.py — 행 수식 템플릿 추론·렌더.

PR-3b 는 숨김 표의 행 수를 바꾸므로 숨김 P 열과 보기 시트 행 수식을 새 행에 맞춰 다시 만들어야 한다.
수식을 손으로 조립하지 않고, 지금 행들에서 '하나의 템플릿' 을 추론해 그대로 찍는다.
움직이는 것은 셋뿐이다 — 행 상대 참조(`$P9`)·행 상대 상수(P 의 `{i-1}`·SMALL 의 k)·시트 접두 범위의 끝
(`숨김시트!X$2:X$N`). 접두 없는 `$U$2:$U$N` 같은 절대 범위는 끝이 마지막 행과 같아도 고정이다.
"""
import unittest

import fixtures_status as fs
from formula_template import TemplateMismatch, infer, render

BOX = "'01. 학교별 현황'!$G$6"


def view_cell(hid: str, col: str, r: int, last: int) -> str:
    """보기 시트 행 수식 — 실파일 모양(접두 시트 이름에 따옴표 없음)."""
    return f'=IF($P{r}="","",INDEX({hid}!{col}$2:{col}${last},$P{r})&"")'


def view_idx(hid: str, r: int, last: int) -> str:
    """순번(숨김) 열 — 픽스처 모양(따옴표 있는 접두). k 는 9행에서 1."""
    return f"=IFERROR(SMALL('{hid}'!$P$2:$P${last},{r - 8}),\"\")"


class InferTest(unittest.TestCase):
    def test_P_행_참조와_끝이_움직인다(self):
        # 숨김 P — 자기 행 참조(A2…S2·$T2)와 {i-1} 상수가 행을 따라간다. U 끝 $U$6 은 그대로
        p = {i: fs.p_formula(BOX, i, 14, 6) for i in (2, 3, 4)}
        t = infer(p, last=4, hidden="_학교")
        self.assertEqual(render(t, 9, 11), fs.p_formula(BOX, 9, 14, 6))
        self.assertEqual(render(t, 2, 4), p[2])
        # 보기 행 — 시트 접두 범위의 끝이 새 last 로, 상대 행·순번 k 는 행을 따라간다
        a = infer({r: view_cell("_학교", "A", r, 102) for r in (9, 10, 11)}, last=102, hidden="_학교")
        self.assertEqual(render(a, 120, 130), view_cell("_학교", "A", 120, 130))
        k = infer({r: view_idx("_학교", r, 4) for r in (9, 10, 11)}, last=4, hidden="_학교")
        self.assertEqual(render(k, 12, 5), view_idx("_학교", 12, 5))

    def test_고정_숫자는_그대로(self):
        # 접두 없는 범위는 끝이 last 와 같아도 고정, 다른 시트 접두 범위·검색 칸·문자열 속 숫자·MATCH 0 도 고정
        def f(r):
            return (f'=IF(ISNUMBER(MATCH({BOX},$U$2:$U$4,0)),COUNT($P$2:$P$4),'
                    f"COUNT('04. 확인 필요'!A$2:A$4))&\"10/15 기준\"&$T{r}")
        t = infer({r: f(r) for r in (2, 3, 4)}, last=4, hidden="_학교")
        self.assertEqual(render(t, 30, 40), f(30))
        # 숨김 P 를 그 시트 이름으로 추론해도 U 끝은 안 움직인다
        p = infer({i: fs.p_formula(BOX, i, 8, 4) for i in (2, 3)}, last=4, hidden="_번호")
        self.assertIn("$U$2:$U$4,0", render(p, 50, 60))

    def test_한_행만_달라도_불일치(self):
        rows = {r: view_cell("_학교", "A", r, 102) for r in range(9, 13)}
        for broken in ({**rows, 11: view_cell("_학교", "A", 11, 101)},  # 끝이 하나만 다르다
                       {**rows, 11: view_cell("_학교", "B", 11, 102)},  # 뼈대가 다르다
                       {**rows, 11: view_cell("_학교", "A", 11, 102).replace("$P11", "$P12")},  # 상대 행이 튄다
                       {**rows, 11: None}):  # 수식이 없다
            with self.assertRaises(TemplateMismatch) as cm:
                infer(broken, last=102, hidden="_학교")
            self.assertEqual(cm.exception.row, 11)

    def test_끝이_last_와_다르면_불일치(self):
        # 보기 시트가 옛 범위를 보고 있다 — 숨김 표는 이미 102 행이 아니다
        with self.assertRaises(TemplateMismatch):
            infer({r: view_cell("_학교", "A", r, 102) for r in (9, 10)}, last=103, hidden="_학교")

    def test_행이_둘_미만이면_추론하지_않는다(self):
        # 한 행만으로는 상수가 고정인지 행 상대인지 가를 수 없다
        with self.assertRaises(TemplateMismatch):
            infer({2: fs.p_formula(BOX, 2, 8, 4)}, last=2, hidden="_번호")


if __name__ == "__main__":
    unittest.main()
