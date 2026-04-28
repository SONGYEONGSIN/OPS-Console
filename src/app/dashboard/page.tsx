"use client";

import { useEffect, useMemo, useState } from "react";
import { services } from "./_data";
import { Content } from "./_components/Content";
import { Inspector } from "./_components/Inspector";

/**
 * /dashboard (slug 없음 = "실시간 현황") — index 페이지.
 *
 * 셸(TitleBar/AppBar/MenuBar/Sidebar/StatusBar/Scrim)은 layout.tsx가 처리.
 * 이 페이지는 Content (서비스 목록) + Inspector (선택 행 상세) + selection/drawer state만 책임.
 */
export default function DashboardIndexPage() {
  const [selectedId, setSelectedId] = useState<string>("SVC-PAY-001");
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedId) ?? services[0],
    [selectedId]
  );

  // inspector drawer (모바일) 열림 시 바디 스크롤 락 + ESC 닫기
  useEffect(() => {
    if (!inspectorOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInspectorOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [inspectorOpen]);

  const onSelectRow = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 767px)").matches) {
      setInspectorOpen(true);
    }
  };

  return (
    <div className="grid h-full grid-cols-[1fr_300px] overflow-hidden max-[1279px]:grid-cols-[1fr_260px] max-lg:grid-cols-1">
      <Content
        services={services}
        selectedId={selectedId}
        onSelectRow={onSelectRow}
        onInspectorToggle={() => setInspectorOpen((o) => !o)}
        inspectorOpen={inspectorOpen}
      />
      <Inspector
        service={selectedService}
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
      />
    </div>
  );
}
