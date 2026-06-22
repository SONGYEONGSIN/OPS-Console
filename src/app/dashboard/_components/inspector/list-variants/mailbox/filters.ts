import type { Filter } from "../../../patterns/ListPattern";

// mailbox: 수신 메일은 신규 생성 흐름 없음 (ingest 잡이 적재). filter chip 비활성.
export const MAILBOX_FILTERS: { value: Filter; label: string }[] = [];
