import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockBulk } = vi.hoisted(() => ({ mockBulk: vi.fn() }));
vi.mock("@/features/contacts/actions", () => ({
  createContactsBulk: mockBulk,
}));

import { BulkPasteContacts } from "../BulkPasteContacts";
import { createContactsBulk } from "@/features/contacts/actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockBulk.mockResolvedValue({ ok: true, inserted: 1, duplicates: [] });
});

function open() {
  render(<BulkPasteContacts />);
  fireEvent.click(screen.getByRole("button", { name: /일괄등록/ }));
}

describe("BulkPasteContacts", () => {
  it("버튼 클릭 시 모달(붙여넣기 textarea) 노출", () => {
    open();
    expect(screen.getByLabelText("연락처 붙여넣기")).toBeInTheDocument();
  });

  it("붙여넣기 시 유효/오류 행 미리보기", () => {
    open();
    fireEvent.change(screen.getByLabelText("연락처 붙여넣기"), {
      target: { value: "대학명\t고객명\n서강대\t김담당\n연세대\t" },
    });
    expect(screen.getByText(/유효 1건/)).toBeInTheDocument();
    expect(screen.getByText(/오류 1건/)).toBeInTheDocument();
  });

  it("등록 클릭 시 유효 행만 createContactsBulk 호출", async () => {
    open();
    fireEvent.change(screen.getByLabelText("연락처 붙여넣기"), {
      target: { value: "대학명\t고객명\n서강대\t김담당" },
    });
    fireEvent.click(screen.getByRole("button", { name: /건 등록/ }));
    await waitFor(() => expect(createContactsBulk).toHaveBeenCalledTimes(1));
    const arg = mockBulk.mock.calls[0][0];
    expect(arg).toHaveLength(1);
    expect(arg[0]).toMatchObject({
      university_name: "서강대",
      customer_name: "김담당",
    });
  });

  it("결과(등록/중복) 표시", async () => {
    mockBulk.mockResolvedValue({
      ok: true,
      inserted: 1,
      duplicates: [{ university_name: "연세대", customer_name: "박담당" }],
    });
    open();
    fireEvent.change(screen.getByLabelText("연락처 붙여넣기"), {
      target: { value: "대학명\t고객명\n서강대\t김담당" },
    });
    fireEvent.click(screen.getByRole("button", { name: /건 등록/ }));
    expect(await screen.findByText(/1건 등록 완료/)).toBeInTheDocument();
    expect(screen.getByText(/중복 1건/)).toBeInTheDocument();
  });
});
