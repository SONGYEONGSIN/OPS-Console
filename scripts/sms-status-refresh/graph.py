"""Microsoft Graph(app-only, Files) 헬퍼 — 현황 최신화가 Teams 파일을 읽고 올릴 때 쓴다.

자격은 OPS-Console 과 같다(`AZURE_AD_*` + `SHAREPOINT_DRIVE_ID`, src/lib/microsoft/auth.ts).
토큰은 `Graph.from_env()` 를 부를 때 받는다 — import 만으로 네트워크를 타지 않는다.

남의 파일을 조용히 덮지 않는 것이 이 모듈의 일이다.
- 새 파일은 `conflictBehavior=fail` — 같은 이름이 있으면 409 로 멈춘다.
- 있는 파일은 처음 기록한 eTag 로 `If-Match` — 그 사이 저장됐으면 412(`changed`),
  누가 열어 두었으면 423(`locked`).
"""
from __future__ import annotations

import os
import urllib.parse
from dataclasses import dataclass

import requests

GRAPH = "https://graph.microsoft.com/v1.0"

# 화면(src/features/sms-sender/types.ts SMS_ROOT_PATH)과 같은 값 — poller-drift.test.ts 가 대조한다.
SMS_ROOT = "내부관리자/01. SMS 발신번호 사전등록"
LIST_DIR = SMS_ROOT + "/04. 발신번호 등록 리스트"
SEJONG_DIR = LIST_DIR + "/01. 세종 등록 리스트"
MOA_DIR = LIST_DIR + "/02. Moa 등록 리스트"
PIMS_DIR = LIST_DIR + "/03. PIMS 등록 리스트"

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
XLSM = "application/vnd.ms-excel.sheet.macroEnabled.12"

_SELECT = "$select=id,name,eTag,lastModifiedDateTime,file,folder"
_ENV_KEYS = ("AZURE_AD_TENANT_ID", "AZURE_AD_CLIENT_ID", "AZURE_AD_CLIENT_SECRET", "SHAREPOINT_DRIVE_ID")


class GraphError(Exception):
    """Graph 호출 실패. status 0 은 호출 전(설정 누락) 실패."""

    def __init__(self, status: int, what: str = ""):
        super().__init__(f"Graph {what} 실패 ({status})".strip())
        self.status = status


class UploadRejected(Exception):
    """If-Match 업로드 거절 — "changed"(412) 또는 "locked"(423)."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class DriveItem:
    id: str
    name: str
    etag: str
    last_modified: str
    is_file: bool


def _item(j: dict) -> DriveItem:
    return DriveItem(
        id=j["id"],
        name=j["name"],
        etag=j.get("eTag", ""),
        last_modified=j.get("lastModifiedDateTime", ""),
        is_file="file" in j,
    )


def _enc(path: str) -> str:
    return "/".join(urllib.parse.quote(seg, safe="") for seg in path.split("/"))


class Graph:
    def __init__(self, drive_id: str, token: str, http=requests):
        self.drive_id = drive_id
        self.token = token
        self._http = http

    @classmethod
    def from_env(cls, http=requests) -> "Graph":
        env = {k: os.getenv(k, "") for k in _ENV_KEYS}
        if not all(env.values()):
            raise GraphError(0, "설정 누락")
        r = http.post(
            f"https://login.microsoftonline.com/{env['AZURE_AD_TENANT_ID']}/oauth2/v2.0/token",
            data={
                "grant_type": "client_credentials",
                "client_id": env["AZURE_AD_CLIENT_ID"],
                "client_secret": env["AZURE_AD_CLIENT_SECRET"],
                "scope": "https://graph.microsoft.com/.default",
            },
            timeout=30,
        )
        if not r.ok:
            raise GraphError(r.status_code, "토큰")
        return cls(env["SHAREPOINT_DRIVE_ID"], r.json()["access_token"], http=http)

    # ── 내부 ──

    def _headers(self, extra: dict | None = None) -> dict:
        return {"Authorization": f"Bearer {self.token}", **(extra or {})}

    def _drive(self) -> str:
        return f"{GRAPH}/drives/{self.drive_id}"

    def _get(self, url: str, what: str, timeout: int = 60):
        r = self._http.get(url, headers=self._headers(), timeout=timeout)
        if not r.ok:
            raise GraphError(r.status_code, what)
        return r

    # ── 읽기 ──

    def children(self, path: str) -> list[DriveItem]:
        url: str | None = f"{self._drive()}/root:/{_enc(path)}:/children?$top=200&{_SELECT}"
        items: list[DriveItem] = []
        while url:
            j = self._get(url, "목록").json()
            items = [*items, *(_item(x) for x in j.get("value", []))]
            url = j.get("@odata.nextLink")
        return items

    def item(self, item_id: str) -> DriveItem:
        return _item(self._get(f"{self._drive()}/items/{item_id}?{_SELECT}", "항목").json())

    def download(self, item_id: str) -> bytes:
        return self._get(f"{self._drive()}/items/{item_id}/content", "내려받기", timeout=180).content

    def used_range_rows(self, item_id: str, sheet: str) -> int:
        # 시트 지정 형식은 화면(source.ts usedRangeUrl)과 같다 — 작은따옴표는 두 번.
        q = urllib.parse.quote(sheet.replace("'", "''"), safe="")
        url = (
            f"{self._drive()}/items/{item_id}/workbook/worksheets('{q}')"
            "/usedRange(valuesOnly=true)?$select=rowCount"
        )
        return int(self._get(url, "사용 범위", timeout=30).json()["rowCount"])

    # ── 쓰기 ──

    def put_new(self, folder: str, name: str, data: bytes, content_type: str) -> DriveItem:
        """새 파일만 만든다. 같은 이름이 있으면 409 GraphError — 덮지 않는다."""
        url = (
            f"{self._drive()}/root:/{_enc(folder + '/' + name)}:/content"
            "?@microsoft.graph.conflictBehavior=fail"
        )
        r = self._http.put(
            url, headers=self._headers({"Content-Type": content_type}), data=data, timeout=180
        )
        if not r.ok:
            raise GraphError(r.status_code, "새 파일 올리기")
        return _item(r.json())

    def put_if_match(self, item_id: str, data: bytes, etag: str, content_type: str) -> DriveItem:
        """처음 기록한 eTag 일 때만 바꾼다. 412 → changed, 423 → locked."""
        # 빈 If-Match(None 이면 requests 가 헤더를 빼 버린다)는 조건 없는 덮어쓰기다 — 보내지 않는다
        if not (etag or "").strip():
            raise ValueError("eTag 없음")
        r = self._http.put(
            f"{self._drive()}/items/{item_id}/content",
            headers=self._headers({"Content-Type": content_type, "If-Match": etag}),
            data=data,
            timeout=180,
        )
        if r.status_code == 412:
            raise UploadRejected("changed")
        if r.status_code == 423:
            raise UploadRejected("locked")
        if not r.ok:
            raise GraphError(r.status_code, "덮어 올리기")
        return _item(r.json())
