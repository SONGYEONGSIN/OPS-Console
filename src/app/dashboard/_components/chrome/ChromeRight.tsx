import { AlertsBell } from "../AlertsBell";
import type { DashWidget } from "../patterns/DashPattern";
import type { CurrentOperator } from "@/features/auth/queries";
import { ChromeUser } from "./ChromeUser";
import { SessionTimer } from "./SessionTimer";

type Props = {
  operator: CurrentOperator;
  alerts: DashWidget[];
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
        role={operator.role}
        team={operator.team}
      />
    </div>
  );
}
