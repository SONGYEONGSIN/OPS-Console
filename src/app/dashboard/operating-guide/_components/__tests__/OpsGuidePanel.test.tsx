import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpsGuidePanel } from "../OpsGuidePanel";
import type { OperatingGuideTab } from "../../_data/tabs";

const sampleTab: OperatingGuideTab = {
  value: "vibe-coding",
  label: "바이브코딩",
  desc: "Claude Code · AI 도구",
  sections: [
    {
      heading: "Claude Code 시작하기",
      body: "터미널에서 'claude' 명령으로 실행합니다.\n프로젝트 루트에서 시작하면 컨텍스트가 유지됩니다.",
    },
    {
      heading: "프롬프트 패턴",
      body: "구체적으로 작성하세요.",
      links: [
        { label: "예시 보기", href: "https://example.com", external: true },
      ],
    },
  ],
};

describe("OpsGuidePanel", () => {
  it("탭 헤더 + 설명 표시", () => {
    render(<OpsGuidePanel tab={sampleTab} />);
    expect(screen.getByText("바이브코딩")).toBeInTheDocument();
    expect(screen.getByText("Claude Code · AI 도구")).toBeInTheDocument();
  });

  it("각 section의 heading + body 단락 노출", () => {
    render(<OpsGuidePanel tab={sampleTab} />);
    expect(screen.getByText("Claude Code 시작하기")).toBeInTheDocument();
    expect(screen.getByText(/터미널에서 'claude'/)).toBeInTheDocument();
    expect(screen.getByText(/컨텍스트가 유지/)).toBeInTheDocument();
    expect(screen.getByText("프롬프트 패턴")).toBeInTheDocument();
  });

  it("section에 links 있으면 외부 링크 렌더", () => {
    render(<OpsGuidePanel tab={sampleTab} />);
    const link = screen.getByText(/예시 보기/).closest("a");
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
