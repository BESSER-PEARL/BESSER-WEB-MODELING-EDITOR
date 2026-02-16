/**
 * Backward-compatible export wrapper.
 * Shared assistant websocket logic now lives in src/main/services/assistant.
 */

export { AssistantClient as WebSocketService } from '../../../services/assistant';
export type {
  ChatMessage,
  InjectionCommand,
  SendStatus,
  AssistantActionPayload,
} from '../../../services/assistant';
