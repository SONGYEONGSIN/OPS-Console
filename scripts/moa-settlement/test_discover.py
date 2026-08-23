"""discover.py 의 판단 없는 부분만 테스트한다.

브라우저를 띄우는 부분은 회사 PC 에서만 돌아가므로(Cloudflare + SMS 2FA) 여기서
검증할 수 없다. 대신 **무엇을 보고할지 고르는 규칙**은 순수 함수라 확인할 수 있고,
그 규칙이 틀리면 회사에 가서 돌려도 필요한 게 안 나온다.
"""
import unittest

from discover import pick_settlement_links, classify_headers


class TestPickSettlementLinks(unittest.TestCase):
    def test_정산_링크만_고른다(self):
        got = pick_settlement_links([
            ("정산관리", "/Settlement/Index"),
            ("서비스검색", "/Foundation/ServiceSearch"),
            ("정산요청내역", "/Settlement/RequestList"),
        ])
        self.assertEqual(
            got, [("정산관리", "/Settlement/Index"), ("정산요청내역", "/Settlement/RequestList")]
        )

    def test_href_에만_있어도_고른다(self):
        # 메뉴 이름이 아이콘뿐이라 텍스트가 비는 경우가 있다.
        got = pick_settlement_links([("", "/Settlement/RequestList")])
        self.assertEqual(got, [("", "/Settlement/RequestList")])

    def test_빈_href_와_자바스크립트_링크는_뺀다(self):
        # 눌러야 뜨는 메뉴라 href 가 없는 것들 — 주소를 못 얻으므로 보고해도 쓸모없다.
        got = pick_settlement_links([
            ("정산관리", "javascript:void(0)"),
            ("정산관리", "#"),
            ("정산관리", ""),
            ("정산내역", "/Settlement/List"),
        ])
        self.assertEqual(got, [("정산내역", "/Settlement/List")])

    def test_같은_주소는_한_번만(self):
        got = pick_settlement_links([
            ("정산요청내역", "/Settlement/RequestList"),
            ("정산요청내역", "/Settlement/RequestList"),
        ])
        self.assertEqual(len(got), 1)

    def test_순서를_유지한다(self):
        # 화면에 뜬 차례가 곧 메뉴 구조라 정렬하면 정보가 사라진다.
        got = pick_settlement_links([
            ("정산요청내역", "/b"),
            ("정산관리", "/a"),
        ])
        self.assertEqual([h for _, h in got], ["/b", "/a"])


class TestClassifyHeaders(unittest.TestCase):
    def test_서비스ID_컬럼을_짚는다(self):
        r = classify_headers(["UnivServiceID", "대학명", "수수료 총계"])
        self.assertIn("UnivServiceID", r["service_id"])

    def test_금액_후보를_전부_모은다(self):
        # 어느 것이 청구금액인지는 사람이 정한다. 후보를 빠짐없이 보여주는 게 일이다.
        r = classify_headers(["전형료 총계", "수수료 총계", "송금액", "건수", "대학명"])
        self.assertEqual(r["amount"], ["전형료 총계", "수수료 총계", "송금액"])

    def test_건수는_금액이_아니다(self):
        r = classify_headers(["건수"])
        self.assertEqual(r["amount"], [])
        self.assertIn("건수", r["count"])

    def test_발행유형_축을_짚는다(self):
        r = classify_headers(["구분", "세금계산서"])
        self.assertEqual(r["issue"], ["구분", "세금계산서"])

    def test_모르는_컬럼은_기타로_남긴다(self):
        # 조용히 버리면 화면에 있는데 보고서에 없는 컬럼이 생긴다.
        r = classify_headers(["듣도보도못한칸"])
        self.assertEqual(r["other"], ["듣도보도못한칸"])


if __name__ == "__main__":
    unittest.main()
