import type { OpsAlert } from "@/features/alerts/queries";
import type { CurrentOperator } from "@/features/auth/queries";
import { SearchBox } from "../SearchBox";
import { ChromeBrand } from "./ChromeBrand";
import { ChromeRight } from "./ChromeRight";

type Props = {
  operator: CurrentOperator;
  alerts: OpsAlert[];
};

/**
 * Chrome — 데스크탑(≥md) chrome bar 통합 wrapper.
 *
 * 1fr/1fr/1fr 그리드로 좌(brand) · 중(search) · 우(timer/bell/user) 3-zone 조립.
 * 높이 52px, 상하 2px chrome-graphite 보더, snow 배경.
 * Server component (children에 client SearchBox 포함되어도 wrapper는 server).
 */
export function Chrome({ operator, alerts }: Props) {
  return (
    <div
      role="banner"
      data-tutorial="topbar"
      className="relative z-[100] hidden h-[52px] grid-cols-[1fr_1fr_1fr] items-center border-y-2 border-chrome-graphite bg-chrome-snow px-[18px] md:grid"
    >
      <div className="justify-self-start">
        <ChromeBrand />
      </div>
      <div className="w-full max-w-[420px] justify-self-center">
        <SearchBox />
      </div>
      <ChromeRight operator={operator} alerts={alerts} />
    </div>
  );
}
