"""mailbox.py — Graph 메일함 읽기의 모양만 본다. 실제 네트워크는 부르지 않는다(FakeHttp).

폴더 이름의 작은따옴표를 두 번 쓰지 않으면 필터가 깨지고, 다음 쪽을 안 읽으면 메일이
조용히 누락된다 — 둘 다 에러 없이 '메일 없음' 으로 보인다.
"""
import unittest
import urllib.parse

from mailbox import Attachment, Mailbox, MailboxError, Message


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
    """(method, url, headers) 를 기록하고 정해 둔 응답을 차례로 돌려준다."""

    def __init__(self, *responses: FakeResponse):
        self.responses = list(responses)
        self.calls: list[tuple[str, str, dict]] = []

    def get(self, url, headers=None, **_kw):
        self.calls.append(("GET", url, dict(headers or {})))
        return self.responses.pop(0)

    def put(self, url, **_kw):  # 읽기 전용 모듈 — 쓰기가 불리면 실패해야 한다
        raise AssertionError("메일함에 쓰면 안 된다")

    post = delete = patch = put


def decoded(call) -> str:
    return urllib.parse.unquote(call[1])


def mailbox(*responses: FakeResponse) -> tuple[Mailbox, FakeHttp]:
    http = FakeHttp(*responses)
    return Mailbox("tok", "box-a", http=http), http


class TestFolderId(unittest.TestCase):
    def test_이름_경로로_폴더_찾기(self):
        mb, http = mailbox(
            FakeResponse(200, {"value": [{"id": "f1"}]}),
            FakeResponse(200, {"value": [{"id": "f2"}]}),
        )
        self.assertEqual(mb.folder_id("테스트폴더A/테스트폴더B"), "f2")
        first, second = http.calls
        self.assertIn("/users/box-a/mailFolders/inbox/childFolders", first[1])
        self.assertIn("$filter=displayName eq '테스트폴더A'", decoded(first))
        self.assertIn("/mailFolders/f1/childFolders", second[1])
        self.assertIn("displayName eq '테스트폴더B'", decoded(second))
        self.assertEqual(first[2]["Authorization"], "Bearer tok")

    def test_작은따옴표는_두_번(self):
        mb, http = mailbox(FakeResponse(200, {"value": [{"id": "f1"}]}))
        mb.folder_id("A'B")
        self.assertIn("displayName eq 'A''B'", decoded(http.calls[0]))

    def test_없는_폴더는_folder_missing(self):
        mb, _ = mailbox(FakeResponse(200, {"value": []}))
        with self.assertRaises(MailboxError) as cm:
            mb.folder_id("없는폴더")
        self.assertEqual(cm.exception.code, "folder_missing")
        self.assertNotIn("없는폴더", str(cm.exception))

    def test_빈_경로는_거절(self):
        mb, http = mailbox()
        with self.assertRaises(ValueError):
            mb.folder_id("")
        self.assertEqual(http.calls, [])

    def test_upn_은_인코딩(self):
        mb = Mailbox("tok", "a b@x", http=(http := FakeHttp(FakeResponse(200, {"value": [{"id": "f"}]}))))
        mb.folder_id("가")
        self.assertIn("/users/a%20b%40x/", http.calls[0][1])


class TestDescendants(unittest.TestCase):
    def test_자기와_하위_두_단계(self):
        mb, http = mailbox(
            FakeResponse(200, {"value": [{"id": "c1"}, {"id": "c2"}]}),
            FakeResponse(200, {"value": [{"id": "g1"}]}),
            FakeResponse(200, {"value": []}),
        )
        self.assertEqual(mb.descendants("root"), ["root", "c1", "c2", "g1"])
        self.assertEqual(len(http.calls), 3)  # 3단계째(g1 의 자식)는 부르지 않는다

    def test_하위_폴더_목록도_다음_쪽까지(self):
        mb, http = mailbox(
            FakeResponse(200, {"value": [{"id": "c1"}], "@odata.nextLink": "https://next/c"}),
            FakeResponse(200, {"value": [{"id": "c2"}]}),
        )
        self.assertEqual(mb.descendants("root", depth=1), ["root", "c1", "c2"])
        self.assertEqual(http.calls[1][1], "https://next/c")


class TestMessagesSince(unittest.TestCase):
    def test_다음_쪽까지_읽는다(self):
        mb, http = mailbox(
            FakeResponse(200, {"value": [{"id": "m1", "receivedDateTime": "2026-11-01T00:00:00Z"}],
                               "@odata.nextLink": "https://next/2"}),
            FakeResponse(200, {"value": [{"id": "m2", "receivedDateTime": "2026-11-02T00:00:00Z"}]}),
        )
        got = mb.messages_since("f1", "2026-10-31T00:00:00Z")
        self.assertEqual(got, [Message("m1", "2026-11-01T00:00:00Z"), Message("m2", "2026-11-02T00:00:00Z")])
        self.assertEqual(http.calls[1][1], "https://next/2")

    def test_질의_모양(self):
        mb, http = mailbox(FakeResponse(200, {"value": []}))
        mb.messages_since("f1", "2026-10-31T00:00:00Z")
        url = decoded(http.calls[0])
        self.assertIn("/mailFolders/f1/messages", url)
        self.assertIn("$filter=receivedDateTime gt 2026-10-31T00:00:00Z and hasAttachments eq true", url)
        self.assertIn("$orderby=receivedDateTime asc", url)
        self.assertIn("$top=50", url)
        self.assertIn("$select=id,receivedDateTime", url)

    def test_서버_순서를_믿지_않고_오래된_순으로_다시_정렬(self):
        mb, _ = mailbox(
            FakeResponse(200, {"value": [{"id": "m2", "receivedDateTime": "2026-11-02T00:00:00Z"}],
                               "@odata.nextLink": "https://next/2"}),
            FakeResponse(200, {"value": [{"id": "m1", "receivedDateTime": "2026-11-01T00:00:00Z"}]}),
        )
        self.assertEqual([m.id for m in mb.messages_since("f", "2026-10-31T00:00:00Z")], ["m1", "m2"])


class TestAttachments(unittest.TestCase):
    def test_첨부_목록(self):
        mb, http = mailbox(FakeResponse(200, {"value": [
            {"@odata.type": "#microsoft.graph.fileAttachment", "id": "a1", "name": "x.xlsx", "size": 10, "isInline": False},
            {"@odata.type": "#microsoft.graph.itemAttachment", "id": "a2", "name": "y", "size": 5, "isInline": False},
            {"id": "a3", "name": "z.png", "size": 3, "isInline": True},
        ]}))
        got = mb.attachments("m=1")
        self.assertEqual(got, [
            Attachment("a1", "x.xlsx", 10, False, True),
            Attachment("a2", "y", 5, False, False),
            Attachment("a3", "z.png", 3, True, True),
        ])
        self.assertIn("/messages/m%3D1/attachments", http.calls[0][1])
        self.assertNotIn("contentBytes", http.calls[0][1])

    def test_첨부_내용은_value_로(self):
        mb, http = mailbox(FakeResponse(200, content=b"PK\x03\x04"))
        self.assertEqual(mb.attachment_bytes("m1", "a/1"), b"PK\x03\x04")
        self.assertTrue(http.calls[0][1].endswith("/messages/m1/attachments/a%2F1/$value"))


class TestErrors(unittest.TestCase):
    def test_403_은_MailboxError(self):
        mb, _ = mailbox(FakeResponse(403, {"error": {"message": "제목 비밀"}}))
        with self.assertRaises(MailboxError) as cm:
            mb.folder_id("가")
        self.assertEqual(cm.exception.code, "access_denied")
        self.assertEqual(cm.exception.status, 403)
        self.assertNotIn("비밀", str(cm.exception))

    def test_401_도_접근_거부(self):
        mb, _ = mailbox(FakeResponse(401))
        with self.assertRaises(MailboxError) as cm:
            mb.messages_since("f", "2026-10-31T00:00:00Z")
        self.assertEqual(cm.exception.code, "access_denied")

    def test_그_밖의_오류는_failed(self):
        for call in (
            lambda m: m.descendants("f"),
            lambda m: m.attachments("m"),
            lambda m: m.attachment_bytes("m", "a"),
        ):
            mb, _ = mailbox(FakeResponse(503))
            with self.assertRaises(MailboxError) as cm:
                call(mb)
            self.assertEqual((cm.exception.code, cm.exception.status), ("failed", 503))


if __name__ == "__main__":
    unittest.main()
