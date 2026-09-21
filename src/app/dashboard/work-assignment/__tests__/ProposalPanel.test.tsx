import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProposalPanel } from "../ProposalPanel";
import type {
  ProposalBatchRow,
  ProposalRow,
} from "@/features/assignments/proposal/queries";

/**
 * 제안 탭 — **관리자가 마지막 승인을 하는 자리**(설계 §9.3 · rev 2).
 *
 * 여기서 가장 중요한 것은 **제안이 아직 사실이 아니라는 사실**이 보이는 것이다(§5.4).
 * 표가 확정처럼 보이면 관리자는 확인 없이 넘기고, 반려가 기본 선택지라는 구조가
 * 무너진다.
 *
 * 근거도 함께 보인다 — '에이전트가 관리하는 모든 사항을 확인할 수 있어야 한다' 는
 * 요구가 `basis` 펼침으로 충족된다.
 */
const batch = (o: Partial<ProposalBatchRow> = {}): ProposalBatchRow => ({
  id: "b1",
  academic_year: 2027,
  kind: "annual",
  status: "pending",
  requested_by: "automation",
  basis: {
    targets: { "2": { universities: 20, density: 4.5 } },
    limits: { perOperator: 3, perBatch: 15 },
    rejected: [
      {
        university_name: "탈락대",
        work_kind: "원서접수",
        gate: "G6",
        reason: "편차가 개선되지 않습니다",
      },
    ],
  },
  summary: "이동 1건 · 탈락 1건(G6 1)",
  created_at: "2026-09-18T01:00:00Z",
  decided_at: null,
  decided_by: null,
  ...o,
});

const proposal = (o: Partial<ProposalRow> = {}): ProposalRow => ({
  id: "p1",
  batch_id: "b1",
  academic_year: 2027,
  university_name: "가대학교",
  work_kind: "원서접수",
  subtype: "수시",
  role: "운영",
  prev_assignee: "a@x.com",
  next_assignee: "b@x.com",
  reason: "밀도가 그룹 평균보다 높습니다",
  decision: "pending",
  decided_at: null,
  ...o,
});

const names = { "a@x.com": "김가", "b@x.com": "이나" };

describe("ProposalPanel", () => {
  it("배치가 없으면 빈 상태를 보여준다", () => {
    render(<ProposalPanel batches={[]} proposals={[]} names={{}} />);
    expect(screen.getByText(/제안이 없습니다/)).toBeInTheDocument();
  });

  it("**적용 전까지 사실이 아니라고 적는다**", () => {
    // 표가 확정처럼 보이면 관리자가 확인 없이 넘긴다(§5.4 · R4).
    render(
      <ProposalPanel
        batches={[batch()]}
        proposals={[proposal()]}
        names={names}
      />,
    );
    expect(screen.getByText(/아직 적용되지 않았습니다/)).toBeInTheDocument();
  });

  it("변경 줄에 대학·업무종류·하위유형·이전→제안을 적고, 근거는 그 아래에 둔다", () => {
    render(
      <ProposalPanel
        batches={[batch()]}
        proposals={[proposal()]}
        names={names}
      />,
    );
    const row = screen.getByRole("row", { name: /가대학교/ });
    expect(within(row).getByText(/원서접수/)).toBeInTheDocument();
    expect(within(row).getByText(/수시/)).toBeInTheDocument();
    // 근거는 같은 줄이 아니라 바로 아래 줄에 있다(폭을 다 쓰려고).
    expect(
      screen.getByText(/밀도가 그룹 평균보다 높습니다/),
    ).toBeInTheDocument();
  });

  it("**같은 대학·업무종류·이동은 한 줄로 접는다** — 하위유형만 다른 것은 같은 이동이다", () => {
    render(
      <ProposalPanel
        batches={[batch()]}
        proposals={[
          proposal({ id: "p1", subtype: "수시" }),
          proposal({ id: "p2", subtype: "정시" }),
        ]}
        names={names}
      />,
    );

    // 설계가 정한 이동 단위는 (대학 × 업무종류)다(rev 4). 하위유형마다 한 줄씩 세우면
    // 이전→제안도 근거도 글자까지 같은 줄이 두 벌 생기고, 읽는 사람은 다른 줄인 줄 안다.
    expect(screen.getAllByRole("row", { name: /가대학교/ })).toHaveLength(1);
    const row = screen.getByRole("row", { name: /가대학교/ });
    expect(within(row).getByText(/수시/)).toBeInTheDocument();
    expect(within(row).getByText(/정시/)).toBeInTheDocument();
  });

  it("근거가 같으면 한 번만 적는다", () => {
    render(
      <ProposalPanel
        batches={[batch()]}
        proposals={[
          proposal({ id: "p1", subtype: "수시" }),
          proposal({ id: "p2", subtype: "정시" }),
        ]}
        names={names}
      />,
    );

    expect(
      screen.getAllByText(/밀도가 그룹 평균보다 높습니다/),
    ).toHaveLength(1);
  });

  it("**근거는 데이터 칸을 밀지 않는다** — 제 줄을 준다", () => {
    render(
      <ProposalPanel
        batches={[batch()]}
        proposals={[proposal()]}
        names={names}
      />,
    );

    // 근거를 열로 두면 화면 절반을 먹어 `김슬기` 가 `김슬 / 기` 로 갈린다(실측 2026-09-21).
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).not.toContain("근거");

    // 그래도 근거는 보여야 한다 — 옮기는 이유가 곧 판단 재료다.
    const reason = screen.getByText(/밀도가 그룹 평균보다 높습니다/);
    expect(reason.closest("tr")).not.toBe(
      screen.getByRole("row", { name: /가대학교/ }),
    );
  });

  it("이전과 제안을 한 칸에 둔다 — 화살표가 곧 이동이다", () => {
    render(
      <ProposalPanel
        batches={[batch()]}
        proposals={[proposal()]}
        names={names}
      />,
    );

    const row = screen.getByRole("row", { name: /가대학교/ });
    // 이름·화살표·이름이 각각 다른 노드다(제안 쪽만 굵게). 줄 전체 텍스트로 본다.
    expect(row.textContent?.replace(/\s+/g, "")).toContain("김가→이나");
  });

  it("주소가 아니라 이름으로 보여준다", () => {
    // 메일 주소는 사람이 한 줄씩 읽어 대조하는 값이 아니다.
    render(
      <ProposalPanel
        batches={[batch()]}
        proposals={[proposal()]}
        names={names}
      />,
    );
    const row = screen.getByRole("row", { name: /가대학교/ });
    expect(within(row).getByText(/김가/)).toBeInTheDocument();
    expect(within(row).getByText(/이나/)).toBeInTheDocument();
  });

  it("명부에 없는 주소는 주소를 그대로 보여준다 — 빈칸으로 두지 않는다", () => {
    render(
      <ProposalPanel batches={[batch()]} proposals={[proposal()]} names={{}} />,
    );
    const row = screen.getByRole("row", { name: /가대학교/ });
    expect(within(row).getByText(/a@x\.com/)).toBeInTheDocument();
  });

  it("검산 요약을 적는다 — 탈락 건수가 곧 조치다", () => {
    render(
      <ProposalPanel
        batches={[batch()]}
        proposals={[proposal()]}
        names={names}
      />,
    );
    expect(screen.getByText(/이동 1건 · 탈락 1건\(G6 1\)/)).toBeInTheDocument();
  });

  it("게이트가 떨군 줄을 어긴 이유와 함께 펼쳐 본다", () => {
    render(
      <ProposalPanel
        batches={[batch()]}
        proposals={[proposal()]}
        names={names}
      />,
    );
    expect(screen.getByText(/탈락대/)).toBeInTheDocument();
    expect(screen.getByText(/편차가 개선되지 않습니다/)).toBeInTheDocument();
  });

  it("그룹 목표와 상한을 펼쳐 본다 — 에이전트가 본 것을 관리자도 본다", () => {
    render(
      <ProposalPanel
        batches={[batch()]}
        proposals={[proposal()]}
        names={names}
      />,
    );
    expect(screen.getByText(/20\.0곳/)).toBeInTheDocument();
    expect(screen.getByText(/운영자당 3곳/)).toBeInTheDocument();
  });

  it("이미 결정된 배치에는 결정 버튼을 두지 않는다", () => {
    render(
      <ProposalPanel
        batches={[batch({ status: "applied", decided_by: "admin@x.com" })]}
        proposals={[proposal({ decision: "applied" })]}
        names={names}
      />,
    );
    expect(screen.queryByRole("button", { name: /전체 적용/ })).toBeNull();
    expect(screen.getByText(/적용됨/)).toBeInTheDocument();
  });

  it("대기 중인 배치에는 적용·반려를 둔다", () => {
    render(
      <ProposalPanel
        batches={[batch()]}
        proposals={[proposal()]}
        names={names}
      />,
    );
    expect(
      screen.getByRole("button", { name: /전체 적용/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /반려/ })).toBeInTheDocument();
  });

  it("제안이 0건인 배치도 보여준다 — 빈 배치가 조용히 사라지지 않는다", () => {
    render(<ProposalPanel batches={[batch()]} proposals={[]} names={names} />);
    expect(screen.getByText(/옮길 것이 없습니다/)).toBeInTheDocument();
  });

  it("단건 배치는 그렇게 적는다", () => {
    render(
      <ProposalPanel
        batches={[batch({ kind: "single" })]}
        proposals={[proposal()]}
        names={names}
      />,
    );
    expect(screen.getByText(/단건/)).toBeInTheDocument();
  });

  it("숫자는 tabular-nums 로 세로가 맞는다", () => {
    // 텍스트만 검사하면 표준 위반이 초록 CI 를 통과한다.
    const { container } = render(
      <ProposalPanel
        batches={[batch()]}
        proposals={[proposal()]}
        names={names}
      />,
    );
    expect(container.querySelector("table")?.className).toMatch(/tabular-nums/);
  });
});
