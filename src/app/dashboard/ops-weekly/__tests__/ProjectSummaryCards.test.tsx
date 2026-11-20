import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import type { ProjectEntryView } from "@/features/ops-weekly/merge";
import type { Area } from "@/features/ops-weekly/constants";

vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import { ProjectDrawer } from "../_components/ProjectDrawer";
import { ProjectDrawerProvider } from "../_components/project-drawer-context";
import {
  ProjectSummaryCards,
  remainingOf,
} from "../_components/ProjectSummaryCards";
import { setUrl } from "./search-params-mock";

afterEach(cleanup);

function entry(kind: "project" | "tf", thisWeek: string): ProjectEntryView {
  return {
    projectId: `${kind}-${thisWeek}`,
    projectName: "p",
    kind,
    sortOrder: 10,
    operatorEmail: "a@example.com",
    operatorName: "운영자A",
    stage: null,
    thisWeek,
    nextWeek: "",
  };
}

function renderCards(props: {
  entries: ProjectEntryView[];
  checked: Area[];
  editable: boolean;
}) {
  setUrl("?week=2026-11-16&tab=application");
  return render(
    <ProjectDrawerProvider>
      <ProjectSummaryCards {...props} />
    </ProjectDrawerProvider>,
  );
}

const tokens = (el: Element) => el.className.split(/\s+/);

describe("remainingOf", () => {
  it("빈 HTML(<p><br></p>·&nbsp;)은 남음, 그림만 있으면 남음 아님", () => {
    const es = [
      entry("project", ""),
      entry("project", "<p><br></p>"),
      entry("project", "<p>&nbsp;</p>"),
      entry("project", '<p><img data-ops-path="a.png"></p>'),
      entry("project", "<p>진행</p>"),
      entry("tf", ""),
    ];
    expect(remainingOf(es, "project")).toBe(3);
    expect(remainingOf(es, "tf")).toBe(1);
  });
});

describe("ProjectSummaryCards", () => {
  it("카드 — '프로젝트 2건 · 1건 남음' + [쓰기], 확인한 종류는 ✓", () => {
    renderCards({
      entries: [entry("project", ""), entry("project", "<p>진행</p>")],
      checked: ["project"],
      editable: true,
    });
    const card = screen.getByText(/^프로젝트/).closest("div") as Element;
    expect(card).toHaveTextContent("프로젝트 ✓");
    expect(card).toHaveTextContent("2건 · 1건 남음");
    expect(tokens(card)).toEqual(
      expect.arrayContaining(["bg-situation-bg", "border-line-soft"]),
    );
    const btn = within(card as HTMLElement).getByRole("button", { name: "프로젝트 쓰기" });
    expect(tokens(btn)).toEqual(
      expect.arrayContaining(["min-h-9", "hover:bg-ink", "hover:text-cream"]),
    );
  });

  it("카드 이름은 제목 요소가 아니다 — 서랍 머리와 같은 이름의 heading 이 둘이 되지 않게", () => {
    renderCards({ entries: [], checked: [], editable: true });
    expect(screen.queryAllByRole("heading")).toHaveLength(0);
  });

  it("남음이 없으면 건수만, 편집할 수 없으면 [보기]", () => {
    renderCards({
      entries: [entry("tf", "<p>진행</p>")],
      checked: [],
      editable: false,
    });
    const card = screen.getByText(/^TF/).closest("div") as HTMLElement;
    expect(card).toHaveTextContent("1건");
    expect(card).not.toHaveTextContent("남음");
    expect(within(card).getByRole("button", { name: "TF 보기" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "TF 쓰기" })).toBeNull();
  });

  it("[쓰기]는 서랍을 열되 주소는 그대로", () => {
    renderCards({ entries: [], checked: [], editable: true });
    const card = screen.getByText(/^TF/).closest("div") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "TF 쓰기" }));
    expect(window.location.search).toBe("?week=2026-11-16&tab=application");
  });

  it("두 카드의 버튼 이름이 서로 다르다 — 종류가 이름에 들어 있다", () => {
    renderCards({ entries: [], checked: [], editable: true });
    expect(screen.getByRole("button", { name: "프로젝트 쓰기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "TF 쓰기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "쓰기" })).toBeNull();
  });

  it("카드의 [쓰기]가 서랍을 연다 — 내용이 inert 에서 풀리고 서랍이 aria-hidden=false", () => {
    setUrl("?week=2026-11-16&tab=application");
    render(
      <ProjectDrawerProvider>
        <ProjectSummaryCards entries={[]} checked={[]} editable />
        <ProjectDrawer
          panels={{ project: <input aria-label="프로젝트 글" />, tf: <input aria-label="TF 글" /> }}
        />
      </ProjectDrawerProvider>,
    );
    const field = screen.getByLabelText("TF 글");
    expect(field.closest("[inert]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "TF 쓰기" }));
    expect(field.closest("[inert]")).toBeNull();
    expect(field.closest("[hidden]")).toBeNull();
    expect(field.closest("aside")).toHaveAttribute("aria-hidden", "false");
  });
});
