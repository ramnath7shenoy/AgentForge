export const FLOW_ROOM_PREFIX = "flow";

export function getFlowRoomId(flowId: string) {
  return `${FLOW_ROOM_PREFIX}:${flowId}`;
}

export function getFlowIdFromRoom(roomId: string) {
  const prefix = `${FLOW_ROOM_PREFIX}:`;
  if (!roomId.startsWith(prefix)) return null;
  const flowId = roomId.slice(prefix.length);
  return flowId.length > 0 ? flowId : null;
}
