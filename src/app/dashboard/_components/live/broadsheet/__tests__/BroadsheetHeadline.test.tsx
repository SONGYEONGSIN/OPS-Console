import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { BroadsheetHeadline } from "../BroadsheetHeadline";
import {
  selectHeadline,
  type HeadlineInput,
} from "../../command/headline-selector";

const urgentInput: HeadlineInput = {
  incidentsUnresolved: 3,
  deadlinesToday: 2,
  overdueReceivables: 0,
  inProgressServices: 5,
};

const calmInput: HeadlineInput = {
  incidentsUnresolved: 0,
  deadlinesToday: 0,
  overdueReceivables: 0,
  inProgressServices: 5,
};

describe("BroadsheetHeadline", () => {
  it("urgent 입력 시 AUTO 배지와 segment 텍스트, 긴급 원의 숫자를 표시한다", () => {
    render(<BroadsheetHeadline input={urgentInput} />);
    expect(screen.getByText("AUTO ▸ 우선순위 자동")).toBeTruthy();
    expect(screen.getByText("미처리 사고")).toBeTruthy();
    // 긴급 원
    expect(screen.getByText("긴급")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("urgent 입력 시 kicker가 selectHeadline 결과와 일치한다", () => {
    const expected = selectHeadline(urgentInput);
    render(<BroadsheetHeadline input={urgentInput} />);
    expect(screen.getByText(expected.kicker)).toBeTruthy();
  });

  it("calm 입력 시 긴급 원을 렌더하지 않는다", () => {
    render(<BroadsheetHeadline input={calmInput} />);
    expect(screen.queryByText("긴급")).toBeNull();
  });

  it("calm 입력 시 calm 카피(sub)를 표시한다", () => {
    const expected = selectHeadline(calmInput);
    render(<BroadsheetHeadline input={calmInput} />);
    expect(screen.getByText(expected.sub)).toBeTruthy();
  });

  it("최상위 Link의 href가 selectHeadline 결과 href와 일치한다", () => {
    const expected = selectHeadline(urgentInput);
    const { container } = render(<BroadsheetHeadline input={urgentInput} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe(expected.href);
  });
});
