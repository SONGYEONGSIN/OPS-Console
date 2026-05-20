import Link from "next/link";

const TABS = [
  { key: "univ", label: "대학배정" },
  { key: "duties", label: "업무분장" },
  { key: "pricing", label: "가격정책" },
] as const;

export function AssignmentTabs({ active }: { active: string }) {
  return (
    <nav className="flex gap-1 border-b border-line px-5">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/dashboard/assignments?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              on
                ? "border-vermilion font-medium text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
