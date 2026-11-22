import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import { WritePanel } from "../_components/WritePanel";
import { setUrl } from "./search-params-mock";

afterEach(cleanup);

const slot = (k: string) => <p>{k}</p>;

describe("WritePanel", () => {
  it("순서 — 특이사항 → 직접 추가 (프로젝트·TF·제출은 패널 밖)", () => {
    setUrl("?week=2026-11-16&tab=application");
    const { container } = render(
      <WritePanel
        notes={{
          application: slot("N-app"),
          pims: slot("N-pims"),
          leave: slot("N-leave"),
        }}
        directAdd={{
          application: slot("D-app"),
          pims: slot("D-pims"),
          leave: slot("D-leave"),
        }}
      />,
    );
    const text = container.textContent ?? "";
    expect(text.indexOf("N-app")).toBeLessThan(text.indexOf("D-app"));
    expect(document.querySelector('section[aria-label="제출"]')).toBeNull();
    expect(document.querySelector('section[aria-label="프로젝트·TF"]')).toBeNull();
  });
  it("RF2 특이사항은 왼쪽 영역을 따라 바뀌고 다른 영역 칸은 숨긴 채 남는다", () => {
    setUrl("?week=2026-11-16&tab=application");
    render(
      <WritePanel
        notes={{
          application: <input aria-label="원서 금주" />,
          pims: <input aria-label="발표 금주" />,
          leave: slot("L"),
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("원서 금주"), {
      target: { value: "쓰던 글" },
    });
    act(() => {
      setUrl("?week=2026-11-16&tab=pims");
    });
    expect(screen.getByLabelText("원서 금주").closest("[hidden]")).not.toBeNull();
    act(() => {
      setUrl("?week=2026-11-16&tab=application");
    });
    expect(screen.getByLabelText("원서 금주")).toHaveValue("쓰던 글");
  });
  it("패널 맨 위에 지금 쓰는 영역 이름이 있고 주소의 영역을 따른다", () => {
    setUrl("?week=2026-11-16&tab=application");
    const notes = { application: slot("A"), pims: slot("B"), leave: slot("C") };
    render(<WritePanel notes={notes} />);
    const label = screen.getByText("원서접수", { selector: "p.font-bold" });
    expect(label.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["text-sm", "font-bold", "text-ink"]),
    );
    act(() => {
      setUrl("?week=2026-11-16&tab=pims");
    });
    expect(screen.getByText("합격자 발표", { selector: "p.font-bold" })).toBeInTheDocument();
    expect(screen.queryByText("원서접수", { selector: "p.font-bold" })).toBeNull();
  });
});
