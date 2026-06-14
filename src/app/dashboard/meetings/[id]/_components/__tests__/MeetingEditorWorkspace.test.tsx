import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { MeetingRow } from "@/features/meetings/schemas";

const { mockUpdateMeta, mockSend } = vi.hoisted(() => ({
  mockUpdateMeta: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock("@/features/meetings/actions", () => ({
  updateMeetingMeta: mockUpdateMeta,
}));
vi.mock("@/features/meetings/mail-actions", () => ({
  sendMeetingMinutes: mockSend,
}));
// dynamic import 대상 — 실제 BlockNote 로드 회피
vi.mock("../../../_components/MeetingEditor", () => ({
  MeetingEditor: ({ id }: { id: string }) => (
    <div data-testid="meeting-editor">{id}</div>
  ),
}));

import { MeetingEditorWorkspace } from "../MeetingEditorWorkspace";

const meeting: MeetingRow = {
  id: "m-1",
  type: "regular",
  title: "주간 운영 회의",
  meeting_date: "2026-06-10 14:00",
  location: "본사 3층",
  attendees: ["송영신", "이해영"],
  author_email: "ys@example.com",
  status: "draft",
  content: [],
  sharepoint_url: null,
  created_at: "2026-06-10T00:00:00Z",
  updated_at: "2026-06-10T00:00:00Z",
};

beforeEach(() => vi.clearAllMocks());

describe("MeetingEditorWorkspace", () => {
  it("유형·상태 배지와 제목/장소/참석자 초기값을 표시한다", () => {
    render(<MeetingEditorWorkspace meeting={meeting} />);
    expect(screen.getByText("정기회의")).toBeInTheDocument();
    expect(screen.getByText("작성중")).toBeInTheDocument();
    expect(screen.getByDisplayValue("주간 운영 회의")).toBeInTheDocument();
    expect(screen.getByDisplayValue("본사 3층")).toBeInTheDocument();
    expect(screen.getByDisplayValue("송영신, 이해영")).toBeInTheDocument();
  });

  it("제목 blur 시 updateMeetingMeta로 메타를 저장한다", async () => {
    mockUpdateMeta.mockResolvedValue({ ok: true });
    render(<MeetingEditorWorkspace meeting={meeting} />);
    const titleInput = screen.getByDisplayValue("주간 운영 회의");
    fireEvent.change(titleInput, { target: { value: "변경된 제목" } });
    fireEvent.blur(titleInput);
    await waitFor(() =>
      expect(mockUpdateMeta).toHaveBeenCalledWith(
        "m-1",
        expect.objectContaining({
          title: "변경된 제목",
          location: "본사 3층",
          attendees: ["송영신", "이해영"],
        }),
      ),
    );
  });

  it("일시 input을 변경하면 ISO 문자열로 meeting_date를 저장한다", async () => {
    mockUpdateMeta.mockResolvedValue({ ok: true });
    render(<MeetingEditorWorkspace meeting={meeting} />);
    const dateInput = document.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    fireEvent.change(dateInput, { target: { value: "2026-07-01T10:30" } });
    fireEvent.blur(dateInput);
    await waitFor(() => expect(mockUpdateMeta).toHaveBeenCalled());
    const arg = mockUpdateMeta.mock.calls[0][1] as { meeting_date: string };
    expect(arg.meeting_date).toBe(new Date("2026-07-01T10:30").toISOString());
  });

  it("일시를 비우면 meeting_date를 null로 저장한다", async () => {
    mockUpdateMeta.mockResolvedValue({ ok: true });
    render(<MeetingEditorWorkspace meeting={{ ...meeting, meeting_date: null }} />);
    const dateInput = document.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement;
    fireEvent.blur(dateInput);
    await waitFor(() => expect(mockUpdateMeta).toHaveBeenCalled());
    const arg = mockUpdateMeta.mock.calls[0][1] as { meeting_date: string | null };
    expect(arg.meeting_date).toBeNull();
  });

  it("메일 발송 시 참석자 목록으로 sendMeetingMinutes를 호출한다", async () => {
    mockSend.mockResolvedValue({ ok: true });
    render(<MeetingEditorWorkspace meeting={meeting} />);
    fireEvent.click(screen.getByRole("button", { name: "메일 발송" }));
    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith("m-1", ["송영신", "이해영"]),
    );
  });
});
