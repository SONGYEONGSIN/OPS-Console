import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetCurrentOperator, mockRedirect } = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error("REDIRECT_CALLED");
  }),
}));

vi.mock("../queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import {
  requireAdmin,
  canEditOperators,
  canViewMenu,
  filterSidebarSections,
} from "../permission";
import type { SbSection } from "@/app/dashboard/_data";

const ME_ADMIN = {
  email: "admin@x.com",
  displayName: "admin",
  role: "팀장",
  team: "운영2팀" as const,
  operator: null,
  permission: "admin" as const,
  allowedMenus: [] as string[],
};
const ME_MEMBER = {
  email: "m@x.com",
  displayName: "m",
  role: "매니저",
  team: "운영1팀" as const,
  operator: null,
  permission: "member" as const,
  allowedMenus: ["my-todo", "feedback"],
};

beforeEach(() => {
  mockGetCurrentOperator.mockReset();
  mockRedirect.mockClear();
});

describe("requireAdmin", () => {
  it("admin이면 currentOperator 반환", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "ys1114@jinhakapply.com",
      displayName: "송영신",
      role: "팀장",
      team: "운영2팀",
      operator: null,
      permission: "admin",
    });
    const me = await requireAdmin();
    expect(me.permission).toBe("admin");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("member면 /dashboard로 redirect", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "x@y.com",
      displayName: "x",
      role: "매니저",
      team: "운영1팀",
      operator: null,
      permission: "member",
    });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("viewer면 /dashboard로 redirect", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "v@y.com",
      displayName: "v",
      role: "매니저",
      team: "운영1팀",
      operator: null,
      permission: "viewer",
    });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("permission=null이면 /dashboard로 redirect", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "dev@y.com",
      displayName: "dev",
      role: "관리자",
      team: null,
      operator: null,
      permission: null,
    });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("로그인 안 됨(null)이면 /login으로 redirect", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});

describe("canViewMenu", () => {
  it("admin은 모든 slug true", () => {
    expect(canViewMenu("team", ME_ADMIN)).toBe(true);
    expect(canViewMenu("settings", ME_ADMIN)).toBe(true);
    expect(canViewMenu("anything", ME_ADMIN)).toBe(true);
  });

  it("member는 allowedMenus 안에 있으면 true", () => {
    expect(canViewMenu("my-todo", ME_MEMBER)).toBe(true);
    expect(canViewMenu("feedback", ME_MEMBER)).toBe(true);
  });

  it("member는 admin-only slug(team/settings/notices/outcomes/automations)는 false", () => {
    expect(canViewMenu("team", ME_MEMBER)).toBe(false);
    expect(canViewMenu("settings", ME_MEMBER)).toBe(false);
    expect(canViewMenu("notices", ME_MEMBER)).toBe(false);
    expect(canViewMenu("outcomes", ME_MEMBER)).toBe(false);
    expect(canViewMenu("automations", ME_MEMBER)).toBe(false);
  });

  it("member는 비-adminOnly slug는 allowedMenus 밖이어도 true (정책: deny 외 전체 허용)", () => {
    const empty = { ...ME_MEMBER, allowedMenus: [] };
    expect(canViewMenu("services", empty)).toBe(true);
    expect(canViewMenu("contracts", empty)).toBe(true);
    expect(canViewMenu("schedule", empty)).toBe(true);
  });

  it("viewer도 동일하게 admin-only 차단, 그 외 통과", () => {
    const viewer = { ...ME_MEMBER, permission: "viewer" as const };
    expect(canViewMenu("settings", viewer)).toBe(false);
    expect(canViewMenu("services", viewer)).toBe(true);
  });

  it("operator=null(비로그인) → false", () => {
    expect(canViewMenu("my-todo", null)).toBe(false);
  });
});

describe("filterSidebarSections", () => {
  // sections에 adminOnly 표시된 항목은 admin만 / 그 외(슬러그 있어도 비-adminOnly)는
  // member도 통과. 빈 group hide 검증을 위해 그룹 내 모든 item을 adminOnly로 표시.
  const sections: SbSection[] = [
    {
      title: "개요",
      entries: [
        { kind: "item", ico: "◉", label: "실시간 현황" },
        { kind: "item", ico: "✓", label: "할 일", slug: "my-todo" },
        { kind: "item", ico: "✦", label: "팀", slug: "team", adminOnly: true },
      ],
    },
    {
      title: "그룹",
      entries: [
        {
          kind: "group",
          label: "프로젝트",
          items: [
            { ico: "·", label: "PIMS", slug: "pims", adminOnly: true },
            { ico: "·", label: "K12", slug: "k12", adminOnly: true },
          ],
        },
      ],
    },
  ];

  it("admin은 전체 보존", () => {
    const result = filterSidebarSections(sections, ME_ADMIN);
    expect(result).toEqual(sections);
  });

  it("member: adminOnly item만 hide, slug 없는 item·비-adminOnly slug 보존", () => {
    const result = filterSidebarSections(sections, ME_MEMBER);
    expect(result[0].entries).toHaveLength(2);
    expect(result[0].entries[0]).toMatchObject({ label: "실시간 현황" });
    expect(result[0].entries[1]).toMatchObject({ slug: "my-todo" });
  });

  it("member: 모든 자식이 adminOnly인 group은 group 자체 hide", () => {
    const result = filterSidebarSections(sections, ME_MEMBER);
    const projectSection = result.find((s) => s.title === "그룹");
    expect(projectSection?.entries).toHaveLength(0);
  });

  it("비로그인(null) → slug 없는 entry만 통과", () => {
    const result = filterSidebarSections(sections, null);
    expect(result[0].entries).toHaveLength(1);
    expect(result[1].entries).toHaveLength(0);
  });

  it("adminOnly item은 admin에게는 보임", () => {
    const withAdminOnly: SbSection[] = [
      {
        title: "AI",
        entries: [
          {
            kind: "group",
            label: "AI & 자동화",
            items: [
              { ico: "·", label: "내 작업", slug: "my-ai-work" },
              { ico: "·", label: "자동화 실행", slug: "automations", adminOnly: true },
            ],
          },
        ],
      },
    ];
    const result = filterSidebarSections(withAdminOnly, ME_ADMIN);
    const group = result[0].entries[0];
    expect(group.kind).toBe("group");
    if (group.kind === "group") {
      expect(group.items.map((i) => i.label)).toContain("자동화 실행");
    }
  });

  it("adminOnly item은 member에게 숨겨지고, 비-adminOnly 형제 item은 보임", () => {
    const memberWithSlug = {
      ...ME_MEMBER,
      allowedMenus: ["my-ai-work", "automations"],
    };
    const withAdminOnly: SbSection[] = [
      {
        title: "AI",
        entries: [
          {
            kind: "group",
            label: "AI & 자동화",
            items: [
              { ico: "·", label: "내 작업", slug: "my-ai-work" },
              { ico: "·", label: "자동화 실행", slug: "automations", adminOnly: true },
            ],
          },
        ],
      },
    ];
    const result = filterSidebarSections(withAdminOnly, memberWithSlug);
    const group = result[0].entries[0];
    expect(group.kind).toBe("group");
    if (group.kind === "group") {
      expect(group.items.map((i) => i.label)).not.toContain("자동화 실행");
      expect(group.items.map((i) => i.label)).toContain("내 작업");
    }
  });
});

describe("canEditOperators", () => {
  it("admin → true", () => {
    expect(canEditOperators("admin")).toBe(true);
  });

  it("member → false", () => {
    expect(canEditOperators("member")).toBe(false);
  });

  it("viewer → false", () => {
    expect(canEditOperators("viewer")).toBe(false);
  });

  it("null → false", () => {
    expect(canEditOperators(null)).toBe(false);
  });
});
