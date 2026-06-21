import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { MeetingRow } from "@/features/meetings/schemas";
import { buildSeedDoc } from "@/features/meetings/form-templates";

const { mockUpdateMeta, mockSend, mockSaveContent } = vi.hoisted(() => ({
  mockUpdateMeta: vi.fn(),
  mockSend: vi.fn(),
  mockSaveContent: vi.fn(),
}));

vi.mock("@/features/meetings/actions", () => ({
  updateMeetingMeta: mockUpdateMeta,
  saveMeetingContent: mockSaveContent,
}));
vi.mock("@/features/meetings/mail-actions", () => ({
  sendMeetingMinutes: mockSend,
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
  content: buildSeedDoc("regular"),
  sharepoint_url: null,
  created_at: "2026-06-10T00:00:00Z",
  updated_at: "2026-06-10T00:00:00Z",
} as unknown as MeetingRow;

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateMeta.mockResolvedValue({ ok: true });
  mockSaveContent.mockResolvedValue({ ok: true });
});

describe("MeetingEditorWorkspace (v2 양식)", () => {
  it("유형 회의록·상태 배지와 제목/장소/참석자 초기값을 표시한다", () => {
    render(<MeetingEditorWorkspace meeting={meeting} />);
    expect(screen.getByText(/정기회의 회의록/)).toBeInTheDocument();
    expect(screen.getByText("작성중")).toBeInTheDocument();
    expect(screen.getByText("주간 운영 회의")).toBeInTheDocument();
    expect(screen.getByDisplayValue("본사 3층")).toBeInTheDocument();
    // 양식 섹션이 렌더됨
    expect(screen.getByText("지난 안건 점검")).toBeInTheDocument();
  });

  it("제목 편집(blur) 시 updateMeetingMeta로 메타를 저장한다", async () => {
    render(<MeetingEditorWorkspace meeting={meeting} />);
    const titleEl = screen.getByText("주간 운영 회의");
    titleEl.textContent = "변경된 제목";
    fireEvent.blur(titleEl);
    await waitFor(() =>
      expect(mockUpdateMeta).toHaveBeenCalledWith(
        "m-1",
        expect.objectContaining({ title: "변경된 제목" }),
      ),
    );
  });

  it("일시 input 변경 시 ISO 문자열로 meeting_date 저장", async () => {
    render(<MeetingEditorWorkspace meeting={meeting} />);
    const dateInput = document.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    fireEvent.change(dateInput, { target: { value: "2026-07-01T10:30" } });
    fireEvent.blur(dateInput);
    await waitFor(() => expect(mockUpdateMeta).toHaveBeenCalled());
    const arg = mockUpdateMeta.mock.calls.at(-1)![1] as { meeting_date: string };
    expect(arg.meeting_date).toBe(new Date("2026-07-01T10:30").toISOString());
  });

  it("표 '행 추가' 시 saveMeetingContent로 자동저장(디바운스)", async () => {
    render(<MeetingEditorWorkspace meeting={meeting} />);
    fireEvent.click(screen.getAllByRole("button", { name: /행 추가/ })[0]);
    await waitFor(() => expect(mockSaveContent).toHaveBeenCalled(), {
      timeout: 2000,
    });
  });

  it("메일 발송 시 참석자 목록으로 sendMeetingMinutes 호출", async () => {
    mockSend.mockResolvedValue({ ok: true });
    render(<MeetingEditorWorkspace meeting={meeting} />);
    fireEvent.click(screen.getByRole("button", { name: "메일 발송" }));
    await waitFor(() =>
      expect(mockSend).toHaveBeenCalledWith("m-1", ["송영신", "이해영"]),
    );
  });

  it("구버전(v1 블록배열) 회의록은 편집 불가 안내", () => {
    render(
      <MeetingEditorWorkspace
        meeting={{ ...meeting, content: [] } as unknown as MeetingRow}
      />,
    );
    expect(screen.getByText(/구버전 양식/)).toBeInTheDocument();
  });
});
