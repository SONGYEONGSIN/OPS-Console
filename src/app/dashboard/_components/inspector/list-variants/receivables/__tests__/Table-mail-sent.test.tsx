import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { ReceivablesTable } from "../Table";

// 칸마다 값이 다르고 "-" 로 빈 칸이 없다. 이웃 칸이 "-" 이거나 같은 값이면
// 새 칸이 한 칸 밀리거나 다른 칸과 바뀌어도 단언이 그대로 통과한다.
const row = (mailSentDate?: string): ListRow => ({
  id: "r-0",
  name: "한양대학교",
  body: "2026학년도 수시 전형료",
  status: "active",
  owner: "송영신",
  author: "₩1,200,000",
  meta: "2026-10-04",
  receivablesCells: {
    headers: [],
    textValues: [],
    schoolOwner: "a@b.kr",
    mailSentDate,
  },
});

function renderTable(rows: ListRow[]) {
  return render(
    <ReceivablesTable rows={rows} selectedId={null} onSelect={vi.fn()} />,
  );
}

const headerTexts = () =>
  screen.getAllByRole("columnheader").map((h) => h.textContent);

// 머리글과 같은 열 번호의 데이터 칸. 머리글이 없거나 th/td 개수가 다르면 여기서 깨진다.
function cellUnder(header: string): HTMLElement {
  const heads = headerTexts();
  const cells = screen.getAllByRole("cell");
  const i = heads.indexOf(header);
  expect(i).toBeGreaterThanOrEqual(0);
  expect(cells).toHaveLength(heads.length);
  return cells[i];
}

describe("ReceivablesTable — 독려메일 발송일자 열", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 청구일자(2026-10-04) +10일 — 경과일수 칸도 "-" 가 아닌 값을 낸다
    vi.setSystemTime(new Date("2026-10-14T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("머리글이 학교 담당자 이메일 바로 다음이다", () => {
    renderTable([row("2026-10-01")]);
    const heads = headerTexts();
    const i = heads.indexOf("학교 담당자 이메일");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(heads[i + 1]).toBe("독려메일 발송일자");
  });

  it("값이 머리글과 같은 열에 놓인다", () => {
    renderTable([row("2026-10-01")]);
    expect(cellUnder("학교 담당자 이메일").textContent).toBe("a@b.kr");
    expect(cellUnder("독려메일 발송일자").textContent).toBe("2026-10-01");
  });

  it("값 칸은 tabular-nums 이고 font-mono 가 아니다", () => {
    renderTable([row("2026-10-01")]);
    const cell = cellUnder("독려메일 발송일자");
    expect(cell.className).toContain("tabular-nums");
    expect(cell.className).not.toContain("font-mono");
  });

  it("빈 값은 - 로 보인다", () => {
    renderTable([row("")]);
    expect(cellUnder("독려메일 발송일자").textContent).toBe("-");
    // 다른 칸도 "-" 면 칸이 어긋나도 위 단언이 통과한다
    expect(screen.getAllByText("-")).toHaveLength(1);
  });

  it("빈 표 colSpan 은 9 이다", () => {
    renderTable([]);
    expect(screen.getByText("데이터 없음").getAttribute("colspan")).toBe("9");
  });
});
