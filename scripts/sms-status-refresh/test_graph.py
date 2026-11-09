"""graph.py — Graph 호출의 모양만 본다. 실제 네트워크는 부르지 않는다(FakeHttp).

덮어쓰기 금지(conflictBehavior=fail)와 If-Match 가 빠지면 에러 없이 남의 파일을 덮는다.
"""
import os
import unittest
from unittest import mock

from graph import (
    MOA_DIR,
    SMS_ROOT,
    XLSX,
    DriveItem,
    Graph,
    GraphError,
    UploadRejected,
)


class FakeResponse:
    def __init__(self, status_code: int, payload=None, content: bytes = b""):
        self.status_code = status_code
        self._payload = payload
        self.content = content

    @property
    def ok(self) -> bool:
        return 200 <= self.status_code < 300

    def json(self):
        return self._payload


class FakeHttp:
    """(method, url, headers, data) 를 기록하고 정해 둔 응답을 차례로 돌려준다."""

    def __init__(self, *responses: FakeResponse):
        self.responses = list(responses)
        self.calls: list[tuple[str, str, dict, object]] = []

    def _next(self, method, url, headers=None, data=None, **_kw):
        self.calls.append((method, url, dict(headers or {}), data))
        return self.responses.pop(0)

    def get(self, url, **kw):
        return self._next("GET", url, **kw)

    def post(self, url, **kw):
        return self._next("POST", url, **kw)

    def put(self, url, **kw):
        return self._next("PUT", url, **kw)


def item_json(i: str, name: str = "a.xlsx", etag: str = "etag-1", file: bool = True) -> dict:
    j = {"id": i, "name": name, "eTag": etag, "lastModifiedDateTime": "2026-11-07T01:00:00Z"}
    return {**j, "file": {}} if file else {**j, "folder": {}}


class TestGraph(unittest.TestCase):
    def test_children_은_다음_쪽까지(self):
        http = FakeHttp(
            FakeResponse(200, {"value": [item_json("1"), item_json("2", file=False)], "@odata.nextLink": "https://next/2"}),
            FakeResponse(200, {"value": [item_json("3")]}),
        )
        got = Graph("drv", "tok", http=http).children(MOA_DIR)
        self.assertEqual([i.id for i in got], ["1", "2", "3"])
        self.assertEqual([i.is_file for i in got], [True, False, True])
        self.assertEqual(got[0], DriveItem("1", "a.xlsx", "etag-1", "2026-11-07T01:00:00Z", True))
        self.assertEqual(http.calls[1][1], "https://next/2")
        self.assertIn("$select=id,name,eTag,lastModifiedDateTime,file,folder", http.calls[0][1])
        self.assertEqual(http.calls[0][2]["Authorization"], "Bearer tok")

    def test_경로_조각을_인코딩(self):
        http = FakeHttp(FakeResponse(200, {"value": []}))
        Graph("drv", "tok", http=http).children(SMS_ROOT)
        url = http.calls[0][1]
        path = url.split("/root:/", 1)[1].split(":/children", 1)[0]
        self.assertEqual(path.count("/"), SMS_ROOT.count("/"))
        self.assertNotIn(" ", path)
        self.assertTrue(path.isascii())
        self.assertIn("%20SMS%20", path)

    def test_put_new_은_덮어쓰지_않는다(self):
        http = FakeHttp(FakeResponse(201, item_json("9", "Moa 등록 리스트_261107.xlsx")))
        got = Graph("drv", "tok", http=http).put_new(MOA_DIR, "Moa 등록 리스트_261107.xlsx", b"x", XLSX)
        method, url, headers, data = http.calls[0]
        self.assertEqual(method, "PUT")
        self.assertIn("conflictBehavior=fail", url)
        self.assertIn("/root:/", url)
        self.assertEqual(headers["Content-Type"], XLSX)
        self.assertEqual(data, b"x")
        self.assertEqual(got.id, "9")

    def test_put_new_충돌은_GraphError(self):
        http = FakeHttp(FakeResponse(409, {"error": {}}))
        with self.assertRaises(GraphError) as cm:
            Graph("drv", "tok", http=http).put_new(MOA_DIR, "a.xlsx", b"x", XLSX)
        self.assertEqual(cm.exception.status, 409)

    def test_If_Match_로_올린다(self):
        http = FakeHttp(FakeResponse(200, item_json("7", etag="etag-2")))
        got = Graph("drv", "tok", http=http).put_if_match("7", b"y", "etag-1", XLSX)
        method, url, headers, _ = http.calls[0]
        self.assertEqual((method, headers["If-Match"]), ("PUT", "etag-1"))
        self.assertTrue(url.endswith("/drives/drv/items/7/content"))
        self.assertEqual(got.etag, "etag-2")

    def test_412_는_changed_423_은_locked(self):
        for status, code in ((412, "changed"), (423, "locked")):
            http = FakeHttp(FakeResponse(status))
            with self.assertRaises(UploadRejected) as cm:
                Graph("drv", "tok", http=http).put_if_match("7", b"y", "etag-1", XLSX)
            self.assertEqual(cm.exception.code, code)

    def test_빈_eTag_면_보내지_않는다(self):
        # 빈 If-Match(또는 None 이라 헤더가 빠진 요청)는 조건 없는 덮어쓰기가 된다
        for etag in ("", None, "  "):
            http = FakeHttp(FakeResponse(200, item_json("7")))
            with self.assertRaises(ValueError):
                Graph("drv", "tok", http=http).put_if_match("7", b"y", etag, XLSX)
            self.assertEqual(http.calls, [], repr(etag))

    def test_If_Match_그_밖의_실패는_GraphError(self):
        http = FakeHttp(FakeResponse(500))
        with self.assertRaises(GraphError) as cm:
            Graph("drv", "tok", http=http).put_if_match("7", b"y", "etag-1", XLSX)
        self.assertEqual(cm.exception.status, 500)

    def test_item_과_download(self):
        http = FakeHttp(FakeResponse(200, item_json("5", etag="e5")), FakeResponse(200, content=b"bytes"))
        g = Graph("drv", "tok", http=http)
        self.assertEqual(g.item("5").etag, "e5")
        self.assertEqual(g.download("5"), b"bytes")
        self.assertTrue(http.calls[1][1].endswith("/drives/drv/items/5/content"))

    def test_used_range_rows(self):
        http = FakeHttp(FakeResponse(200, {"rowCount": 42}))
        n = Graph("drv", "tok", http=http).used_range_rows("5", "06. Moa 대조")
        self.assertEqual(n, 42)
        url = http.calls[0][1]
        self.assertIn("/items/5/workbook/worksheets('", url)
        self.assertIn("usedRange(valuesOnly=true)?$select=rowCount", url)
        self.assertNotIn(" ", url)

    def test_used_range_rows_는_30초에_끊는다(self):
        http = mock.MagicMock()
        http.get.return_value = FakeResponse(200, {"rowCount": 1})
        Graph("drv", "tok", http=http).used_range_rows("5", "_학교")
        self.assertEqual(http.get.call_args.kwargs["timeout"], 30)

    def test_읽기_실패는_GraphError(self):
        http = FakeHttp(FakeResponse(404))
        with self.assertRaises(GraphError) as cm:
            Graph("drv", "tok", http=http).children(MOA_DIR)
        self.assertEqual(cm.exception.status, 404)


class TestFromEnv(unittest.TestCase):
    KEYS = ("AZURE_AD_TENANT_ID", "AZURE_AD_CLIENT_ID", "AZURE_AD_CLIENT_SECRET", "SHAREPOINT_DRIVE_ID")

    def test_env_가_없으면_GraphError(self):
        http = FakeHttp()
        with mock.patch.dict(os.environ, {k: "" for k in self.KEYS}):
            with self.assertRaises(GraphError) as cm:
                Graph.from_env(http=http)
        self.assertEqual(cm.exception.status, 0)
        self.assertEqual(http.calls, [])

    def test_env_로_토큰을_받는다(self):
        http = FakeHttp(FakeResponse(200, {"access_token": "tok-x"}))
        with mock.patch.dict(os.environ, {k: f"v-{k}" for k in self.KEYS}):
            g = Graph.from_env(http=http)
        self.assertEqual((g.drive_id, g.token), ("v-SHAREPOINT_DRIVE_ID", "tok-x"))
        self.assertIn("/v-AZURE_AD_TENANT_ID/oauth2/v2.0/token", http.calls[0][1])

    def test_토큰_실패는_GraphError(self):
        http = FakeHttp(FakeResponse(401, {}))
        with mock.patch.dict(os.environ, {k: f"v-{k}" for k in self.KEYS}):
            with self.assertRaises(GraphError) as cm:
                Graph.from_env(http=http)
        self.assertEqual(cm.exception.status, 401)


if __name__ == "__main__":
    unittest.main()
