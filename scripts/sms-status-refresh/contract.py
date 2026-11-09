"""현황 최신화 단계 계약 — 회사 PC 가 서버로 보내는 결과의 모양과 단계 실행 규칙.

서버(`src/features/sms-sender/status-refresh/contract.ts`)와 짝이다. 코드 → 할 일 문구는
서버 한 곳에서 정하므로 여기서는 **코드만** 보낸다. 두 목록은 드리프트 테스트
(`poller-drift.test.ts`)가 이 파일 원문을 읽어 대조한다 — 튜플은 한 줄로 쓴다.

단계는 차례로 돈다. 앞 단계가 실패해도 그 결과에 기대지 않는 뒤 단계는 돈다 —
Moa 로그인 하나가 막혀도 다른 일까지 멈추지 않게. 기대는 단계(`needs`)는 건너뛴다 —
빈 결과 위에서 이어 가면 엉뚱한 파일이 만들어진다.

결과에는 예외 메시지를 싣지 않는다(셀 값·번호가 섞일 수 있다) — 클래스 이름만.
"""
from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Sequence

SMS_CONSUMER = "sms-status-refresh"

# 첫 실행 기준점 = 2026-10-17 00:00 KST. 단계별 watermark 가 아직 없을 때 여기서부터 본다.
FIRST_WATERMARK = "2026-10-16T15:00:00Z"

FAILURE_CODES = ("lease_busy", "login_failed", "moa_empty", "moa_shape_changed", "moa_incomplete", "pims_login_failed", "pims_empty", "pims_shape_changed", "pims_incomplete", "source_missing", "source_shape", "excel_failed", "verify_failed", "changed", "locked", "after_check", "dependency_failed", "unknown")

# PR-3·4 가 "mail"·"pdf" 를 더한다.
STEP_IDS = ("moa", "pims", "workbook")

TEXT_LIMIT = 300  # 서버 zod 의 summary·detail·changes 한 줄 상한
CHANGES_LIMIT = 200  # 서버 zod 의 changes 줄 수 상한


class StepFailure(Exception):
    """단계가 '알고 있는' 실패 — 코드는 FAILURE_CODES 중 하나여야 한다."""

    def __init__(self, code: str, detail: str = ""):
        if code not in FAILURE_CODES:
            raise ValueError(f"모르는 실패 코드: {code}")
        super().__init__(code)
        self.code = code
        self.detail = detail


@dataclass(frozen=True)
class StepResult:
    step: str
    status: str  # "ok" | "failed" | "skipped"
    summary: str
    counts: dict[str, int] = field(default_factory=dict)
    error_code: str | None = None
    detail: str | None = None
    watermark: str | None = None
    changes: tuple[str, ...] = ()

    def to_json(self) -> dict:
        error = None
        if self.error_code is not None:
            error = {"code": self.error_code}
            if self.detail:
                error = {**error, "detail": self.detail[:TEXT_LIMIT]}
        return {
            "step": self.step,
            "status": self.status,
            "summary": self.summary[:TEXT_LIMIT],
            "counts": dict(self.counts),
            "error": error,
            "watermark": self.watermark,
        }


@dataclass(frozen=True)
class Context:
    request_id: str
    watermarks: dict[str, str]
    dry_run: bool
    work_dir: Path
    results: dict[str, StepResult]


@dataclass(frozen=True)
class Step:
    id: str
    run: Callable[[Context], StepResult]
    needs: tuple[str, ...] = ()


def _run_one(step: Step, ctx: Context) -> StepResult:
    unmet = [n for n in step.needs if getattr(ctx.results.get(n), "status", None) != "ok"]
    if unmet:
        return StepResult(
            step.id, "skipped", "앞 단계가 실패해 건너뜀", error_code="dependency_failed"
        )
    try:
        return step.run(ctx)
    except StepFailure as e:
        return StepResult(
            step.id, "failed", "실패", error_code=e.code, detail=e.detail or None
        )
    except Exception as e:  # noqa: BLE001 — 한 단계의 예외가 뒤 단계를 막지 않게
        return StepResult(
            step.id, "failed", "예상하지 못한 오류", error_code="unknown", detail=type(e).__name__
        )


def run_steps(steps: Sequence[Step], ctx: Context) -> list[StepResult]:
    """단계를 차례로 돌린다. 각 단계 뒤 ctx 를 새로 만들어 앞 결과를 뒤 단계에 넘긴다."""
    results: list[StepResult] = []
    current = ctx
    for step in steps:
        r = _run_one(step, current)
        results.append(r)
        current = dataclasses.replace(current, results={**current.results, step.id: r})
    return results


def build_body(request_id: str, results: Sequence[StepResult]) -> dict:
    """서버 POST 본문. 모든 단계가 ok 이고 단계가 하나 이상일 때만 ok."""
    return {
        "id": request_id,
        "ok": bool(results) and all(r.status == "ok" for r in results),
        "result": {
            "version": 1,
            "steps": [r.to_json() for r in results],
            # 서버 상한(한 줄 300자·200줄)을 넘기면 본문 전체가 400 으로 버려진다.
            "changes": [c[:TEXT_LIMIT] for r in results for c in r.changes][:CHANGES_LIMIT],
        },
    }
