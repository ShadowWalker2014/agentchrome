// Messages between a relay server (cloud or local) and the browser extension over WebSocket.
import type { CallToolResult, SessionInfo } from "./mcp.js";

export const WS_SUBPROTOCOL = "agentchrome.v1";
/** Device tokens travel in a second Sec-WebSocket-Protocol entry: `acm-token.<token>`. */
export const WS_TOKEN_PREFIX = "acm-token.";

export interface DeviceHello {
  t: "hello";
  name: string;
  email?: string;
  version: string;
  userAgent?: string;
}

export type ExtensionToServer =
  | DeviceHello
  | { t: "result"; id: string; result: CallToolResult }
  | { t: "ping" };

export type ServerToExtension =
  | { t: "call"; id: string; tool: string; args: Record<string, unknown>; session: SessionInfo; artifactUploadUrl?: string }
  | { t: "cancel"; id: string }
  | { t: "welcome"; deviceId: string; deviceName: string }
  | { t: "pong" };
