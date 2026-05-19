import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RightSystemPanel } from "../RightSystemPanel";

describe("RightSystemPanel", () => {
  const stats = {
    shiftLabel: "2교대 14:00–22:00 KST",
    shiftProgressPct: 50,
    onCallName: "한효진",
    trafficLevel: 3 as const,
    buildOk: true,
    deployOk: true,
    activeSessions: 8,
    slaPct: 99.7,
    alertCount: 3,
  };

  it("시프트 / 온콜 / 빌드 / 배포 / SLA 등 시스템 신호 노출", () => {
    render(<RightSystemPanel stats={stats} />);
    expect(screen.getByText(/14:00/)).toBeInTheDocument();
    expect(screen.getByText("한효진")).toBeInTheDocument();
    expect(screen.getByText("99.7%")).toBeInTheDocument();
    expect(screen.getByText(/세션/)).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText(/알림 3/)).toBeInTheDocument();
  });
});
