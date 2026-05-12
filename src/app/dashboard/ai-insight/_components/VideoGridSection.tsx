"use client";

import type { InsightVideoRow } from "@/features/insight-videos/schemas";
import { InspectorPanel } from "@/app/dashboard/_components/inspector/InspectorPanel";
import { useInspectorState } from "@/app/dashboard/_components/inspector/useInspectorState";
import { VideoGrid } from "./VideoGrid";
import { InsightInspectorBody } from "./InsightInspectorBody";

type Props = {
  videos: InsightVideoRow[];
};

export function VideoGridSection({ videos }: Props) {
  const inspector = useInspectorState<InsightVideoRow>();

  const open = inspector.selected !== null;

  return (
    <>
      <div
        className={`transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          open ? "md:pr-[340px]" : ""
        }`}
      >
        <VideoGrid videos={videos} onSelect={inspector.open} />
      </div>
      <InspectorPanel open={open} onClose={inspector.close}>
        <InsightInspectorBody video={inspector.selected} />
      </InspectorPanel>
    </>
  );
}
