import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { draftSpy, result } = vi.hoisted(() => ({
  draftSpy: vi.fn(),
  result: { value: { ok: true } as unknown },
}));
vi.mock("@/features/knowledge/file-draft-actions", () => ({
  requestFileDraft: (...a: unknown[]) => {
    draftSpy(...a);
    return Promise.resolve(result.value);
  },
}));

const { FileDraftForm } = await import("../FileDraftForm");

const LINK = "https://tenant.sharepoint.com/sites/운영부/보고서.docx";

/**
 * 파일 탐색 화면을 따로 두지 않고 링크를 붙여넣게 한다 — 채널 파일·채팅 파일·
 * 내 OneDrive 가 각각 다른 곳에 있어 어느 하나를 고르는 화면으로는 나머지를 못 넣는다.
 */
describe("FileDraftForm", () => {
  beforeEach(() => {
    draftSpy.mockClear();
    result.value = { ok: true };
  });

  const typeLink = (v: string) =>
    fireEvent.change(screen.getByLabelText("파일 링크"), {
      target: { value: v },
    });

  it("링크가 비면 못 누른다 — 빈 요청이 큐에 쌓이지 않게", () => {
    render(<FileDraftForm />);
    expect(screen.getByRole("button", { name: "초안 요청" })).toBeDisabled();
  });

  it("링크와 요청 내용을 함께 보낸다", async () => {
    render(<FileDraftForm />);
    typeLink(LINK);
    fireEvent.change(screen.getByLabelText(/무엇을 정리할지/), {
      target: { value: "수수료 규칙만" },
    });
    fireEvent.click(screen.getByRole("button", { name: "초안 요청" }));
    await waitFor(() =>
      expect(draftSpy).toHaveBeenCalledWith(LINK, "수수료 규칙만"),
    );
  });

  it("얼마나 걸리는지 알린다 — 30초를 아무 말 없이 두면 죽은 줄 안다", async () => {
    render(<FileDraftForm />);
    typeLink(LINK);
    fireEvent.click(screen.getByRole("button", { name: "초안 요청" }));
    await waitFor(() =>
      expect(screen.getByText(/제안\/ 에 초안이 생깁니다/)).toBeInTheDocument(),
    );
  });

  it("성공하면 링크 칸을 비운다 — 같은 파일을 두 번 넣기 쉽다", async () => {
    render(<FileDraftForm />);
    typeLink(LINK);
    fireEvent.click(screen.getByRole("button", { name: "초안 요청" }));
    await waitFor(() =>
      expect(screen.getByLabelText("파일 링크")).toHaveValue(""),
    );
  });

  it("실패하면 사유를 그대로 보여준다 — 링크가 왜 안 되는지가 조치다", async () => {
    result.value = { ok: false, error: "사내 SharePoint 링크만 받습니다" };
    render(<FileDraftForm />);
    typeLink("https://evil.example.com/a.docx");
    fireEvent.click(screen.getByRole("button", { name: "초안 요청" }));
    await waitFor(() =>
      expect(screen.getByText(/사내 SharePoint 링크만/)).toBeInTheDocument(),
    );
  });

  it("실패하면 링크를 지우지 않는다 — 고쳐서 다시 눌러야 한다", async () => {
    result.value = { ok: false, error: "안 됩니다" };
    render(<FileDraftForm />);
    typeLink(LINK);
    fireEvent.click(screen.getByRole("button", { name: "초안 요청" }));
    await waitFor(() => expect(screen.getByText("안 됩니다")).toBeInTheDocument());
    expect(screen.getByLabelText("파일 링크")).toHaveValue(LINK);
  });

  it("제안/ 을 거친다고 미리 알린다 — 바로 볼트에 들어가는 줄 알면 안 된다", () => {
    render(<FileDraftForm />);
    expect(screen.getByText(/본\s*위치로 옮기는 것은 사람이/)).toBeInTheDocument();
  });
});
