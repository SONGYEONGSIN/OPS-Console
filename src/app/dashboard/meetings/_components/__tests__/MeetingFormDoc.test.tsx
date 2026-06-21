import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MeetingFormDoc } from "../MeetingFormDoc";
import { buildSeedDoc } from "@/features/meetings/form-templates";

describe("MeetingFormDoc (읽기전용 양식 렌더러)", () => {
  it("정기회의 양식: 섹션 제목과 표 헤더를 렌더한다", () => {
    const doc = buildSeedDoc("regular");
    render(
      <MeetingFormDoc
        doc={doc}
        title="월간 회의"
        typeLabel="정기회의"
        dateValue="2026-06-21 10:00"
        location="본사"
        attendees={["송영신"]}
      />,
    );
    expect(screen.getByText("월간 회의")).toBeInTheDocument();
    expect(screen.getByText("지난 안건 점검")).toBeInTheDocument();
    expect(screen.getByText("논의 내용")).toBeInTheDocument();
    expect(screen.getByText("후속 조치")).toBeInTheDocument();
    // 표 헤더
    expect(screen.getAllByText("담당").length).toBeGreaterThan(0);
  });

  it("긴급 양식: banner와 대응 타임라인 표를 렌더한다", () => {
    const doc = buildSeedDoc("urgent");
    render(
      <MeetingFormDoc
        doc={doc}
        title="장애 대응"
        typeLabel="긴급·이슈 대응"
        dateValue=""
        location=""
        attendees={[]}
      />,
    );
    expect(screen.getByText("대응 타임라인")).toBeInTheDocument();
    expect(screen.getByText("재발 방지")).toBeInTheDocument();
  });

  it("프로젝트 양식: 목표·범위 kv 박스 키를 렌더한다", () => {
    const doc = buildSeedDoc("project");
    render(
      <MeetingFormDoc
        doc={doc}
        title="킥오프"
        typeLabel="프로젝트·킥오프"
        dateValue=""
        location=""
        attendees={[]}
      />,
    );
    expect(screen.getByText("프로젝트 목표")).toBeInTheDocument();
    expect(screen.getByText("성공 기준")).toBeInTheDocument();
  });
});
