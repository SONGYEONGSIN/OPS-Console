import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SchoolContactPicker } from "../SchoolContactPicker";
import type { SchoolContact } from "@/features/handover/schemas";

const candidates = [
  {
    name: "김담당",
    jobTitle: "실무",
    phone: "051-510-0000",
    email: "kim@univ.ac.kr",
  },
  { name: "이전산", jobTitle: "전산", phone: null, email: "lee@univ.ac.kr" },
];

describe("SchoolContactPicker", () => {
  it("검색어 입력 시 대학 연락처 후보 표시", () => {
    render(
      <SchoolContactPicker candidates={candidates} items={[]} onChange={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText("학교담당자 검색"), {
      target: { value: "김" },
    });
    expect(
      screen.getByRole("button", { name: /김담당/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /이전산/ })).toBeNull();
  });

  it("후보 선택 시 구조화 항목으로 리스트에 추가", () => {
    const onChange = vi.fn();
    render(
      <SchoolContactPicker candidates={candidates} items={[]} onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText("학교담당자 검색"), {
      target: { value: "김" },
    });
    fireEvent.click(screen.getByRole("button", { name: /김담당/ }));
    const added = onChange.mock.calls[0][0] as SchoolContact[];
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      name: "김담당",
      jobTitle: "실무",
      phone: "051-510-0000",
      email: "kim@univ.ac.kr",
    });
  });

  it("이미 추가된 동일 담당자는 중복 추가하지 않는다", () => {
    const onChange = vi.fn();
    const items: SchoolContact[] = [
      {
        id: "x",
        name: "김담당",
        jobTitle: "실무",
        phone: "051-510-0000",
        email: "kim@univ.ac.kr",
      },
    ];
    render(
      <SchoolContactPicker
        candidates={candidates}
        items={items}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("학교담당자 검색"), {
      target: { value: "김" },
    });
    const results = screen.getByLabelText("연락처 검색 결과");
    fireEvent.click(within(results).getByRole("button", { name: /김담당/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("추가된 담당자 × 클릭 시 리스트에서 제거", () => {
    const onChange = vi.fn();
    const items: SchoolContact[] = [
      {
        id: "x",
        name: "김담당",
        jobTitle: "실무",
        phone: null,
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
    expect(screen.getByText(/등록된 대학 연락처가 없습니다/)).toBeInTheDocument();
  });
});
