#!/usr/bin/env python3
"""Supabase SMS 우편함 클라이언트 — Moa 로그인 인증번호를 OPS-Console 창구에서 꺼낸다.

설계: docs/superpowers/specs/2026-09-11-sms-code-inbox-design.md §6.1

폰(Tasker)이 `/api/sms-codes/inbound` 로 넣고, 스크래퍼는 이 모듈로
`/api/sms-codes/consume` 에서 **비우고(reset) → 꺼낸다(pop)**. make 웹훅과 달리
호출에 비용이 없어 2초마다 본다.

예외 두 가지를 **반드시 갈라서** 다룬다:
  - `LeaseHeldError`   — 다른 스크래퍼가 Moa 로그인 중(409). **중단**한다. make 로
                          넘어가면 SMS 두 통이 한 폰에 겹쳐 서로의 코드를 가져가고,
                          틀린 코드 제출은 캡차 잠금으로 이어진다(§3.2).
  - `InboxUnavailable` — 창구 장애(500·네트워크·307 HTML). 호출부가 make 로 폴백한다.

selenium 을 import 하지 않는다 — 브라우저 없이 단위 테스트한다.
"""
import time
from typing import NamedTuple

import requests

INBOX_TTL_SEC = 180  # 로그인 점유 TTL — 폴링 상한 90초 + 여유. 서버 기본값과 같다
INBOX_POLL_INTERVAL_SEC = 2  # 비용이 없으므로 촘촘히 본다
CONSUME_PATH = "/api/sms-codes/consume"
REQUEST_TIMEOUT_SEC = 10


class SmsSource(NamedTuple):
    """로그인 제출 '전'에 고른 인증번호 소스. 제출 뒤에는 이 소스만 본다."""

    kind: str  # "inbox" | "make"
    url: str = ""  # make 일 때만
    baseline: str | None = None  # make 일 때만


class LeaseHeldError(RuntimeError):
    """다른 소비자가 Moa 로그인 점유 중 — 폴백 대상이 아니다."""

    def __init__(self, holder: str, holder_since: str, message: str | None = None):
        self.holder = holder
        self.holder_since = holder_since
        super().__init__(
            message
            or f"다른 스크래퍼가 Moa 로그인 중입니다 ({holder}, {holder_since} 점유) — 중단"
        )


class InboxUnavailable(RuntimeError):
    """우편함 창구 장애 — 호출부가 make 웹훅으로 넘어간다."""


def mask_code(code: str) -> str:
    """로그에 전체 코드를 남기지 않는다. '****56'. 2자 이하는 전부 가린다."""
    if len(code) <= 2:
        return "**"
    return "*" * (len(code) - 2) + code[-2:]


def _consume(base_url: str, secret: str, action: str, consumer: str) -> tuple[int, dict]:
    """창구 한 번 호출. (status, payload). JSON 이 아니거나 못 닿으면 InboxUnavailable."""
    try:
        res = requests.post(
            f"{base_url.rstrip('/')}{CONSUME_PATH}",
            headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
            json={"action": action, "consumer": consumer},
            timeout=REQUEST_TIMEOUT_SEC,
        )
    except requests.RequestException as e:
        # 예외 문구에 헤더 값이 실릴 수 있다(InvalidHeader 는 'Bearer …' 를 그대로 담는다).
        # 이 문구는 [WARN] 으로 stdout → 폴러 로그·run-log 로 흘러가므로 키를 지운다.
        detail = str(e).replace(secret, "***") if secret else str(e)
        raise InboxUnavailable(f"우편함 {action} 요청 실패: {type(e).__name__}: {detail}") from e
    try:
        payload = res.json()
    except ValueError as e:
        # 307 로그인 리다이렉트(PUBLIC_PATHS 누락, F11) 등 — 본문이 HTML 이다.
        raise InboxUnavailable(f"우편함 {action} 응답이 JSON 이 아닙니다 (HTTP {res.status_code})") from e
    if not isinstance(payload, dict):
        raise InboxUnavailable(f"우편함 {action} 응답 형식 오류 (HTTP {res.status_code})")
    return res.status_code, payload


def reset_inbox(base_url: str, secret: str, consumer: str) -> int:
    """비우기 + 점유. 지운 건수 반환.

    409 → LeaseHeldError (호출부가 중단한다).
    그 밖의 실패 → InboxUnavailable (호출부가 make 로 넘어간다).
    """
    status, payload = _consume(base_url, secret, "reset", consumer)
    if status == 409:
        raise LeaseHeldError(str(payload.get("holder", "?")), str(payload.get("holderSince", "?")))
    if status != 200 or payload.get("ok") is not True:
        raise InboxUnavailable(
            f"우편함 reset 실패 (HTTP {status}): {payload.get('error', payload)}"
        )
    return int(payload.get("cleared", 0))


def poll_inbox_code(base_url: str, secret: str, consumer: str, timeout_sec: int) -> str:
    """2초마다 pop. 코드가 오면 돌려준다.

    409(점유자가 아님) → LeaseHeldError 로 즉시 멈춘다 — 남의 코드를 가져갈 수 있는
    자리다. 일시 오류(네트워크·500)는 타임아웃까지 계속 본다 — 로그인 창 90초 안의
    흔들림 하나로 문자를 버리지 않는다. 타임아웃 문구는 다음 사람이 어디를 볼지
    알려줘야 한다(2026-09-07 'baseline 미변경' 이 원인을 가렸다).
    """
    started = time.monotonic()
    deadline = started + timeout_sec
    last_error: str | None = None  # 타임아웃 문구에 싣는다 — 키 회전·500 을 폰 문제로 오진하지 않게
    while True:
        try:
            status, payload = _consume(base_url, secret, "pop", consumer)
        except InboxUnavailable as e:
            error = str(e)
        else:
            if status == 409:
                raise LeaseHeldError(
                    "(unknown)",
                    "?",
                    f"우편함 점유가 {consumer} 에게 없습니다 (pop 409) — 다른 스크래퍼가 "
                    "가져갔거나 리스가 만료됐습니다. 중단",
                )
            if status == 200 and payload.get("ok") is True:
                error = None
                code = payload.get("code")
                if code:
                    waited = int(time.monotonic() - started)
                    print(f"[OK] 우편함에서 인증번호 수신 (…{mask_code(str(code))}, {waited}초 대기)")
                    return str(code)
            else:
                error = f"HTTP {status}: {payload.get('error', payload)}"
        if error and error != last_error:
            print(f"[WARN] 우편함 pop 오류 — 타임아웃까지 계속 봅니다: {error}")
        last_error = error or last_error
        if time.monotonic() >= deadline:
            tail = f" (마지막 오류: {last_error})" if last_error else ""
            raise RuntimeError(
                f"우편함 대기 타임아웃 ({timeout_sec}s) — 문자가 도착하지 않았습니다. "
                f"폰 Tasker 확인 필요{tail}"
            )
        time.sleep(INBOX_POLL_INTERVAL_SEC)
