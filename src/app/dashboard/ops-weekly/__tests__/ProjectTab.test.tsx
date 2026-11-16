import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

const saveProjectEntry = vi.fn();
const uploadWeeklyImage = vi.fn();
vi.mock("@/features/ops-weekly/actions", () => ({
  saveProjectEntry: (...a: unknown[]) => saveProjectEntry(...a),
  uploadWeeklyImage: (...a: unknown[]) => uploadWeeklyImage(...a),
  saveAreaNote: vi.fn(),
  markTabChecked: vi.fn(),
}));

import { ProjectTab } from "../_components/ProjectTab";
import type { ProjectEntryView } from "@/features/ops-weekly/merge";
import { inOrder } from "./heading-order";

const N = { thisWeek: "", nextWeek: "" };

function entry(
  id: string,
  kind: "project" | "tf",
  sortOrder: number,
  over: Partial<ProjectEntryView> = {},
): ProjectEntryView {
  return {
    projectId: id,
    projectName: id,
    kind,
    sortOrder,
    operatorEmail: "a@example.com",
    operatorName: "운영자A",
    stage: null,
    thisWeek: "",
    nextWeek: "",
    ...over,
  };
}

beforeEach(() => {
  cleanup();
  saveProjectEntry.mockReset().mockResolvedValue({ ok: true });
  uploadWeeklyImage.mockReset();
});

describe("ProjectTab", () => {
  it("TF 탭에는 TF 만, 정렬 순서대로", () => {
    render(
      <ProjectTab
        kind="tf"
        entries={[
          entry("p", "project", 10),
          entry("t2", "tf", 30),
          entry("t1", "tf", 20),
        ]}
        reportId="r"
        editable
        notes={N}
      />,
    );
    inOrder(["t1", "t2"]);
    expect(screen.queryByRole("heading", { name: "p" })).toBeNull();
  });

  it("진행 단계 셀렉트는 8개 고정 순서 + 미선택", () => {
    render(
      <ProjectTab
        kind="project"
        entries={[entry("p", "project", 10)]}
        reportId="r"
        editable
        notes={N}
      />,
    );
    expect(
      within(screen.getByLabelText("진행 단계"))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([
      "단계 미선택",
      "기획",
      "요구분석",
      "설계",
      "개발",
      "테스트",
      "배포",
      "운영",
      "보류",
    ]);
  });

  it("단계를 바꾸면 entry 전체를 저장한다", async () => {
    render(
      <ProjectTab
        kind="project"
        entries={[entry("p", "project", 10, { thisWeek: "<p>a</p>" })]}
        reportId="r"
        editable
        notes={N}
      />,
    );
    fireEvent.change(screen.getByLabelText("진행 단계"), {
      target: { value: "테스트" },
    });
    await waitFor(() =>
      expect(saveProjectEntry).toHaveBeenCalledWith({
        reportId: "r",
        projectId: "p",
        stage: "테스트",
        thisWeek: "<p>a</p>",
        nextWeek: "",
      }),
    );
  });

  it("맡은 TF 가 없으면 안내", () => {
    render(
      <ProjectTab kind="tf" entries={[]} reportId="r" editable notes={N} />,
    );
    expect(screen.getByText("맡은 TF가 없습니다")).toBeInTheDocument();
    expect(
      screen.getByText("관리자 설정에서 담당자를 지정합니다"),
    ).toBeInTheDocument();
  });

  it("편집 불가면 셀렉트 없이 단계를 글로", () => {
    render(
      <ProjectTab
        kind="project"
        entries={[entry("p", "project", 10, { stage: "배포" })]}
        reportId="r"
        editable={false}
        notes={N}
      />,
    );
    expect(screen.queryByLabelText("진행 단계")).toBeNull();
    expect(screen.getByText("배포")).toBeInTheDocument();
  });

  it("읽기 전용 — 서명된 그림이 src 그대로 보인다", () => {
    render(
      <ProjectTab
        kind="project"
        reportId="r"
        editable={false}
        notes={N}
        entries={[
          entry("p", "project", 10, {
            thisWeek:
              '<p>a</p><img src="https://signed/1" data-ops-path="2026-11-16/r/x.png" alt="첨부 이미지">',
          }),
        ]}
      />,
    );
    expect(screen.getByAltText("첨부 이미지")).toHaveAttribute(
      "src",
      "https://signed/1",
    );
  });

  function pasteImage() {
    const file = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.paste(screen.getAllByRole("textbox")[0], {
      clipboardData: {
        items: [{ type: "image/png", getAsFile: () => file }],
      },
    });
  }

  it("업로드 중에 단계를 바꿔도 그림 저장이 새 단계를 싣는다", async () => {
    let resolveUpload: (v: { ok: true; url: string }) => void = () => {};
    uploadWeeklyImage.mockReturnValue(
      new Promise((r) => {
        resolveUpload = r;
      }),
    );
    render(
      <ProjectTab
        kind="project"
        entries={[entry("p", "project", 10)]}
        reportId="r"
        editable
        notes={N}
      />,
    );
    pasteImage();
    await waitFor(() => expect(uploadWeeklyImage).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("진행 단계"), {
      target: { value: "개발" },
    });
    saveProjectEntry.mockClear();
    resolveUpload({ ok: true, url: "https://signed/new" });
    await waitFor(() => expect(saveProjectEntry).toHaveBeenCalled());
    expect(saveProjectEntry.mock.calls[0][0]).toMatchObject({
      stage: "개발",
      nextWeek: "",
    });
  });

  it("업로드가 던지면 카드 아래에 오류를 보인다", async () => {
    uploadWeeklyImage.mockRejectedValue(new Error("net"));
    render(
      <ProjectTab
        kind="project"
        entries={[entry("p", "project", 10)]}
        reportId="r"
        editable
        notes={N}
      />,
    );
    pasteImage();
    expect(await screen.findByText(/저장하지 못했습니다/)).toBeInTheDocument();
  });
});
