import type { MeetingStatus } from "./schemas";

export function canRevokeSend(status: MeetingStatus): boolean {
  return status === "sent";
}
