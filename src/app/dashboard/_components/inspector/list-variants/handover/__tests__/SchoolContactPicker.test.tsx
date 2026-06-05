import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SchoolContactPicker } from "../SchoolContactPicker";

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
      <SchoolContactPicker candidates={candidates} value="" onChange={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText("학교담당자 검색"), {
      target: { value: "김" },
    });
    expect(screen.getByText(/김담당/)).toBeInTheDocument();
    expect(screen.queryByText(/이전산/)).toBeNull();
  });

  it("후보 선택 시 이름·직함·전화·이메일을 본문에 추가", () => {
    const onChange = vi.fn();
    render(
      <SchoolContactPicker candidates={candidates} value="" onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText("학교담당자 검색"), {
      target: { value: "김" },
    });
    fireEvent.click(screen.getByRole("button", { name: /김담당/ }));
    const added = onChange.mock.calls[0][0] as string;
    expect(added).toContain("김담당 (실무)");
    expect(added).toContain("051-510-0000");
    expect(added).toContain("kim@univ.ac.kr");
  });

  it("기존 내용이 있으면 줄바꿈 후 이어붙인다", () => {
    const onChange = vi.fn();
    render(
      <SchoolContactPicker
        candidates={candidates}
        value="기존내용"
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("학교담당자 검색"), {
      target: { value: "이전산" },
    });
    fireEvent.click(screen.getByRole("button", { name: /이전산/ }));
    expect(onChange.mock.calls[0][0]).toMatch(/^기존내용\n\n/);
  });

  it("후보 없으면 안내 문구", () => {
    render(
      <SchoolContactPicker candidates={[]} value="" onChange={() => {}} />,
    );
    expect(screen.getByText(/등록된 대학 연락처가 없습니다/)).toBeInTheDocument();
  });
});
