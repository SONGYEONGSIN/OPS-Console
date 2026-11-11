"""Microsoft Graph 메일함 읽기(app-only, Mail.Read) — 세종 메일의 발번 리스트 첨부를 찾을 때 쓴다.

읽기 전용이다. GET 만 부른다(보내기·옮기기·읽음 표시·삭제 없음).
토큰은 graph.py 의 `Graph.from_env()` 가 받은 것을 그대로 넘겨 받는다 — 같은 앱, 새 권한 없음.
http 는 주입한다(테스트는 전부 가짜).

개인정보: 메일 제목·보낸 사람·첨부 내용은 예외 메시지에 싣지 않는다. 상태 코드와 분류만 남긴다.
"""
from __future__ import annotations

import urllib.parse
from dataclasses import dataclass

import requests

GRAPH = "https://graph.microsoft.com/v1.0"
PAGE_SIZE = 50
FOLDER_PAGE_SIZE = 100
MAX_PAGES = 200  # 쪽 넘김 상한 — 50통씩이면 만 통, 정상 실행은 한두 쪽

# MailboxError.code — mail_step 이 mail_access_denied / mail_folder_missing / mail_failed 로 옮긴다.
ACCESS_DENIED = "access_denied"
FOLDER_MISSING = "folder_missing"
FAILED = "failed"


class MailboxError(Exception):
    """메일함 호출 실패. code 는 access_denied(401·403) / folder_missing / failed."""

    def __init__(self, code: str, status: int = 0, what: str = ""):
        super().__init__(f"메일함 {what} 실패 ({code}, {status})")
        self.code = code
        self.status = status


@dataclass(frozen=True)
class Message:
    id: str
    received: str  # receivedDateTime 원문(UTC ISO)


@dataclass(frozen=True)
class Attachment:
    id: str
    name: str
    size: int
    inline: bool
    is_file: bool  # fileAttachment 만 True — 항목·참조 첨부는 내용을 못 받는다


def _q(text: str) -> str:
    """경로 조각 인코딩 — `/`·`=` 도 남기지 않는다."""
    return urllib.parse.quote(text, safe="")


def _odata_string(text: str) -> str:
    # OData 문자열 리터럴: 작은따옴표는 두 번.
    return "'" + text.replace("'", "''") + "'"


def _is_file_attachment(j: dict) -> bool:
    kind = j.get("@odata.type")
    return kind is None or kind == "#microsoft.graph.fileAttachment"


class Mailbox:
    def __init__(self, token: str, upn: str, http=requests):
        self.token = token
        self.upn = upn
        self._http = http

    # ── 내부 ──

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    def _user(self) -> str:
        return f"{GRAPH}/users/{_q(self.upn)}"

    def _get(self, url: str, what: str, timeout: int = 60):
        r = self._http.get(url, headers=self._headers(), timeout=timeout)
        if r.ok:
            return r
        code = ACCESS_DENIED if r.status_code in (401, 403) else FAILED
        raise MailboxError(code, r.status_code, what)

    def _pages(self, url: str, what: str) -> list[dict]:
        """`@odata.nextLink` 를 끝까지 따라가며 value 를 모은다.

        같은 주소가 되풀이되거나 쪽 수가 MAX_PAGES 를 넘으면 FAILED 로 멈춘다 —
        끝나지 않는 응답이 스케줄러 제한 시간까지 붙잡지 못하게.
        """
        rows: list[dict] = []
        seen: set[str] = set()
        nxt: str | None = url
        while nxt:
            if nxt in seen or len(seen) >= MAX_PAGES:
                # 주소에는 폴더·메일 id 가 섞이므로 메시지에 싣지 않는다
                raise MailboxError(FAILED, 0, f"{what} 쪽 넘김 중단")
            seen.add(nxt)
            j = self._get(nxt, what).json()
            rows.extend(j.get("value", []))
            nxt = j.get("@odata.nextLink")
        return list(rows)

    def _child_folder_ids(self, parent: str, name: str | None = None) -> list[str]:
        # URLSearchParams 식 인코딩은 `$` 를 깨므로 OData 키는 글자 그대로 둔다.
        query = f"$top={FOLDER_PAGE_SIZE}&$select=id"
        if name is not None:
            flt = urllib.parse.quote(f"displayName eq {_odata_string(name)}", safe="")
            query += f"&$filter={flt}"
        url = f"{self._user()}/mailFolders/{_q(parent)}/childFolders?{query}"
        return [row["id"] for row in self._pages(url, "폴더 목록")]

    # ── 폴더 ──

    def folder_id(self, path: str) -> str:
        """`inbox` 아래 표시 이름 경로(`A/B/C`)를 폴더 id 로. 없으면 folder_missing."""
        names = [n for n in path.split("/") if n]
        if not names:
            raise ValueError("폴더 경로 없음")
        current = "inbox"
        for name in names:
            ids = self._child_folder_ids(current, name)
            if not ids:
                # 폴더 이름은 설정값(사람 이름일 수 있음)이라 메시지에 싣지 않는다
                raise MailboxError(FOLDER_MISSING, 404, "폴더 찾기")
            current = ids[0]
        return current

    def descendants(self, fid: str, depth: int = 2) -> list[str]:
        """fid 자신과 그 아래 `depth` 단계까지의 폴더 id(위에서 아래, 너비 우선)."""
        found = [fid]
        level = [fid]
        for _ in range(depth):
            level = [child for parent in level for child in self._child_folder_ids(parent)]
            found = [*found, *level]
        return found

    # ── 메일·첨부 ──

    def messages_since(self, fid: str, since: str) -> list[Message]:
        """since(UTC ISO) 뒤에 받은 첨부 있는 메일을 오래된 순으로. 모든 쪽을 읽는다.

        서버에 `$orderby` 를 주지만 순서를 믿지 않고 코드에서 한 번 더 정렬한다 —
        메시지 목록은 $filter 와 $orderby 를 같이 쓸 때 제약(정렬 속성이 필터에 같은 순서로
        먼저 나와야 함)이 있어 서버가 순서를 바꾸거나 거절할 수 있다.
        """
        flt = urllib.parse.quote(
            f"receivedDateTime gt {since} and hasAttachments eq true", safe=""
        )
        url = (
            f"{self._user()}/mailFolders/{_q(fid)}/messages"
            f"?$filter={flt}&$orderby=receivedDateTime%20asc"
            f"&$top={PAGE_SIZE}&$select=id,receivedDateTime"
        )
        rows = self._pages(url, "메일 목록")
        found = [Message(r["id"], r.get("receivedDateTime", "")) for r in rows]
        return sorted(found, key=lambda m: m.received)

    def attachments(self, mid: str) -> list[Attachment]:
        """첨부 목록(내용 제외 — contentBytes 를 select 하지 않는다)."""
        url = (
            f"{self._user()}/messages/{_q(mid)}/attachments"
            "?$select=id,name,size,isInline"
        )
        return [
            Attachment(
                id=r["id"],
                name=r.get("name", ""),
                size=int(r.get("size", 0)),
                inline=bool(r.get("isInline", False)),
                is_file=_is_file_attachment(r),
            )
            for r in self._pages(url, "첨부 목록")
        ]

    def attachment_bytes(self, mid: str, aid: str) -> bytes:
        url = f"{self._user()}/messages/{_q(mid)}/attachments/{_q(aid)}/$value"
        return self._get(url, "첨부 내려받기", timeout=180).content
