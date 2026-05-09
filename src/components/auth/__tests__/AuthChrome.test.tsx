import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthTitleBar, AuthStatusBar } from "../AuthChrome";

describe("AuthTitleBar", () => {
  it("'운영부 상황실' 텍스트 렌더", () => {
    render(<AuthTitleBar />);
    expect(screen.getByText("운영부 상황실")).toBeInTheDocument();
  });

  it("초기엔 SSR-safe placeholder 시계 (------) 노출 가능", () => {
    render(<AuthTitleBar />);
    // useEffect 후 실제 시각으로 갱신될 수 있으므로 KST 토큰만 확인
    expect(screen.getByText(/KST/)).toBeInTheDocument();
  });
});

describe("AuthStatusBar", () => {
  it("연결됨/오프라인 + 서버/빌드/sha 항목 노출", () => {
    render(<AuthStatusBar />);
    // 연결 상태
    expect(screen.getByText(/연결됨|오프라인/)).toBeInTheDocument();
    // 서버 라벨
    expect(screen.getByText("서버")).toBeInTheDocument();
    // 빌드 라벨
    expect(screen.getByText("빌드")).toBeInTheDocument();
    // sha prefix
    expect(screen.getByText(/^sha /)).toBeInTheDocument();
  });
});
