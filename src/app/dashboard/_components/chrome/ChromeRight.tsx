import { AlertsBell } from "../AlertsBell";
import type { OpsAlert } from "@/features/alerts/queries";
import type { CurrentOperator } from "@/features/auth/queries";
import type { SbSection } from "../../_data";
import { ChromeUser } from "./ChromeUser";
import { SessionTimer } from "./SessionTimer";
import { TutorialGuideButton } from "../tutorial/TutorialGuideButton";

type Props = {
  operator: CurrentOperator;
  alerts: OpsAlert[];
  sections: SbSection[];
};

export function ChromeRight({ operator, alerts, sections }: Props) {
  return (
    <div className="flex items-center justify-end gap-5">
      <TutorialGuideButton sections={sections} />
      <span aria-hidden className="h-5 w-px bg-chrome-muted/40" />
      <SessionTimer />
      <span aria-hidden className="h-5 w-px bg-chrome-muted/40" />
      <AlertsBell items={alerts} />
      <span aria-hidden className="h-5 w-px bg-chrome-muted/40" />
      <ChromeUser
        displayName={operator.displayName}
        email={operator.email}
        role={operator.role}
        team={operator.team}
        permission={operator.permission}
      />
    </div>
  );
}
