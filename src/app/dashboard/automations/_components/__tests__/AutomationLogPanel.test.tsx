import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AutomationLogPanel } from "../AutomationLogPanel";
import type { JobRunLog } from "@/features/automations/run-logs-normalize";

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

  it("빈 로그 → 실행 기록 없음", () => {
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

  it("deposit-match 로그 — 카운트와 불일치 줄 렌더", () => {
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
    expect(
      screen.getByText(/row 8 이미 입금완료 — skip/),
    ).toBeInTheDocument();
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
