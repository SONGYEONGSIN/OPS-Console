import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PageActivityLogger } from "../PageActivityLogger";
import type { SbSection } from "../../_data";

const fetchMock = vi.fn();
const beaconMock = vi.fn();

let mockPathname = "/dashboard/handover";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

const sections: SbSection[] = [
  {
    title: "요청",
    entries: [{ kind: "item", ico: "◈", label: "인수인계", slug: "handover" }],
  },
];

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
  beaconMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "sendBeacon", {
    value: beaconMock,
    writable: true,
    configurable: true,
  });
  mockPathname = "/dashboard/handover";
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PageActivityLogger", () => {
  it("mount 시 페이지 진입 fetch — slug + label", () => {
    render(<PageActivityLogger sections={sections} />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.domain).toBe("nav");
    expect(body.action).toBe("enter");
    expect(body.target_id).toBe("handover");
    expect(body.target_name).toBe("인수인계");
  });

  it("unmount 시 sendBeacon — leave 이벤트", () => {
    const { unmount } = render(<PageActivityLogger sections={sections} />);
    unmount();
    expect(beaconMock).toHaveBeenCalledTimes(1);
  });

  it("dashboard 외 경로 → 로깅 skip", () => {
    mockPathname = "/login";
    render(<PageActivityLogger sections={sections} />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
