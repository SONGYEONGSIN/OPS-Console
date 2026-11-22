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
vi.mock("next/navigation", async () => ({
  ...(await import("./search-params-mock")).navigationModule,
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
const addRecipient = vi.fn();
const removeRecipient = vi.fn();
const saveRotation = vi.fn();
const saveExcludedWriters = vi.fn();
const upsertProject = vi.fn();
const setProjectOwners = vi.fn();
const setWeekDuty = vi.fn();
vi.mock("@/features/ops-weekly/settings-actions", () => ({
  addRecipient: (...a: unknown[]) => addRecipient(...a),
  removeRecipient: (...a: unknown[]) => removeRecipient(...a),
  saveRotation: (...a: unknown[]) => saveRotation(...a),
  saveExcludedWriters: (...a: unknown[]) => saveExcludedWriters(...a),
  upsertProject: (...a: unknown[]) => upsertProject(...a),
  setProjectOwners: (...a: unknown[]) => setProjectOwners(...a),
  setWeekDuty: (...a: unknown[]) => setWeekDuty(...a),
}));

import { HEADER_ACTION_CLASS } from "@/components/common/HeaderActionButton";
import type { ComponentProps } from "react";
import { ManageTab as RealManageTab } from "../_components/ManageTab";
import { setUrl } from "./search-params-mock";

// 대부분의 테스트는 안 붙은 서비스·전체 현황과 무관하다 — 필수 prop 은 기본값으로 채운다(넘긴 props 가 이긴다).
function ManageTab(props: Partial<ComponentProps<typeof RealManageTab>> & { bundle: SettingsBundle }) {
  return (
    <RealManageTab
      unmatched={null}
      overview={[]}
      actor={{ email: "z@x", isAdmin: true }}
      week={{ id: "w1", status: "open", duty_email: null }}
      weekLabel="11월 3주"
      {...props}
    />
  );
}
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
    recipientCandidates: [wa, wb],
    projects: [],
    ...over,
  };
}
const renderManage = (
  props: Partial<ComponentProps<typeof RealManageTab>> = {},
) => render(<ManageTab bundle={bundle()} {...props} />);
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

describe("ManageTab", () => {
  it("메뉴 권한 없는 받는 사람에 경고 배지", () => {
    setUrl("?week=2026-11-16&tab=settings&section=recipients");
    render(
      <ManageTab
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

  it("받는 사람 — 이메일 직접 입력 칸은 없다", () => {
    setUrl("?week=2026-11-16&tab=settings&section=recipients");
    render(<ManageTab bundle={bundle()} />);
    const region = screen.getByRole("region", { name: "받는 사람" });
    expect(within(region).queryByLabelText("받는 사람 이메일")).toBeNull();
    expect(
      within(region).queryByRole("button", { name: "이메일 추가" }),
    ).toBeNull();
  });

  it("받는 사람 — 행의 ON | OFF 로 켜고 끈다", async () => {
    setUrl("?week=2026-11-16&tab=settings&section=recipients");
    addRecipient.mockResolvedValue({ ok: true });
    removeRecipient.mockResolvedValue({ ok: true });
    render(
      <ManageTab
        bundle={bundle({
          recipients: [{ email: "b@x", name: "운영자B", warning: null }],
        })}
      />,
    );
    const region = screen.getByRole("region", { name: "받는 사람" });
    const rowA = within(region).getByText("운영자A").closest("tr") as HTMLElement;
    expect(
      within(rowA).getByRole("group", { name: "운영자A 받는 사람" }),
    ).toBeInTheDocument();
    fireEvent.click(within(rowA).getByRole("button", { name: "ON" }));
    await waitFor(() =>
      expect(addRecipient).toHaveBeenCalledWith({ email: "a@x" }),
    );
    const rowB = within(region).getByText("운영자B").closest("tr") as HTMLElement;
    expect(within(rowB).getByRole("button", { name: "ON" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // 앞선 저장이 끝나기 전에는 행 토글이 잠긴다
    await waitFor(() =>
      expect(within(rowB).getByRole("button", { name: "OFF" })).toBeEnabled(),
    );
    fireEvent.click(within(rowB).getByRole("button", { name: "OFF" }));
    await waitFor(() =>
      expect(removeRecipient).toHaveBeenCalledWith({ email: "b@x" }),
    );
  });

  it("받는 사람 — 운영자 명단 밖 주소도 표에 행으로 남는다", () => {
    setUrl("?week=2026-11-16&tab=settings&section=recipients");
    render(
      <ManageTab
        bundle={bundle({
          recipients: [{ email: "out@y", name: null, warning: "not-operator" }],
        })}
      />,
    );
    const region = screen.getByRole("region", { name: "받는 사람" });
    const row = within(region).getAllByText("out@y")[0].closest("tr") as HTMLElement;
    expect(within(row).getByRole("button", { name: "OFF" })).toBeEnabled();
  });

  it("순번 순서 바꾸기 → 저장이 바뀐 순서를 보낸다", async () => {
    setUrl("?week=2026-11-16&tab=settings&section=rotation");
    render(
      <ManageTab
        bundle={bundle({
          rotation: ["a@x", "b@x"],
          anchorWeekStart: "2026-11-16",
        })}
      />,
    );
    const region = screen.getByRole("region", { name: "당번 순번" });
    const row = within(region)
      .getByText("운영자B")
      .closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "위로" }));
    fireEvent.click(screen.getByRole("button", { name: "순번 저장" }));
    await waitFor(() =>
      expect(saveRotation).toHaveBeenCalledWith({
        emails: ["b@x", "a@x"],
        anchorWeekStart: "2026-11-16",
      }),
    );
  });

  it("순번 — 행을 ON 하면 맨 뒤에 붙고, OFF 하면 빠진다", async () => {
    setUrl("?week=2026-11-16&tab=settings&section=rotation");
    render(
      <ManageTab
        bundle={bundle({ rotation: ["a@x"], anchorWeekStart: "2026-11-16" })}
      />,
    );
    const region = screen.getByRole("region", { name: "당번 순번" });
    const row = within(region).getByText("테스트1").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "ON" }));
    const rowA = within(region).getByText("운영자A").closest("tr") as HTMLElement;
    fireEvent.click(within(rowA).getByRole("button", { name: "OFF" }));
    fireEvent.click(screen.getByRole("button", { name: "순번 저장" }));
    await waitFor(() =>
      expect(saveRotation).toHaveBeenCalledWith({
        emails: ["t@x"],
        anchorWeekStart: "2026-11-16",
      }),
    );
  });

  it("기준 주가 월요일이 아니면 보내지 않고 사유를 보여 준다", () => {
    setUrl("?week=2026-11-16&tab=settings&section=rotation");
    render(
      <ManageTab
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
    setUrl("?week=2026-11-16&tab=settings&section=projects");
    render(
      <ManageTab
        bundle={bundle({
          projects: SEED_PROJECT_NAMES.map((n, i) => proj(n, i)),
        })}
      />,
    );
    const region = screen.getByRole("region", { name: "프로젝트·TF" });
    expect(within(region).getAllByRole("row")).toHaveLength(
      SEED_PROJECT_NAMES.length + 1,
    );
  });

  it("프로젝트 저장 → upsertProject 후 담당자 저장", async () => {
    setUrl("?week=2026-11-16&tab=settings&section=projects");
    render(<ManageTab bundle={bundle({ projects: [proj("PIMS", 0)] })} />);
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
    setUrl("?week=2026-11-16&tab=settings&section=projects");
    render(
      <ManageTab
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
    setUrl("?week=2026-11-16&tab=settings&section=projects");
    render(<ManageTab bundle={bundle()} />);
    const region = screen.getByRole("region", { name: "프로젝트·TF" });
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

  it("작성 제외 — 행의 ON(제외) | OFF 를 누르면 바로 저장한다", async () => {
    setUrl("?week=2026-11-16&tab=settings&section=exclusions");
    saveExcludedWriters.mockResolvedValue({ ok: true });
    render(
      <ManageTab
        bundle={bundle({
          writerCandidates: [wa, wt],
          excludedWriterEmails: [wa.email],
        })}
      />,
    );
    const region = screen.getByRole("region", { name: "작성 제외" });
    const rowT = within(region).getByText("테스트1").closest("tr") as HTMLElement;
    fireEvent.click(within(rowT).getByRole("button", { name: "ON" }));
    await waitFor(() =>
      expect(saveExcludedWriters).toHaveBeenCalledWith({
        emails: [wa.email, wt.email],
      }),
    );
    const rowA = within(region).getByText("운영자A").closest("tr") as HTMLElement;
    expect(
      within(rowA).getByRole("group", { name: "운영자A 작성 제외" }),
    ).toBeInTheDocument();
    expect(within(rowA).getByRole("button", { name: "ON" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(region).queryByRole("button", { name: "제외 저장" })).toBeNull();
  });

  it("패널 제목은 모두 h2 text-xl font-bold — 숨긴 칸에도 마운트돼 있다", () => {
    setUrl("?week=2026-11-16&tab=settings");
    renderManage();
    for (const name of [
      "당번 지정",
      "받는 사람",
      "당번 순번",
      "작성 제외",
      "프로젝트·TF",
    ]) {
      const h = screen.getByRole("heading", { name, hidden: true });
      expect(h.tagName).toBe("H2");
      expect(h.className.split(/\s+/)).toEqual(
        expect.arrayContaining(["text-xl", "font-bold"]),
      );
      expect(h.closest("[data-section]")).toHaveAttribute("hidden");
    }
    // 전체 현황은 기본 선택 칸이라 숨기지 않는다
    const overview = screen.getByRole("heading", { name: "전체 현황" });
    expect(overview.tagName).toBe("H2");
    expect(overview.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["text-xl", "font-bold"]),
    );
  });

  it("안 붙은 서비스 패널이 맨 아래, 앵커 id 와 함께 있다", () => {
    setUrl("?week=2026-11-16&tab=settings&section=unmatched");
    render(
      <ManageTab
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
    // 숨긴 칸까지 모아야 순서를 본다 — 보이는 region 은 이 칸 하나뿐이라 그대로는 저절로 참이 된다
    const regions = screen.getAllByRole("region", { hidden: true });
    const last = regions[regions.length - 1];
    expect(last).toHaveAttribute("id", "unmatched");
    expect(last).toHaveAccessibleName("지정 안된 서비스");
    expect(
      within(last).getByRole("heading", { name: "원서접수 1건" }),
    ).toBeInTheDocument();
  });

  it("안 붙은 서비스를 못 읽었으면(null) 0건이 아니라 불러오지 않았다고 적는다", () => {
    setUrl("?week=2026-11-16&tab=settings&section=unmatched");
    render(<ManageTab bundle={bundle()} unmatched={null} />);
    const region = screen.getByRole("region", { name: "지정 안된 서비스" });
    expect(
      within(region).getByText("목록을 불러오지 않았습니다"),
    ).toBeInTheDocument();
    expect(within(region).queryByText(/0건/)).toBeNull();
  });

  it("+ 항목 추가는 제목 오른쪽 표준 헤더 액션이고 표보다 앞이다", () => {
    setUrl("?week=2026-11-16&tab=settings&section=projects");
    render(<ManageTab bundle={bundle()} />);
    const region = screen.getByRole("region", { name: "프로젝트·TF" });
    const add = within(region).getByRole("button", { name: "+ 항목 추가" });
    expect(add.className).toContain(HEADER_ACTION_CLASS);
    const h = within(region).getByRole("heading", {
      name: "프로젝트·TF",
    });
    const table = within(region).getByRole("table");
    expect(
      h.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      add.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("메뉴 일곱 — 순서와 기본 선택(전체 현황)", () => {
    setUrl("?week=2026-11-16&tab=settings");
    renderManage();
    const nav = screen.getByRole("navigation", { name: "관리 메뉴" });
    expect(
      within(nav)
        .getAllByRole("button")
        .map((b) => b.textContent?.replace(/^[◉·]/, "").replace(/\d+$/, "")),
    ).toEqual([
      "전체 현황",
      "당번 지정",
      "받는 사람",
      "당번 순번",
      "프로젝트·TF",
      "작성 제외",
      "지정 안된 서비스",
    ]);
    expect(within(nav).getByRole("button", { name: /전체 현황/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("메뉴를 고르면 section 만 바꾸고(서버 왕복 없음) 다른 칸은 숨긴 채 남는다", () => {
    setUrl("?week=2026-11-16&tab=settings");
    const { container } = renderManage();
    fireEvent.click(screen.getByRole("button", { name: /받는 사람/ }));
    expect(window.location.search).toBe(
      "?week=2026-11-16&tab=settings&section=recipients",
    );
    expect(container.querySelector('[data-section="overview"]')).toHaveAttribute("hidden");
    expect(container.querySelector('[data-section="recipients"]')).not.toHaveAttribute("hidden");
  });

  it("안 붙은 서비스 배지 — 원서접수 + 발표 건수, 못 읽었으면(null) 배지 없음", () => {
    setUrl("?week=2026-11-16&tab=settings");
    const row = (id: number) => ({
      service_id: id,
      university_name: "대학",
      service_name: "서비스",
      operator_name: "퇴사자",
      write_start_at: "2026-11-23T00:00:00Z",
      write_end_at: "2026-12-10T00:00:00Z",
      pay_end_at: null,
      last_announce_at: null,
    });
    const { unmount } = renderManage({
      unmatched: { application: [row(1)], pims: [row(2)] } as never,
    });
    const nav = screen.getByRole("navigation", { name: "관리 메뉴" });
    expect(within(nav).getByRole("button", { name: /지정 안된 서비스/ }).textContent).toMatch(/2$/);
    unmount();
    renderManage({ unmatched: null });
    const nav2 = screen.getByRole("navigation", { name: "관리 메뉴" });
    expect(
      within(nav2).getByRole("button", { name: /지정 안된 서비스/ }).textContent,
    ).not.toMatch(/\d$/);
  });

  it("당번 지정 표는 제외를 뺀 명단이다", () => {
    setUrl("?week=2026-11-16&tab=settings&section=duty");
    render(
      <ManageTab
        bundle={bundle({ excludedWriterEmails: ["t@x"] })}
      />,
    );
    const region = screen.getByRole("region", { name: "당번 지정" });
    const names = within(region)
      .getAllByRole("row")
      .slice(1)
      .map((r) => r.querySelectorAll("td")[1]?.textContent);
    expect(names).toEqual(["운영자A", "운영자B"]);
  });
});
