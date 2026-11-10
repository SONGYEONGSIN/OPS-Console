"""① 세종 메일 첨부 단계 — 세종텔레콤 메일의 '발번 리스트' 첨부를 Teams 세종 등록 리스트 폴더에 저장한다.

이 단계가 맨 앞이라 같은 실행의 ④ 현황 파일(06·07 비교)이 방금 저장한 새 리스트를 쓴다
(`pick_latest_dated` 가 이름 끝 날짜로 가장 새 파일을 고른다).

- 메일함 `SMS_STATUS_MAILBOX_UPN` 의 `inbox` 아래 두 폴더와 그 하위 2단계:
  `01. 결제사/세종텔레콤`, `02.운영부/운영2팀/{SMS_STATUS_SEJONG_CONTACT_FOLDER}`.
- watermark 뒤에 받은, 첨부 있는 메일을 오래된 순으로 **50통·120초까지**. 남은 것은 다음 실행.
- 첨부 이름이 `발번\\s*리스트` 인 것만 본다. 그중 인라인·항목 첨부·4MB 초과·경로 문자가 든 이름은
  내려받지 않고 '건너뜀'(4MB 는 목록의 size 로, 내려받기 전에 판단). 나머지는 원래 이름으로 새 파일만
  만든다 — 같은 이름이 있으면(409) '이미 있음'.
- watermark = max(이전, 끝까지 처리한 마지막 메일) — 메일이 없어도 ok 마다 다시 낸다(서버가 최근
  50건에서만 합쳐서, 안 내면 언젠가 처음 기준으로 돌아간다). 시험 실행은 저장도 전진도 하지 않는다.

권한은 메일함 기능과 같은 앱의 Application `Mail.Read`(새 권한 없음) — Graph 토큰을 그대로 넘긴다.
결과·로그에는 건수만 싣는다 — 메일 제목·보낸 사람·첨부 이름·폴더 이름(사람 이름)은 싣지 않는다.
"""
from __future__ import annotations

import os
import re
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from typing import Callable

import requests

from contract import FIRST_WATERMARK, Context, StepFailure, StepResult
from graph import SEJONG_DIR, XLSX, Graph, GraphError
from sms_mailbox import ACCESS_DENIED, FOLDER_MISSING, Mailbox, MailboxError, Message

STEP = "mail"
SEJONG_FOLDER = "01. 결제사/세종텔레콤"
CONTACT_PARENT = "02.운영부/운영2팀"
FOLDER_DEPTH = 2
MAX_MESSAGES = 50
BUDGET_S = 120
MAX_BYTES = 4 * 1024 * 1024  # 단순 업로드(put_new) 상한

LIST_NAME = re.compile(r"발번\s*리스트")
# SharePoint 가 이름에 못 쓰는 글자 — `/` 는 put_new 경로에서 하위 폴더가 되어 버린다
_BAD_NAME = re.compile(r'[\\/:*?"<>|]')
_ENV_UPN = "SMS_STATUS_MAILBOX_UPN"
_ENV_CONTACT = "SMS_STATUS_SEJONG_CONTACT_FOLDER"


@dataclass(frozen=True)
class Tally:
    saved: int = 0
    existing: int = 0
    skipped: int = 0

    def plus(self, other: "Tally") -> "Tally":
        return Tally(self.saved + other.saved, self.existing + other.existing, self.skipped + other.skipped)


def _ts(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def _verdict(att) -> tuple[str, str]:
    """(판정, 저장 이름). 판정은 ignore(발번 리스트 아님) · skip · save.

    Mac 에서 보낸 메일은 이름이 NFD 라 정규식에 안 걸린다 — NFC 로 맞춰 보고 그 이름으로 저장한다.
    """
    name = unicodedata.normalize("NFC", att.name or "").strip()
    if not LIST_NAME.search(name):
        return "ignore", name
    if not att.is_file or att.inline or att.size > MAX_BYTES or _BAD_NAME.search(name):
        return "skip", name
    return "save", name


def _content_type(name: str) -> str:
    return XLSX if name.lower().endswith(".xlsx") else "application/octet-stream"


def _save(graph, name: str, data: bytes) -> bool:
    """새로 저장했으면 True, 같은 이름이 이미 있으면(409) False."""
    try:
        graph.put_new(SEJONG_DIR, name, data, _content_type(name))
    except GraphError as e:
        if e.status == 409:
            return False
        raise StepFailure("mail_failed", f"Teams 저장 GraphError {e.status}") from None
    return True


def _handle_message(mb, graph, mid: str, existing: frozenset[str] | None) -> Tally:
    """메일 한 통의 첨부를 판정·저장한다. existing 이 있으면 시험 실행 — 이름 대조만 하고 저장하지 않는다."""
    tally = Tally()
    for att in mb.attachments(mid):
        verdict, name = _verdict(att)
        if verdict == "ignore":
            continue
        if verdict == "skip":
            tally = tally.plus(Tally(skipped=1))
            continue
        data = mb.attachment_bytes(mid, att.id)  # 시험 실행도 내려받는다 — 읽기 권한까지 본다
        new = _save(graph, name, data) if existing is None else name not in existing
        tally = tally.plus(Tally(saved=1) if new else Tally(existing=1))
    return tally


def _folder_ids(mb, contact: str) -> list[str]:
    ids: list[str] = []
    for path in (SEJONG_FOLDER, f"{CONTACT_PARENT}/{contact}"):
        for fid in mb.descendants(mb.folder_id(path), depth=FOLDER_DEPTH):
            if fid not in ids:
                ids = [*ids, fid]
    return ids


def _pending_messages(mb, fids: list[str], since: str) -> list[Message]:
    """모든 폴더의 since 뒤 메일 — 같은 id 는 한 번, 받은 시각 오래된 순."""
    found = {m.id: m for fid in fids for m in mb.messages_since(fid, since)}
    return sorted(found.values(), key=lambda m: (_ts(m.received), m.id))


def _process(mb, graph, msgs: list[Message], existing, clock, started: float) -> tuple[list[Message], Tally]:
    done: list[Message] = []
    tally = Tally()
    for m in msgs[:MAX_MESSAGES]:
        if clock() - started >= BUDGET_S:
            break
        tally = tally.plus(_handle_message(mb, graph, m.id, existing))
        done = [*done, m]
    return done, tally


def next_watermark(prev: str, done: list[Message], rest: list[Message]) -> str:
    """max(이전, 처리한 마지막). 필터가 `gt` 라 못 본 메일과 같은 시각까지는 올리지 않는다 — 영영 안 보게 된다."""
    cut = _ts(rest[0].received) if rest else None
    safe = [m.received for m in done if cut is None or _ts(m.received) < cut]
    return max([prev, *safe], key=_ts)


def _mailbox_failure(e: MailboxError) -> StepFailure:
    if e.code == ACCESS_DENIED:
        code = "mail_access_denied"
    elif e.code == FOLDER_MISSING or e.status == 404:  # 404 = 메일함·폴더가 그 사이 사라짐
        code = "mail_folder_missing"
    else:
        code = "mail_failed"
    return StepFailure(code, f"MailboxError {e.status}")


def _connect(graph_factory):
    try:
        return graph_factory()
    except GraphError as e:
        code = "mail_config" if e.status == 0 else "mail_failed"  # 0 = Graph env 누락
        raise StepFailure(code, f"GraphError {e.status}") from None


def _existing_names(graph) -> frozenset[str]:
    try:
        return frozenset(i.name for i in graph.children(SEJONG_DIR))
    except GraphError as e:
        raise StepFailure("mail_failed", f"Teams 목록 GraphError {e.status}") from None


def _summary(done: list[Message], t: Tally, rest: list[Message], dry_run: bool) -> str:
    text = f"메일 {len(done)}통 · 저장 {t.saved} · 이미 있음 {t.existing} · 건너뜀 {t.skipped}"
    if rest:
        text += f" · 남은 {len(rest)}통은 다음 실행"
    if dry_run:
        text += " · 저장 안 함(시험 실행)"
    return text


def run_mail_step(
    ctx: Context,
    *,
    graph_factory=Graph.from_env,
    mailbox_factory=Mailbox,
    clock: Callable[[], float] = time.monotonic,
) -> StepResult:
    started = clock()
    upn, contact = os.getenv(_ENV_UPN, "").strip(), os.getenv(_ENV_CONTACT, "").strip()
    if not upn or not contact:
        raise StepFailure("mail_config", "메일함 env 누락")
    since = ctx.watermarks.get(STEP) or FIRST_WATERMARK
    graph = _connect(graph_factory)
    try:
        mb = mailbox_factory(graph.token, upn)
        msgs = _pending_messages(mb, _folder_ids(mb, contact), since)
        existing = _existing_names(graph) if ctx.dry_run else None
        done, tally = _process(mb, graph, msgs, existing, clock, started)
    except MailboxError as e:
        raise _mailbox_failure(e) from None
    except requests.RequestException as e:
        raise StepFailure("mail_failed", type(e).__name__) from None

    rest = msgs[len(done):]
    return StepResult(
        STEP,
        "ok",
        _summary(done, tally, rest, ctx.dry_run),
        counts={"messages": len(done), "saved": tally.saved, "existing": tally.existing,
                "skipped": tally.skipped, "remaining": len(rest)},
        # 시험 실행은 전진하지 않는다 — 이전 값을 그대로 다시 낸다
        watermark=since if ctx.dry_run else next_watermark(since, done, rest),
    )
