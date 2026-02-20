export type AssistantClientMode = 'widget' | 'workspace';



export interface AssistantWorkspaceContext {
  activeDiagramType: string;
  activeDiagramId?: string;
  activeModel?: any;
  projectSnapshot?: any;
  diagramSummaries?: Array<{ diagramType: string; diagramId?: string; title?: string }>;
}

export interface AssistantClientOptions {
  clientMode?: AssistantClientMode;
  sessionId?: string;
  contextProvider?: () => AssistantWorkspaceContext | undefined;
}

export type AssistantActionName =
  | 'assistant_message'
  | 'inject_element'
  | 'inject_complete_system'
  | 'modify_model'
  | 'switch_diagram'
  | 'trigger_generator'
  | 'trigger_export'
  | 'trigger_deploy'
  | 'auto_generate_gui'
  | 'agent_error';

export interface AssistantActionPayload {
  action: AssistantActionName | string;
  message?: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  action: string;
  message: string | object;
  isUser: boolean;
  timestamp: Date;
  diagramType?: string;
}

export interface AgentResponse {
  action: string;
  message: string | object;
  diagramType?: string;
  [key: string]: unknown;
}

export interface InjectionCommand {
  action: 'inject_element' | 'inject_complete_system' | 'modify_model';
  element?: any;
  systemSpec?: any;
  modification?: any;
  modifications?: any[];
  model?: any;
  message: string;
  diagramType?: string;
  diagramId?: string;
  replaceExisting?: boolean;
}

export type MessageHandler = (message: ChatMessage) => void;
export type ConnectionHandler = (connected: boolean) => void;
export type TypingHandler = (typing: boolean) => void;
export type InjectionHandler = (command: InjectionCommand) => void;
export type ActionHandler = (payload: AssistantActionPayload) => void;

export type SendStatus = 'sent' | 'queued' | 'error';
