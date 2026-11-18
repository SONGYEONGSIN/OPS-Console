import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
const addRecipient = vi.fn();
const removeRecipient = vi.fn();
const saveRotation = vi.fn();
const saveExcludedWriters = vi.fn();
const upsertProject = vi.fn();
const setProjectOwners = vi.fn();
vi.mock("@/features/ops-weekly/settings-actions", () => ({
  addRecipient: (...a: unknown[]) => addRecipient(...a),
  removeRecipient: (...a: unknown[]) => removeRecipient(...a),
  saveRotation: (...a: unknown[]) => saveRotation(...a),
  saveExcludedWriters: (...a: unknown[]) => saveExcludedWriters(...a),
  upsertProject: (...a: unknown[]) => upsertProject(...a),
  setProjectOwners: (...a: unknown[]) => setProjectOwners(...a),
}));

import { HEADER_ACTION_CLASS } from "@/components/common/HeaderActionButton";
import { SettingsTab } from "../_components/SettingsTab";
import { SEED_PROJECT_NAMES } from "@/features/ops-weekly/constants";
import type { SettingsBundle } from "@/features/ops-weekly/settings-queries";

const cand = (email: string, name: string) => ({
  email,
  name,
  team: "운영1팀",
  role: "사원",
  status: "active",
});
const wa = cand("a@x", "운영자A");
const wb = cand("b@x", "운영자B");
const wt = cand("t@x", "테스트1");

function bundle(over: Partial<SettingsBundle> = {}): SettingsBundle {
  return {
    recipients: [],
    rotation: [],
    anchorWeekStart: null,
    excludedWriterEmails: [],
    writerCandidates: [wa, wb, wt],
    projects: [],
    ...over,
  };
}
const proj = (name: string, i: number) => ({
  id: `p${i}`,
  name,
  kind: "project" as const,
  sortOrder: i,
  active: true,
  owners: [],
});

beforeEach(() => {
  for (const f of [
    addRecipient,
    removeRecipient,
    saveRotation,
    saveExcludedWriters,
    upsertProject,
    setProjectOwners,
  ]) {
    f.mockReset();
    f.mockResolvedValue({ ok: true });
  }
  refresh.mockReset();
});
afterEach(cleanup);

describe("SettingsTab", () => {
  it("메뉴 권한 없는 받는 사람에 경고 배지", () => {
    render(
      <SettingsTab
        bundle={bundle({
          recipients: [{ email: "r@x", name: "부서장A", warning: "no-menu" }],
        })}
      />,
    );
    const region = screen.getByRole("region", { name: "받는 사람" });
    expect(within(region).getByText("메뉴 권한 없음")).toBeInTheDocument();
    expect(
      within(region).getByText("권한은 운영자 관리에서 부여합니다"),
    ).toBeInTheDocument();
  });

  it("받는 사람 추가가 돌려준 경고를 그 자리에 보여 준다", async () => {
    addRecipient.mockResolvedValue({ ok: true, warning: "inactive" });
    render(<SettingsTab bundle={bundle()} />);
    const region = screen.getByRole("region", { name: "받는 사람" });
    fireEvent.change(within(region).getByLabelText("받는 사람 이메일"), {
      target: { value: "r@x" },
    });
    fireEvent.click(within(region).getByRole("button", { name: "추가" }));
    await waitFor(() =>
      expect(addRecipient).toHaveBeenCalledWith({ email: "r@x" }),
    );
    expect(await within(region).findByText(/비활성 계정/)).toBeInTheDocument();
  });

  it("순번 순서 바꾸기 → 저장이 바뀐 순서를 보낸다", async () => {
    render(
      <SettingsTab
        bundle={bundle({
          rotation: ["a@x", "b@x"],
          anchorWeekStart: "2026-11-16",
        })}
      />,
    );
    const region = screen.getByRole("region", { name: "당번 순번" });
    const row = within(region)
      .getByText("운영자B")
      .closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "위로" }));
    fireEvent.click(screen.getByRole("button", { name: "순번 저장" }));
    await waitFor(() =>
      expect(saveRotation).toHaveBeenCalledWith({
        emails: ["b@x", "a@x"],
        anchorWeekStart: "2026-11-16",
      }),
    );
  });

  it("기준 주가 월요일이 아니면 보내지 않고 사유를 보여 준다", () => {
    render(
      <SettingsTab
        bundle={bundle({
          rotation: ["a@x"],
          anchorWeekStart: "2026-11-17",
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "순번 저장" }));
    expect(saveRotation).not.toHaveBeenCalled();
    expect(
      screen.getByText("기준 주는 월요일이어야 합니다."),
    ).toBeInTheDocument();
  });

  it("프로젝트 목록에 시드 15개와 구분이 보인다", () => {
    render(
      <SettingsTab
        bundle={bundle({
          projects: SEED_PROJECT_NAMES.map((n, i) => proj(n, i)),
        })}
      />,
    );
    const region = screen.getByRole("region", { name: "프로젝트·TF 목록" });
    expect(within(region).getAllByRole("row")).toHaveLength(
      SEED_PROJECT_NAMES.length + 1,
    );
  });

  it("프로젝트 저장 → upsertProject 후 담당자 저장", async () => {
    render(<SettingsTab bundle={bundle({ projects: [proj("PIMS", 0)] })} />);
    fireEvent.click(screen.getByLabelText("PIMS 담당 운영자A"));
    fireEvent.click(screen.getByRole("button", { name: "PIMS 저장" }));
    await waitFor(() =>
      expect(setProjectOwners).toHaveBeenCalledWith({
        projectId: "p0",
        emails: ["a@x"],
      }),
    );
    expect(upsertProject).toHaveBeenCalledWith({
      id: "p0",
      name: "PIMS",
      kind: "project",
      sortOrder: 0,
      active: true,
    });
  });

  it("명단 밖 기존 담당자는 체크된 채 보이고, 풀면 빠진 채 저장된다", async () => {
    render(
      <SettingsTab
        bundle={bundle({
          projects: [{ ...proj("PIMS", 0), owners: ["x@x"] }],
        })}
      />,
    );
    const box = screen.getByLabelText("PIMS 담당 x@x (작성 명단 밖)");
    expect(box).toBeChecked();
    fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: "PIMS 저장" }));
    await waitFor(() =>
      expect(setProjectOwners).toHaveBeenCalledWith({
        projectId: "p0",
        emails: [],
      }),
    );
  });

  it("새 항목 저장이 성공하면 초안 행이 사라진다", async () => {
    render(<SettingsTab bundle={bundle()} />);
    const region = screen.getByRole("region", { name: "프로젝트·TF 목록" });
    fireEvent.click(
      within(region).getByRole("button", { name: "+ 항목 추가" }),
    );
    expect(within(region).getAllByRole("row")).toHaveLength(2);
    fireEvent.change(within(region).getByLabelText("새 항목 이름"), {
      target: { value: "신규" },
    });
    fireEvent.click(within(region).getByRole("button", { name: "신규 저장" }));
    await waitFor(() => expect(upsertProject).toHaveBeenCalled());
    await waitFor(() =>
      expect(within(region).getAllByRole("row")).toHaveLength(1),
    );
  });

  it("작성 제외 체크 → 저장", async () => {
    render(
      <SettingsTab
        bundle={bundle({
          writerCandidates: [wa, wt],
          excludedWriterEmails: [],
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText("테스트1 제외"));
    fireEvent.click(screen.getByRole("button", { name: "제외 저장" }));
    await waitFor(() =>
      expect(saveExcludedWriters).toHaveBeenCalledWith({ emails: [wt.email] }),
    );
  });

  it("패널 제목은 모두 h2 text-xl font-bold", () => {
    render(<SettingsTab bundle={bundle()} />);
    for (const name of [
      "받는 사람",
      "당번 순번",
      "작성 제외",
      "프로젝트·TF 목록",
    ]) {
      const t = screen.getByRole("heading", { name }).className.split(/\s+/);
      expect(t).toContain("text-xl");
      expect(t).toContain("font-bold");
    }
  });

  it("안 붙은 서비스 패널이 맨 아래, 앵커 id 와 함께 있다", () => {
    render(
      <SettingsTab
        bundle={bundle()}
        unmatched={{
          application: [
            {
              service_id: 1,
              university_name: "대학1",
              service_name: "서비스1",
              operator_name: "퇴사자",
              write_start_at: "2026-11-23T00:00:00Z",
              write_end_at: "2026-12-10T00:00:00Z",
              pay_end_at: null,
            },
          ],
          pims: [],
        }}
      />,
    );
    const regions = screen.getAllByRole("region");
    const last = regions[regions.length - 1];
    expect(last).toHaveAttribute("id", "unmatched");
    expect(last).toHaveAccessibleName("안 붙은 서비스");
    expect(
      within(last).getByRole("heading", { name: "원서접수 1건" }),
    ).toBeInTheDocument();
  });

  it("안 붙은 서비스를 안 넘기면 0건 패널(목록이 없는 척하지 않는다)", () => {
    render(<SettingsTab bundle={bundle()} />);
    const region = screen.getByRole("region", { name: "안 붙은 서비스" });
    expect(
      within(region).getByRole("heading", { name: "원서접수 0건" }),
    ).toBeInTheDocument();
  });

  it("+ 항목 추가는 제목 오른쪽 표준 헤더 액션이고 표보다 앞이다", () => {
    render(<SettingsTab bundle={bundle()} />);
    const region = screen.getByRole("region", { name: "프로젝트·TF 목록" });
    const add = within(region).getByRole("button", { name: "+ 항목 추가" });
    expect(add.className).toContain(HEADER_ACTION_CLASS);
    const h = within(region).getByRole("heading", {
      name: "프로젝트·TF 목록",
    });
    const table = within(region).getByRole("table");
    expect(
      h.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      add.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
