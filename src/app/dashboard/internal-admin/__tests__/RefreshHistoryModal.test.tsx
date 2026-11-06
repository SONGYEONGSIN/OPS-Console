import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { RefreshHistoryItem } from "@/features/sms-sender/status-refresh/contract";
import { RefreshHistoryModal } from "../_components/RefreshHistoryModal";

const item = (over: Partial<RefreshHistoryItem> = {}): RefreshHistoryItem => ({
  id: "r1",
  requestedAt: "2026-11-07T01:02:00Z",
  finishedAt: "2026-11-07T01:12:00Z",
  requester: "자동화",
  status: "failed",
  steps: [
    {
      label: "Moa 수집",
      status: "ok",
      summary: "발신번호 12건 저장",
      action: null,
    },
    {
      label: "현황 파일",
      status: "failed",
      summary: "",
      action: "누가 현황 파일을 열어 두었습니다. 닫고 다시 누르세요.",
    },
  ],
  changes: [],
  note: null,
  ...over,
});

describe("RefreshHistoryModal", () => {
  it("요청 시각(KST)·요청자·상태·단계별 결과", () => {
    render(
      <RefreshHistoryModal
        items={[item()]}
        loadError={null}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("11.07 10:02")).toBeInTheDocument();
    expect(screen.getByText("자동화")).toBeInTheDocument();
    // 요청 상태 '실패' + 현황 파일 단계 '실패'
    expect(screen.getAllByText("실패")).toHaveLength(2);
    expect(screen.getByText("Moa 수집")).toBeInTheDocument();
    expect(screen.getByText("성공")).toBeInTheDocument();
    expect(screen.getByText("발신번호 12건 저장")).toBeInTheDocument();
    expect(screen.getByText("현황 파일")).toBeInTheDocument();
    expect(
      screen.getByText("누가 현황 파일을 열어 두었습니다. 닫고 다시 누르세요."),
    ).toBeInTheDocument();
  });

  it("상태 라벨 — 대기 중·진행 중·완료, 건너뜀", () => {
    render(
      <RefreshHistoryModal
        items={[
          item({ id: "a", status: "pending", steps: [] }),
          item({ id: "b", status: "running", steps: [] }),
          item({
            id: "c",
            status: "done",
            steps: [
              {
                label: "현황 파일",
                status: "skipped",
                summary: "",
                action: "앞 단계가 실패해 이 단계를 건너뛰었습니다.",
              },
            ],
          }),
        ]}
        loadError={null}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("대기 중")).toBeInTheDocument();
    expect(screen.getByText("진행 중")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(screen.getByText("건너뜀")).toBeInTheDocument();
  });

  it("바뀐 점 줄을 그대로", () => {
    render(
      <RefreshHistoryModal
        items={[item({ changes: ["새 번호 2건", "빠진 번호 1건"] })]}
        loadError={null}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("바뀐 점")).toBeInTheDocument();
    expect(screen.getByText("새 번호 2건")).toBeInTheDocument();
    expect(screen.getByText("빠진 번호 1건")).toBeInTheDocument();
  });

  it("note 를 보인다", () => {
    render(
      <RefreshHistoryModal
        items={[
          item({
            steps: [],
            note: "회사 PC 처리 중 멈췄습니다. 다시 누르고, 또 멈추면 관리자에게 알려 주세요.",
          }),
        ]}
        loadError={null}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/회사 PC 처리 중 멈췄습니다/)).toBeInTheDocument();
  });

  it("이력이 없으면 '아직 최신화한 적이 없습니다.'", () => {
    render(
      <RefreshHistoryModal items={[]} loadError={null} onClose={vi.fn()} />,
    );
    expect(
      screen.getByText("아직 최신화한 적이 없습니다."),
    ).toBeInTheDocument();
  });

  it("loadError 를 보인다", () => {
    render(
      <RefreshHistoryModal
        items={[]}
        loadError="최신화 이력을 읽지 못했습니다."
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "최신화 이력을 읽지 못했습니다.",
    );
    expect(screen.queryByText("아직 최신화한 적이 없습니다.")).toBeNull();
  });

  it("닫기를 부른다", () => {
    const onClose = vi.fn();
    render(
      <RefreshHistoryModal items={[]} loadError={null} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalled();
  });
});
