import { AlertsBell } from "../AlertsBell";
import type { OpsAlert } from "@/features/alerts/queries";
import type { CurrentOperator } from "@/features/auth/queries";
import { ChromeUser } from "./ChromeUser";
import { SessionTimer } from "./SessionTimer";

type Props = {
  operator: CurrentOperator;
  alerts: OpsAlert[];
};

export function ChromeRight({ operator, alerts }: Props) {
  return (
    <div className="flex items-center justify-end gap-5">
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
