import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SchoolContactPicker } from "../SchoolContactPicker";
import type { SchoolContact } from "@/features/handover/schemas";

const candidates = [
  {
    name: "김담당",
    jobTitle: "실무",
    phone: "051-510-0000",
    ext: "1234",
    email: "kim@univ.ac.kr",
  },
  {
    name: "이전산",
    jobTitle: "전산",
    phone: null,
    ext: null,
    email: "lee@univ.ac.kr",
  },
];

describe("SchoolContactPicker", () => {
  it("셀렉트에 대학 연락처 후보 표시 (이름·직함·이메일 라벨)", () => {
    render(
      <SchoolContactPicker
        candidates={candidates}
        items={[]}
        onChange={() => {}}
      />,
    );
    const select = screen.getByLabelText("학교담당자 선택");
    expect(select).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "김담당 (실무) · kim@univ.ac.kr" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "이전산 (전산) · lee@univ.ac.kr" }),
    ).toBeInTheDocument();
  });

  it("셀렉트에서 선택 시 구조화 항목으로 추가 + 셀렉트 리셋", () => {
    const onChange = vi.fn();
    render(
      <SchoolContactPicker
        candidates={candidates}
        items={[]}
        onChange={onChange}
      />,
    );
    const select = screen.getByLabelText("학교담당자 선택") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "0" } });
    const added = onChange.mock.calls[0][0] as SchoolContact[];
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      name: "김담당",
      jobTitle: "실무",
      phone: "051-510-0000",
      ext: "1234",
      email: "kim@univ.ac.kr",
    });
    expect(select.value).toBe("");
  });

  it("이미 추가된 담당자는 셀렉트 옵션에서 제외", () => {
    const items: SchoolContact[] = [
      {
        id: "x",
        name: "김담당",
        jobTitle: "실무",
        phone: "051-510-0000",
        ext: "1234",
        email: "kim@univ.ac.kr",
      },
    ];
    render(
      <SchoolContactPicker
        candidates={candidates}
        items={items}
        onChange={() => {}}
      />,
    );
    expect(
      screen.queryByRole("option", { name: /김담당/ }),
    ).toBeNull();
    expect(
      screen.getByRole("option", { name: /이전산/ }),
    ).toBeInTheDocument();
  });

  it("추가된 담당자 × 클릭 시 리스트에서 제거", () => {
    const onChange = vi.fn();
    const items: SchoolContact[] = [
      {
        id: "x",
        name: "김담당",
        jobTitle: "실무",
        phone: null,
        ext: null,
        email: null,
      },
    ];
    render(
      <SchoolContactPicker
        candidates={candidates}
        items={items}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "김담당 삭제" }));
    expect(onChange.mock.calls[0][0]).toHaveLength(0);
  });

  it("후보 없으면 안내 문구", () => {
    render(
      <SchoolContactPicker candidates={[]} items={[]} onChange={() => {}} />,
    );
    expect(
      screen.getByText(/등록된 대학 연락처가 없습니다/),
    ).toBeInTheDocument();
  });
});
