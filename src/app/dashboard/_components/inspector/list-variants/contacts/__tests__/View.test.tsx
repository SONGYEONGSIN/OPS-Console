import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { ContactsView } from "../View";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "김지나",
  status: "active",
  owner: "",
  customerActive: "재직",
  jobTitle: "팀장",
  universityName: "가천대학교",
  departmentName: "입학팀",
  jobRole: "실무자",
  managementGrade: "A",
  relationshipGrade: "우호적",
  contactPhone: "010-1234-5678",
  contactExt: "031-750-1234",
  contactEmail: "kjn@gachon.ac.kr",
};

describe("ContactsView", () => {
  it("11 필드 모두 노출", () => {
    render(<ContactsView row={baseRow} />);
    expect(screen.getByText("김지나")).toBeInTheDocument();
    expect(screen.getByText("팀장")).toBeInTheDocument();
    expect(screen.getByText("가천대학교")).toBeInTheDocument();
    expect(screen.getByText("입학팀")).toBeInTheDocument();
    expect(screen.getByText("실무자")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("우호적")).toBeInTheDocument();
    expect(screen.getByText("010-1234-5678")).toBeInTheDocument();
    expect(screen.getByText("031-750-1234")).toBeInTheDocument();
    expect(screen.getByText("kjn@gachon.ac.kr")).toBeInTheDocument();
  });
});
