import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { SbSection } from "../../_data";

let mockPathname = "/dashboard/team";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { DocumentTitle } from "../DocumentTitle";

const sections: SbSection[] = [
  {
    title: "관리",
    entries: [
      { kind: "item", ico: "◉", label: "팀 구성원", slug: "team" },
      {
        kind: "group",
        label: "게시판",
        items: [{ ico: "◉", label: "개선요청", slug: "feedback" }],
      },
    ],
  },
];

describe("DocumentTitle", () => {
  beforeEach(() => {
    document.title = "";
  });

  it("section 직속 메뉴 → '운영부 상황실 - {label}'", () => {
    mockPathname = "/dashboard/team";
    render(<DocumentTitle sections={sections} />);
    expect(document.title).toBe("운영부 상황실 - 팀 구성원");
  });

  it("그룹 내 메뉴 → '운영부 상황실 - {label}'", () => {
    mockPathname = "/dashboard/feedback";
    render(<DocumentTitle sections={sections} />);
    expect(document.title).toBe("운영부 상황실 - 개선요청");
  });

  it("매칭 없는 경로 → base 타이틀만", () => {
    mockPathname = "/dashboard";
    render(<DocumentTitle sections={sections} />);
    expect(document.title).toBe("운영부 상황실");
  });

  it("미등록 slug → base 타이틀만 (slug 노출 안 함)", () => {
    mockPathname = "/dashboard/zzz-nope";
    render(<DocumentTitle sections={sections} />);
    expect(document.title).toBe("운영부 상황실");
  });
});
