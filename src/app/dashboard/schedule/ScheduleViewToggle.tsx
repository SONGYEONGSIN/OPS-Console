"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Props = {
  view: "calendar" | "list";
};

export function ScheduleViewToggle({ view }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (next: "calendar" | "list") => {
    if (next === view) return;
    const sp = new URLSearchParams(searchParams.toString());
    if (next === "list") {
      sp.set("view", "list");
      sp.delete("month");
    } else {
      sp.set("view", "calendar");
    }
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  return (
    <div
      role="tablist"
      aria-label="view 토글"
      className="flex items-center border border-line"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === "calendar"}
        onClick={() => handleChange("calendar")}
        className={`cursor-pointer px-3 py-1 text-xs ${
          view === "calendar"
            ? "bg-ink text-cream"
            : "bg-transparent text-ink hover:text-vermilion"
        }`}
      >
        달력
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "list"}
        onClick={() => handleChange("list")}
        className={`cursor-pointer border-l border-line px-3 py-1 text-xs ${
          view === "list"
            ? "bg-ink text-cream"
            : "bg-transparent text-ink hover:text-vermilion"
        }`}
      >
        목록
      </button>
    </div>
  );
}
