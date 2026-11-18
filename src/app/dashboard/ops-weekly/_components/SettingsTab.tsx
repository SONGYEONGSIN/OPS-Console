"use client";

import {
  NO_UNMATCHED,
  type UnmatchedServices,
} from "@/features/ops-weekly/auto-lists/unmatched";
import type { SettingsBundle } from "@/features/ops-weekly/settings-queries";
import { ProjectCatalogPanel } from "./ProjectCatalogPanel";
import { RecipientsPanel } from "./RecipientsPanel";
import { RotationPanel } from "./RotationPanel";
import { UnmatchedServicesPanel } from "./UnmatchedServicesPanel";
import { WriterExclusionPanel } from "./WriterExclusionPanel";

export function SettingsTab({
  bundle,
  unmatched = NO_UNMATCHED,
}: {
  bundle: SettingsBundle;
  /** 이 주 기준 안 붙은 서비스(실시간) */
  unmatched?: UnmatchedServices;
}) {
  const excluded = new Set(bundle.excludedWriterEmails);
  // 순번·담당자는 제외를 반영한 명단에서만 고른다(서버도 같은 명단으로 검증한다).
  const writers = bundle.writerCandidates.filter((w) => !excluded.has(w.email));
  return (
    <section data-tab="settings" className="flex flex-col gap-8 p-5 lg:p-7">
      <RecipientsPanel
        recipients={bundle.recipients}
        candidates={bundle.writerCandidates}
      />
      <RotationPanel
        rotation={bundle.rotation}
        anchorWeekStart={bundle.anchorWeekStart}
        writers={writers}
      />
      <WriterExclusionPanel
        candidates={bundle.writerCandidates}
        excluded={bundle.excludedWriterEmails}
      />
      <ProjectCatalogPanel
        projects={bundle.projects}
        writers={writers}
        candidates={bundle.writerCandidates}
      />
      <UnmatchedServicesPanel unmatched={unmatched} />
    </section>
  );
}
