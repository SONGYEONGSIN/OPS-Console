import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CopySection } from "../CopySection";

const candidates = [
  {
    id: "svc-1",
    serviceId: 101,
    universityName: "숙명여자대학교",
    serviceName: "Fall Admission Graduate",
    hasRecord: false,
  },
  {
    id: "svc-2",
    serviceId: 102,
    universityName: "한동대학교",
    serviceName: "International Law School",
    hasRecord: true,
  },
];

function setup() {
  const onCopy = vi.fn(async () => ({ ok: true as const, copiedCount: 1 }));
  render(
    <CopySection
      fromServiceId="svc-0"
      candidates={candidates}
      onCopy={onCopy}
    />,
  );
  return { onCopy };
}

describe("CopySection", () => {
  it("검색창 기본 표준 — 돋보기 아이콘 + search-field 배경", () => {
    setup();
    const input = screen.getByLabelText("복제 대상 서비스 검색");
    expect(input.className).toContain("bg-search-field-bg");
    const icon = input.parentElement?.querySelector("svg[aria-hidden]");
    expect(icon).not.toBeNull();
  });

  it("검색어 입력 → 자기 자신 제외 후보 필터", () => {
    setup();
    const input = screen.getByLabelText("복제 대상 서비스 검색");
    fireEvent.change(input, { target: { value: "숙명" } });
    expect(screen.getByText(/숙명여자대학교/)).toBeInTheDocument();
    expect(screen.queryByText(/한동대학교/)).toBeNull();
  });
});
