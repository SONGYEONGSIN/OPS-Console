import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/features/receivables-match/apply-mismatch-action", () => ({
  applyMismatchAsMatch: vi.fn().mockResolvedValue({ ok: true, patched: true }),
}));

import { AutomationLogPanel, buildTimeline } from "../AutomationLogPanel";
import type { JobRunLog } from "@/features/automations/run-logs-normalize";
import type { AutomationRunEntry } from "@/features/automations/types";

describe("buildTimeline — 시각 내림차순 정렬", () => {
  it("run에 매칭 안 되는 최신 날짜 상세가 과거 run보다 위로 온다", () => {
    const runs: AutomationRunEntry[] = [
      {
        ranAt: "2026-06-22T01:00:24Z",
        ok: true,
        skipped: true,
        message: "자동 실행 OFF — cron skip",
      },
      {
        ranAt: "2026-06-17T04:49:37Z",
        ok: true,
        skipped: false,
        message: "트리거",
      },
    ];
    const log: JobRunLog = {
      jobId: "closing-scrape",
      kind: "closing-scrape",
      entries: [
        // idx0 — 6.22 run과 같은 날짜(매칭)
        { ranAt: "2026-06-22T01:00:57Z", status: "success", serviceCount: 491, message: null },
        // idx1,2 — 6.26 (어떤 run에도 매칭 안 됨 = leftover, 가장 최신)
        { ranAt: "2026-06-26T12:14:08Z", status: "failed", serviceCount: 0, message: "TimeoutException" },
        { ranAt: "2026-06-26T08:20:34Z", status: "failed", serviceCount: 0, message: "RuntimeError" },
      ],
    };
    const tl = buildTimeline(runs, log);
    // 최신 6.26 detail-only가 맨 위, 그 뒤 6.22 run, 6.17 run 순
    expect(tl[0].kind).toBe("detail-only");
    expect(tl[0].kind === "detail-only" && tl[0].dateKey).toBe("2026-06-26");
    expect(tl[1].kind === "run" && tl[1].run.ranAt).toBe("2026-06-22T01:00:24Z");
    expect(tl[2].kind === "run" && tl[2].run.ranAt).toBe("2026-06-17T04:49:37Z");
  });
});

describe("AutomationLogPanel", () => {
  it("loading 상태", () => {
    render(
      <AutomationLogPanel label="입금 매칭" loading error={null} log={null} />,
    );
    expect(screen.getByText("불러오는 중…")).toBeInTheDocument();
  });

  it("error 상태", () => {
    render(
      <AutomationLogPanel
        label="입금 매칭"
        loading={false}
        error="권한 없음"
        log={null}
      />,
    );
    expect(screen.getByText("권한 없음")).toBeInTheDocument();
  });

  it("빈 로그 + 빈 runs → 실행 기록 없음", () => {
    const log: JobRunLog = {
      jobId: "receivables-deposit-match",
      kind: "deposit-match",
      entries: [],
    };
    render(
      <AutomationLogPanel
        label="입금 매칭"
        loading={false}
        error={null}
        log={log}
      />,
    );
    expect(screen.getByText("실행 기록이 없습니다.")).toBeInTheDocument();
  });

  it("실행 이력(runs) — 발송 상세가 없어도 실행/스킵/실패를 표시", () => {
    render(
      <AutomationLogPanel
        label="세금계산서 역발행 알림"
        loading={false}
        error={null}
        runs={[
          {
            ranAt: "2026-06-15T01:00:00Z",
            ok: true,
            skipped: false,
            message: "발송 대상 없음",
          },
          {
            ranAt: "2026-06-14T01:00:00Z",
            ok: true,
            skipped: true,
            message: "자동 실행 OFF — cron skip",
          },
          {
            ranAt: "2026-06-13T01:00:00Z",
            ok: false,
            skipped: false,
            message: "시트 미연결",
          },
        ]}
        log={null}
      />,
    );
    expect(screen.getByText("발송 대상 없음")).toBeInTheDocument();
    expect(screen.getByText("성공")).toBeInTheDocument();
    expect(screen.getByText("스킵")).toBeInTheDocument();
    expect(screen.getByText("실패")).toBeInTheDocument();
    expect(screen.getByText("시트 미연결")).toBeInTheDocument();
  });

  it("통합 타임라인 — 같은 날짜의 run과 발송 상세를 한 블록에 인라인", () => {
    const log: JobRunLog = {
      jobId: "smileedi-mail",
      kind: "smileedi",
      entries: [
        {
          // 2026-06-16 KST (UTC+9): 06-16 10:00 KST
          sentAt: "2026-06-16T01:00:00Z",
          recipientName: "이담당",
          recipientEmail: "lee@example.com",
          companyNames: ["가나상사"],
          invoiceCount: 3,
          totalSupplyAmount: 1500000,
          status: "sent",
          errorMessage: null,
        },
      ],
    };
    const { container } = render(
      <AutomationLogPanel
        label="세금계산서 역발행 알림"
        loading={false}
        error={null}
        runs={[
          {
            // 2026-06-16 KST
            ranAt: "2026-06-16T01:00:05Z",
            ok: true,
            skipped: false,
            message: "역발행 1건 발송",
          },
        ]}
        log={log}
      />,
    );
    // 통합: 별도 '발송 상세'/'실행 이력' 섹션 헤더 없음
    expect(screen.queryByText("발송 상세")).not.toBeInTheDocument();
    expect(screen.queryByText("실행 이력")).not.toBeInTheDocument();
    // run 메시지와 발송 상세가 모두 보인다
    expect(screen.getByText("역발행 1건 발송")).toBeInTheDocument();
    expect(screen.getByText("이담당 (lee@example.com)")).toBeInTheDocument();
    // 같은 블록(같은 timeline-item) 안에 run 메시지와 상세가 함께 위치
    const item = container.querySelector("[data-timeline-item]");
    expect(item).not.toBeNull();
    expect(item?.textContent).toContain("역발행 1건 발송");
    expect(item?.textContent).toContain("이담당 (lee@example.com)");
  });

  it("통합 타임라인 — run에 매칭 안 되는 상세는 폴백으로 자체 시각 노출", () => {
    const log: JobRunLog = {
      jobId: "smileedi-mail",
      kind: "smileedi",
      entries: [
        {
          sentAt: "2026-06-10T01:00:00Z",
          recipientName: "박담당",
          recipientEmail: "park@example.com",
          companyNames: ["다라상사"],
          invoiceCount: 1,
          totalSupplyAmount: 200000,
          status: "sent",
          errorMessage: null,
        },
      ],
    };
    render(
      <AutomationLogPanel
        label="세금계산서 역발행 알림"
        loading={false}
        error={null}
        runs={[
          {
            // 다른 날짜 — 상세와 매칭되지 않음
            ranAt: "2026-06-16T01:00:05Z",
            ok: true,
            skipped: false,
            message: "역발행 0건 — 대상 없음",
          },
        ]}
        log={log}
      />,
    );
    // run도 보이고 매칭 안 된 상세도 정보 손실 없이 노출
    expect(screen.getByText("역발행 0건 — 대상 없음")).toBeInTheDocument();
    expect(screen.getByText("박담당 (park@example.com)")).toBeInTheDocument();
  });

  it("통합 타임라인 — runs가 전혀 없어도 상세를 자체 시각으로 노출(insights)", () => {
    const log: JobRunLog = {
      jobId: "insights-collect",
      kind: "insights",
      entries: [
        {
          collectedAt: "2026-05-31T08:00:00Z",
          videoCount: 5,
          sampleTitles: ["바이브코딩 입문"],
        },
      ],
    };
    render(
      <AutomationLogPanel
        label="인사이트 영상 수집"
        loading={false}
        error={null}
        log={log}
      />,
    );
    expect(screen.getByText("5건 수집")).toBeInTheDocument();
    expect(screen.getByText(/바이브코딩 입문/)).toBeInTheDocument();
  });

  it("deposit-match 로그 — 카운트와 불일치 줄 렌더(통합 블록 안)", () => {
    const log: JobRunLog = {
      jobId: "receivables-deposit-match",
      kind: "deposit-match",
      entries: [
        {
          startedAt: "2026-05-31T05:00:00Z",
          finishedAt: "2026-05-31T05:00:30Z",
          mode: "live",
          matchedCount: 12,
          mismatchCount: 1,
          errorCount: 0,
          matchedLines: ["₩335,000 1:1 매칭 (미수행 8 ↔ 입금행 1761)"],
          mismatchLines: [
            "세종고 ₩330,000 — 입금 '세종' (미수행 12 ↔ 입금행 45)",
          ],
          mismatchItems: [
            {
              line: "세종고 ₩330,000 — 입금 '세종' (미수행 12 ↔ 입금행 45)",
              misuRow: 12,
              depRow: 45,
              misuCustomer: "세종고",
              depContent: "세종",
            },
          ],
          errorLines: [],
          skipLines: [],
        },
      ],
    };
    render(
      <AutomationLogPanel
        label="입금 매칭"
        loading={false}
        error={null}
        log={log}
      />,
    );
    expect(screen.getByText("매칭 12 · 불일치 1 · 에러 0")).toBeInTheDocument();
    expect(
      screen.getByText(/세종고 ₩330,000 — 입금 '세종'/),
    ).toBeInTheDocument();
    // 매칭 성공 줄도 표시되어야 한다
    expect(
      screen.getByText(/₩335,000 1:1 매칭 \(미수행 8 ↔ 입금행 1761\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    // 불일치 줄에 admin '적용'(승인) 버튼 노출 (automations는 admin 전용 페이지)
    expect(screen.getByRole("button", { name: "적용" })).toBeInTheDocument();
  });

  it("deposit-match 로그 — 스킵(이미 입금완료)은 에러 아닌 스킵으로 렌더", () => {
    const log: JobRunLog = {
      jobId: "receivables-deposit-match",
      kind: "deposit-match",
      entries: [
        {
          startedAt: "2026-06-01T10:00:00Z",
          finishedAt: "2026-06-01T10:00:30Z",
          mode: "live",
          matchedCount: 0,
          mismatchCount: 0,
          errorCount: 0,
          matchedLines: [],
          mismatchLines: [],
          mismatchItems: [],
          errorLines: [],
          skipLines: ["row 8 이미 입금완료 — skip"],
        },
      ],
    };
    render(
      <AutomationLogPanel
        label="입금 매칭"
        loading={false}
        error={null}
        log={log}
      />,
    );
    // 에러 0인데 스킵 1로 표시 (500 아님)
    expect(
      screen.getByText("매칭 0 · 불일치 0 · 에러 0 · 스킵 1"),
    ).toBeInTheDocument();
    expect(screen.getByText(/row 8 이미 입금완료 — skip/)).toBeInTheDocument();
  });

  it("같은 날짜 run이 여러 개(deposit-match 매시간)여도 상세는 정보 손실 없이 노출", () => {
    const log: JobRunLog = {
      jobId: "receivables-deposit-match",
      kind: "deposit-match",
      entries: [
        {
          startedAt: "2026-06-16T01:00:00Z",
          finishedAt: "2026-06-16T01:00:30Z",
          mode: "live",
          matchedCount: 1,
          mismatchCount: 0,
          errorCount: 0,
          matchedLines: ["₩100,000 1:1 매칭 (가 ↔ 가입금)"],
          mismatchLines: [],
          mismatchItems: [],
          errorLines: [],
          skipLines: [],
        },
        {
          startedAt: "2026-06-16T05:00:00Z",
          finishedAt: "2026-06-16T05:00:30Z",
          mode: "live",
          matchedCount: 1,
          mismatchCount: 0,
          errorCount: 0,
          matchedLines: ["₩200,000 1:1 매칭 (나 ↔ 나입금)"],
          mismatchLines: [],
          mismatchItems: [],
          errorLines: [],
          skipLines: [],
        },
      ],
    };
    render(
      <AutomationLogPanel
        label="입금 매칭 자동화"
        loading={false}
        error={null}
        runs={[
          {
            ranAt: "2026-06-16T05:00:05Z",
            ok: true,
            skipped: false,
            message: "오후 실행",
          },
          {
            ranAt: "2026-06-16T01:00:05Z",
            ok: true,
            skipped: false,
            message: "오전 실행",
          },
        ]}
        log={log}
      />,
    );
    // 같은 KST 날짜 — 두 매칭 상세가 모두 노출되어 정보 손실이 없다
    expect(screen.getByText(/₩100,000 1:1 매칭/)).toBeInTheDocument();
    expect(screen.getByText(/₩200,000 1:1 매칭/)).toBeInTheDocument();
    expect(screen.getByText("오전 실행")).toBeInTheDocument();
    expect(screen.getByText("오후 실행")).toBeInTheDocument();
  });

  it("mail-operator 로그 — 수신자/상태 렌더", () => {
    const log: JobRunLog = {
      jobId: "receivables-mail-operator",
      kind: "mail-operator",
      entries: [
        {
          sentAt: "2026-05-31T01:00:00Z",
          recipientName: "김운영",
          recipientEmail: "kim@example.com",
          customerNames: ["A학교"],
          receivableCount: 2,
          totalAmount: 500000,
          status: "sent",
          errorMessage: null,
        },
      ],
    };
    render(
      <AutomationLogPanel
        label="운영자 미수채권 알림"
        loading={false}
        error={null}
        log={log}
      />,
    );
    expect(screen.getByText("김운영 (kim@example.com)")).toBeInTheDocument();
    expect(screen.getByText("발송")).toBeInTheDocument();
  });

  it("notice-teams 로그 — 공유 공지 제목/작성자 렌더", () => {
    const log: JobRunLog = {
      jobId: "notice-teams-share",
      kind: "notice-teams",
      entries: [
        {
          sharedAt: "2026-06-20T01:00:00Z",
          title: "정기 점검 안내",
          author: "운영부",
        },
      ],
    };
    render(
      <AutomationLogPanel
        label="공지 Teams 공유"
        loading={false}
        error={null}
        log={log}
      />,
    );
    expect(screen.getByText(/정기 점검 안내/)).toBeInTheDocument();
    expect(screen.getByText(/운영부/)).toBeInTheDocument();
  });

  it("insights 로그 — 수집 건수/샘플 제목 렌더", () => {
    const log: JobRunLog = {
      jobId: "insights-collect",
      kind: "insights",
      entries: [
        {
          collectedAt: "2026-05-31T08:00:00Z",
          videoCount: 5,
          sampleTitles: ["바이브코딩 입문"],
        },
      ],
    };
    render(
      <AutomationLogPanel
        label="인사이트 영상 수집"
        loading={false}
        error={null}
        log={log}
      />,
    );
    expect(screen.getByText("5건 수집")).toBeInTheDocument();
    expect(screen.getByText(/바이브코딩 입문/)).toBeInTheDocument();
  });
});
