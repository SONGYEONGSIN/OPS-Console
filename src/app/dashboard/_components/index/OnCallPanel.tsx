export type OnCallPerson = {
  name: string;
  team: string;
  role: string;
};

export type OnCallShift = {
  primary: OnCallPerson;
  secondary: OnCallPerson;
};

/**
 * OnCallPanel — "오늘 누구를 호출하는가". 1차/2차 두 명만 노출.
 * 팀/역할 메타는 mono 작게, 이름은 본문 크기로 무게 중심.
 */
export function OnCallPanel({ onCall }: { onCall: OnCallShift }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <PersonCell tier="1차" person={onCall.primary} accent />
      <PersonCell tier="2차" person={onCall.secondary} />
    </div>
  );
}

function PersonCell({
  tier,
  person,
  accent = false,
}: {
  tier: string;
  person: OnCallPerson;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "border-l-2 border-vermilion pl-3"
          : "border-l-2 border-line-soft pl-3"
      }
    >
      <p
        className={
          "mb-1 text-2xs uppercase tracking-[0.18em] " +
          (accent ? "text-vermilion" : "text-muted")
        }
      >
        {tier}
      </p>
      <p className="text-md font-semibold text-ink">{person.name}</p>
      <p className="font-mono text-2xs tracking-tight text-ink-soft">
        {person.team} · {person.role}
      </p>
    </div>
  );
}
