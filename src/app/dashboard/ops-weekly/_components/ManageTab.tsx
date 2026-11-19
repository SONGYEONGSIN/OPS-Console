"use client";

import type { ReactNode } from "react";
import {
  SectionMenuLayout,
  type SectionMenuItem,
} from "@/components/common/SectionMenuLayout";
import type { UnmatchedServices } from "@/features/ops-weekly/auto-lists/unmatched";
import type { WeekOverviewRow } from "@/features/ops-weekly/overview";
import type { Actor } from "@/features/ops-weekly/permissions";
import type { SettingsBundle } from "@/features/ops-weekly/settings-queries";
import {
  MANAGE_SECTION_LABEL,
  parseSection,
  type ManageSection,
} from "../_params";
import { ProjectCatalogPanel } from "./ProjectCatalogPanel";
import { RecipientsPanel } from "./RecipientsPanel";
import { RotationPanel } from "./RotationPanel";
import { UnmatchedServicesPanel } from "./UnmatchedServicesPanel";
import { WeekOverviewTable } from "./WeekOverviewTable";
import { WriterExclusionPanel } from "./WriterExclusionPanel";
import { replaceOpsQuery, useOpsQueryValue } from "./use-ops-query";

// 당번 지정 칸은 Task 7 이 넣는다.
const MENU_ORDER: readonly ManageSection[] = [
  "overview",
  "recipients",
  "rotation",
  "exclusions",
  "projects",
  "unmatched",
];

function Section({
  name,
  active,
  children,
}: {
  name: ManageSection;
  active: ManageSection;
  children: ReactNode;
}) {
  // 메뉴를 바꿔도 입력 중이던 글이 남도록 언마운트하지 않고 숨긴다.
  return (
    <div data-section={name} hidden={name !== active} className="min-w-0">
      {children}
    </div>
  );
}

export function ManageTab({
  bundle,
  unmatched,
  overview,
  actor,
}: {
  bundle: SettingsBundle;
  /** 이 주 기준 안 붙은 서비스(실시간). null = 읽지 않았다 — 0건으로 그리지 않는다 */
  unmatched: UnmatchedServices | null;
  overview: WeekOverviewRow[];
  actor: Actor;
}) {
  const active = parseSection(useOpsQueryValue("section"));
  const excluded = new Set(bundle.excludedWriterEmails);
  // 순번·담당자는 제외를 반영한 명단에서만 고른다(서버도 같은 명단으로 검증한다).
  const writers = bundle.writerCandidates.filter((w) => !excluded.has(w.email));
  const items: SectionMenuItem<ManageSection>[] = MENU_ORDER.map((key) => ({
    key,
    label: MANAGE_SECTION_LABEL[key],
    ...(key === "unmatched" && unmatched !== null
      ? { badge: unmatched.application.length + unmatched.pims.length }
      : {}),
  }));
  return (
    <section data-tab="settings" className="p-5 lg:p-7">
      <SectionMenuLayout
        ariaLabel="관리 메뉴"
        items={items}
        active={active}
        onSelect={(section) => replaceOpsQuery({ section })}
      >
        <Section name="overview" active={active}>
          <section aria-label="전체 현황" className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink">전체 현황</h2>
            <WeekOverviewTable rows={overview} actor={actor} />
          </section>
        </Section>
        <Section name="recipients" active={active}>
          <RecipientsPanel
            recipients={bundle.recipients}
            candidates={bundle.writerCandidates}
          />
        </Section>
        <Section name="rotation" active={active}>
          <RotationPanel
            rotation={bundle.rotation}
            anchorWeekStart={bundle.anchorWeekStart}
            writers={writers}
          />
        </Section>
        <Section name="exclusions" active={active}>
          <WriterExclusionPanel
            candidates={bundle.writerCandidates}
            excluded={bundle.excludedWriterEmails}
          />
        </Section>
        <Section name="projects" active={active}>
          <ProjectCatalogPanel
            projects={bundle.projects}
            writers={writers}
            candidates={bundle.writerCandidates}
          />
        </Section>
        <Section name="unmatched" active={active}>
          <UnmatchedServicesPanel unmatched={unmatched} />
        </Section>
      </SectionMenuLayout>
    </section>
  );
}
