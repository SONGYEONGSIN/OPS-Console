import { StageCard } from "./StageCard";
import type { StageCardProps } from "./StageCard";

export type LifecycleStage = StageCardProps;

export type LifecyclePipeProps = {
  /** 정확히 4개 — soon → prog → done → settle 흐름 */
  stages:
    | [LifecycleStage, LifecycleStage, LifecycleStage, LifecycleStage]
    | LifecycleStage[];
};

/** ② 4 StageCard를 화살표(→)로 연결한 라이프사이클 흐름 (v4 .pipe).
 *  그리드: card auto card auto card auto card. arrow는 text-faint. */
export function LifecyclePipe({ stages }: LifecyclePipeProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch">
      {stages.map((stage, i) => (
        <Cell
          key={stage.label}
          stage={stage}
          withArrow={i < stages.length - 1}
        />
      ))}
    </div>
  );
}

function Cell({
  stage,
  withArrow,
}: {
  stage: LifecycleStage;
  withArrow: boolean;
}) {
  return (
    <>
      <StageCard {...stage} />
      {withArrow ? (
        <div
          data-pipe-arrow
          className="flex w-7 items-center justify-center text-base text-faint"
          aria-hidden
        >
          →
        </div>
      ) : null}
    </>
  );
}
