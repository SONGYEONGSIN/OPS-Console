import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/features/announcement-services/actions", () => ({
  upsertAnnouncementServicesBulk: vi.fn(),
}));

import { BulkPasteAnnouncements } from "../BulkPasteAnnouncements";
import { HEADER_ACTION_CLASS } from "@/components/common/HeaderActionButton";
import { upsertAnnouncementServicesBulk } from "@/features/announcement-services/actions";

const HEADER =
  "UnivId\tUnivName\tUnivServiceId\tServiceName\t발표제목\t발표시작일시(실제)";
const ROW1 =
  "3004\t국립한밭대\t300416\t외국인 합격자발표\t전기 발표\t2026-01-12 14:00:00.000";
const ROW2 =
  "3004\t국립한밭대\t300416\t외국인 합격자발표\t추가 발표\t2026-03-02 14:00:00.000";

function openModal() {
  render(<BulkPasteAnnouncements />);
  fireEvent.click(screen.getByText("+ 발표 서비스 일괄등록"));
}

describe("BulkPasteAnnouncements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(upsertAnnouncementServicesBulk).mockResolvedValue({
      ok: true,
      upserted: 1,
    });
  });

  it("붙여넣으면 유효 건수와 합쳐진 회차 수를 미리 보여준다", () => {
    openModal();
    fireEvent.change(screen.getByLabelText("발표 서비스 붙여넣기"), {
      target: { value: [HEADER, ROW1, ROW2].join("\n") },
    });
    expect(screen.getByText(/유효 1건/)).toBeInTheDocument();
    expect(screen.getByText(/회차 중복 1줄 합침/)).toBeInTheDocument();
  });

  it("필수 열이 없으면 등록 버튼이 막힌다", () => {
    openModal();
    fireEvent.change(screen.getByLabelText("발표 서비스 붙여넣기"), {
      target: { value: "대학명\t서비스명\n한밭대\t발표" },
    });
    expect(screen.getByText("등록")).toBeDisabled();
  });

  it("등록하면 서비스 단위로 합쳐진 행만 서버로 보낸다", async () => {
    openModal();
    fireEvent.change(screen.getByLabelText("발표 서비스 붙여넣기"), {
      target: { value: [HEADER, ROW1, ROW2].join("\n") },
    });
    fireEvent.click(screen.getByText("등록"));

    await waitFor(() =>
      expect(upsertAnnouncementServicesBulk).toHaveBeenCalledTimes(1),
    );
    const [payload] = vi.mocked(upsertAnnouncementServicesBulk).mock.calls[0];
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      service_id: 300416,
      university_name: "국립한밭대",
    });
    await screen.findByText(/1건 등록 완료/);
  });

  it("서버가 실패를 돌려주면 사유를 보여준다", async () => {
    vi.mocked(upsertAnnouncementServicesBulk).mockResolvedValue({
      ok: false,
      upserted: 0,
      error: "등록 권한이 없습니다.",
    });
    openModal();
    fireEvent.change(screen.getByLabelText("발표 서비스 붙여넣기"), {
      target: { value: [HEADER, ROW1].join("\n") },
    });
    fireEvent.click(screen.getByText("등록"));
    await screen.findByText("등록 권한이 없습니다.");
  });
});

/**
 * 목록 헤더 액션 버튼은 **모양이 하나뿐**이다 — vermilion 배경(`HEADER_ACTION_CLASS`).
 *
 * 이 슬롯이 한때 셋으로 갈려 있었다: 생성 버튼은 vermilion, 연락처 일괄등록은 잉크,
 * 발표 서비스 일괄등록은 외곽선. 클래스 문자열을 손으로 적으면 그때마다 갈린다 —
 * 그래서 컴포넌트를 쓴다(#1047 에서 같은 이유로 컴포넌트가 생겼다).
 */
describe("BulkPasteAnnouncements — 헤더 액션 버튼 표준", () => {
  it("표준 클래스를 쓴다 — 손으로 적은 외곽선이 아니다", () => {
    render(<BulkPasteAnnouncements />);
    const btn = screen.getByText("+ 발표 서비스 일괄등록");
    expect(btn.className).toBe(HEADER_ACTION_CLASS);
  });
});
