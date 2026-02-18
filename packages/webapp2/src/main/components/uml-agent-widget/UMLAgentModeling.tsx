import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { UMLDiagramType } from '@besser/wme';
import { CircleHelp, Download, X, Zap } from 'lucide-react';
import posthog from 'posthog-js';
import { ApollonEditorContext } from '../apollon-editor-component/apollon-editor-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useProject } from '../../hooks/useProject';
import {
  UMLModelingService,
  ClassSpec,
  SystemSpec,
  ModelModification,
  BESSERModel,
  ModelUpdate,
} from './services/UMLModelingService';
import { WebSocketService, ChatMessage, InjectionCommand, SendStatus, AssistantActionPayload } from './services/WebSocketService';
import { UIService } from './services/UIService';
import { RateLimiterService, RateLimitStatus } from './services/RateLimiterService';
import { JsonViewerModal } from '../modals/json-viewer-modal/json-viewer-modal';
import { UML_BOT_WS_URL } from '../../constant';
import { isUMLModel, toUMLDiagramType } from '../../types/project';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import type { Message as KitMessage } from '@/components/chatbot-kit/ui/chat-message';
import type { GeneratorType } from '../sidebar/workspace-types';
import type { GenerationResult } from '../../services/generate-code/types';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'closed' | 'closing' | 'unknown';

const AGENT_AVATAR_SRC = '/img/agent_back.png';

interface UMLAgentModelingProps {
  onAssistantGenerate?: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
}

const getConnectionLabel = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting...';
    case 'closing':
      return 'Closing...';
    case 'closed':
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Status unknown';
  }
};

const getConnectionDotClass = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500';
    case 'connecting':
    case 'closing':
      return 'bg-amber-500';
    default:
      return 'bg-red-500';
  }
};

const getRateLimitClass = (requestsLastMinute: number): string => {
  if (requestsLastMinute >= 7) {
    return 'border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300';
  }
  if (requestsLastMinute >= 5) {
    return 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
  }
  return 'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
};

/**
 * UML Bot Widget migrated to Webapp2 styling conventions.
 * Uses Tailwind/shadcn for visuals while preserving existing agent logic/services.
 */
export const UMLAgentModeling: React.FC<UMLAgentModelingProps> = ({ onAssistantGenerate }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [currentDiagramType, setCurrentDiagramType] = useState<string>('ClassDiagram');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>({
    requestsLastMinute: 0,
    requestsLastHour: 0,
    cooldownRemaining: 0,
  });

  const [wsService] = useState(() => new WebSocketService(UML_BOT_WS_URL));
  const [uiService] = useState(() => new UIService());
  const [rateLimiter] = useState(
    () =>
      new RateLimiterService({
        maxRequestsPerMinute: 8,
        maxRequestsPerHour: 40,
        maxMessageLength: 1000,
        cooldownPeriodMs: 3000,
      }),
  );
  const [modelingService, setModelingService] = useState<UMLModelingService | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const { editor } = useContext(ApollonEditorContext);
  const dispatch = useAppDispatch();
  const currentDiagram = useAppSelector((state) => state.diagram);
  const { switchDiagramType, currentProject } = useProject();
  const location = useLocation();

  const isOnDiagramPage = location.pathname === '/';

  useEffect(() => {
    if (!isOnDiagramPage) {
      setIsVisible(false);
    }
  }, [isOnDiagramPage]);

  useEffect(() => {
    const handleExternalToggle = () => {
      if (!isOnDiagramPage) {
        return;
      }
      setIsVisible((previous) => !previous);
    };

    window.addEventListener('besser:toggle-agent-widget', handleExternalToggle as EventListener);
    return () => {
      window.removeEventListener('besser:toggle-agent-widget', handleExternalToggle as EventListener);
    };
  }, [isOnDiagramPage]);

  useEffect(() => {
    return () => {
      wsService.clearHandlers();
      wsService.disconnect({ allowReconnect: false, clearQueue: true });
    };
  }, [wsService]);

  useEffect(() => {
    if (editor && dispatch && !modelingService) {
      const service = new UMLModelingService(editor, dispatch);
      setModelingService(service);
    } else if (editor && modelingService) {
      modelingService.updateEditorReference(editor);
    }
  }, [editor, dispatch, modelingService]);

  useEffect(() => {
    if (modelingService && currentDiagram?.diagram?.model) {
      if (isUMLModel(currentDiagram.diagram.model)) {
        modelingService.updateCurrentModel(currentDiagram.diagram.model);
        const detectedType = currentDiagram.diagram.model.type || 'ClassDiagram';
        setCurrentDiagramType(detectedType);
      }
    }
  }, [modelingService, currentDiagram]);

  useEffect(() => {
    if (!isVisible) {
      wsService.clearHandlers();
      wsService.disconnect({ allowReconnect: false, clearQueue: true });
      setIsTyping(false);
      setHasShownWelcome(false);
      setConnectionStatus('disconnected');
    }
  }, [isVisible, wsService]);

  useEffect(() => {
    if (!modelingService || !isVisible) {
      return;
    }

    const waitForDiagramRender = async (): Promise<void> => {
      await new Promise<void>((resolve) => {
        if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
          setTimeout(resolve, 0);
          return;
        }
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      });
    };

    const ensureDiagramReady = async (diagramType?: string): Promise<boolean> => {
      if (!diagramType || diagramType === currentDiagramType) {
        return true;
      }

      const umlType = toUMLDiagramType(diagramType as any);
      if (!umlType) {
        return false;
      }

      try {
        switchDiagramType(umlType as UMLDiagramType);
        await waitForDiagramRender();
        setCurrentDiagramType(diagramType);
        return true;
      } catch {
        return false;
      }
    };

    const enqueueAssistantTask = (task: () => Promise<void> | void) => {
      operationQueueRef.current = operationQueueRef.current
        .then(async () => {
          await task();
        })
        .catch((error) => {
          console.error('Widget assistant task queue error:', error);
        });
    };

    const handleMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleConnection = (connected: boolean) => {
      const state = connected ? 'connected' : (wsService.connectionState as ConnectionStatus);
      setConnectionStatus(state);

      if (connected && !hasShownWelcome) {
        setMessages((prev) => [...prev]);
        setHasShownWelcome(true);
      }
    };

    const handleTyping = (typing: boolean) => {
      setIsTyping(typing);
    };

    const handleAction = async (payload: AssistantActionPayload) => {
      if (payload.action === 'switch_diagram') {
        const diagramType = typeof payload.diagramType === 'string' ? payload.diagramType : '';
        const umlType = diagramType ? toUMLDiagramType(diagramType as any) : null;
        if (!umlType) {
          return;
        }
        try {
          const switched = await ensureDiagramReady(diagramType);
          if (!switched) {
            throw new Error(`Could not switch to ${diagramType}`);
          }
          if (typeof payload.reason === 'string' && payload.reason.trim()) {
            const infoMessage: ChatMessage = {
              id: uiService.generateId('msg'),
              action: 'assistant_message',
              message: payload.reason,
              isUser: false,
              timestamp: new Date(),
            };
            setMessages((previous) => [...previous, infoMessage]);
          }
        } catch (error) {
          uiService.showToast('Failed to switch diagram', 'error');
        }
        return;
      }

      if (payload.action === 'trigger_generator') {
        if (!onAssistantGenerate || typeof payload.generatorType !== 'string') {
          return;
        }

        const result = await onAssistantGenerate(payload.generatorType as GeneratorType, payload.config);
        wsService.sendFrontendEvent('generator_result', {
          ok: result.ok,
          message:
            typeof payload.message === 'string' && payload.message.trim()
              ? payload.message
              : result.ok
                ? 'Generation completed successfully.'
                : result.error,
          metadata: result.ok && result.filename ? { filename: result.filename } : undefined,
        });
        return;
      }

      if (payload.action === 'agent_error') {
        const message = typeof payload.message === 'string' ? payload.message : 'Assistant error';
        const errorMessage: ChatMessage = {
          id: uiService.generateId('msg'),
          action: 'assistant_message',
          message: `[ERROR] ${message}`,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((previous) => [...previous, errorMessage]);
      }
    };

    const handleInjection = async (command: InjectionCommand) => {
      console.log('[Agent WS] Injection command received:', JSON.stringify(command, null, 2));
      if (!modelingService) {
        uiService.showToast('Modeling service not ready', 'error');
        return;
      }

      try {
        const diagramReady = await ensureDiagramReady(command.diagramType);
        if (!diagramReady) {
          throw new Error(`Could not switch to ${command.diagramType || 'target diagram'}`);
        }

        let successMessage: string | undefined;
        let update: ModelUpdate | null = null;

        switch (command.action) {
          case 'inject_element':
            if (command.element) {
              update = modelingService.processSimpleClassSpec(command.element as ClassSpec, command.diagramType);
              const label = command.element.className || command.element.name || command.element.id || 'element';
              successMessage = `[OK] Added ${label} successfully.`;
            }
            break;
          case 'inject_complete_system':
            if (command.systemSpec) {
              update = modelingService.processSystemSpec(command.systemSpec as SystemSpec, command.diagramType);
              const systemName = command.systemSpec.systemName || command.systemSpec.name || 'system';
              successMessage = `[OK] Created ${systemName} successfully.`;
            }
            break;
          case 'modify_model':
            if (Array.isArray(command.modifications) && command.modifications.length > 0) {
              update = modelingService.processModelModifications(command.modifications as ModelModification[]);
              const batchLabel = `${command.modifications.length} modifications`;
              successMessage = `[OK] Applied ${batchLabel} successfully.`;
            } else if (command.modification) {
              update = modelingService.processModelModification(command.modification as ModelModification);
              const actionLabel = command.modification.action || 'modification';
              successMessage = `[OK] Applied ${actionLabel} successfully.`;
            }
            break;
          default:
            throw new Error(`Unknown injection action: ${command.action}`);
        }

        if (update) {
          const success = await modelingService.injectToEditor(update);
          if (!success) {
            throw new Error('Failed to inject to editor');
          }
        } else if (command.model) {
          await modelingService.replaceModel(command.model as Partial<BESSERModel>);
          successMessage = successMessage || '[OK] Imported model update from assistant.';
        } else {
          throw new Error('Assistant did not provide a valid update payload');
        }

        const finalMessage = typeof command.message === 'string' && command.message.trim().length > 0
          ? command.message
          : successMessage || 'Operation completed successfully.';

        const successChatMessage: ChatMessage = {
          id: uiService.generateId('msg'),
          action: 'agent_reply_str',
          message: finalMessage,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, successChatMessage]);
        uiService.showToast('Model updated successfully.', 'success');
      } catch (error) {
        const friendlyError = uiService.getFriendlyErrorMessage(error);
        const errorMessage: ChatMessage = {
          id: uiService.generateId('msg'),
          action: 'agent_reply_str',
          message: `[ERROR] ${friendlyError}`,
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        uiService.showToast(friendlyError, 'error');
      }
    };

    wsService.onMessage(handleMessage);
    wsService.onConnection(handleConnection);
    wsService.onTyping(handleTyping);
    wsService.onInjection((command) => {
      enqueueAssistantTask(() => handleInjection(command));
    });
    wsService.onAction((payload) => {
      enqueueAssistantTask(() => handleAction(payload));
    });

    const state = wsService.connectionState as ConnectionStatus;
    setConnectionStatus(state === 'connected' ? 'connected' : 'connecting');

    wsService.connect().catch((error) => {
      console.error('Failed to initialize WebSocket:', error);
      uiService.showToast('Failed to connect to AI assistant', 'error');
      setConnectionStatus('disconnected');
    });

    return () => {
      wsService.clearHandlers();
    };
  }, [wsService, uiService, hasShownWelcome, modelingService, isVisible, currentDiagramType, onAssistantGenerate, switchDiagramType]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      uiService.scrollToBottom(messagesContainerRef.current);
    }
  }, [messages, isTyping, uiService]);

  const sendMessage = async () => {
    try {
      const validation = uiService.validateUserInput(inputValue);
      if (!validation.valid) {
        uiService.showToast(validation.error || 'Invalid input', 'error');
        return;
      }

      const rateLimitCheck = await rateLimiter.checkRateLimit(inputValue.length);
      if (!rateLimitCheck.allowed) {
        uiService.showToast(rateLimitCheck.reason || 'Rate limit exceeded', 'error');
        return;
      }

      const userMessage: ChatMessage = {
        id: uiService.generateId('msg'),
        action: 'user_message',
        message: inputValue,
        isUser: true,
        timestamp: new Date(),
        diagramType: currentDiagramType,
      };

      setMessages((prev) => [...prev, userMessage]);

      const status = rateLimiter.getRateLimitStatus();
      setRateLimitStatus(status);

      const modelSnapshot = modelingService?.getCurrentModel();
      const activeDiagram = currentProject?.diagrams?.[currentDiagramType as keyof typeof currentProject.diagrams];
      const diagramSummaries = currentProject
        ? Object.entries(currentProject.diagrams).map(([diagramType, diagram]) => ({
            diagramType,
            diagramId: diagram.id,
            title: diagram.title,
          }))
        : [];

      const sendResult: SendStatus = wsService.sendMessage(inputValue, currentDiagramType, modelSnapshot, {
        activeDiagramType: currentDiagramType,
        activeDiagramId: activeDiagram?.id,
        activeModel: modelSnapshot,
        projectSnapshot: currentProject || undefined,
        diagramSummaries,
      });

      if (sendResult === 'error') {
        uiService.showToast('Failed to send message', 'error');
        setMessages((prev) => prev.filter((message) => message.id !== userMessage.id));
        return;
      }

      if (sendResult === 'queued') {
        uiService.showToast('Connection unavailable - request queued for retry.', 'info');
        const state = wsService.connectionState as ConnectionStatus;
        setConnectionStatus(state === 'connected' ? 'connected' : 'connecting');
        if (state === 'disconnected') {
          wsService.connect().catch(() => setConnectionStatus('disconnected'));
        }
      }

      const elementsCount = modelSnapshot?.elements ? Object.keys(modelSnapshot.elements).length : 0;
      const relationshipsCount = modelSnapshot?.relationships ? Object.keys(modelSnapshot.relationships).length : 0;

      posthog.capture('vibe_modeling_agent_message', {
        diagram_type: currentDiagramType,
        message_length: inputValue.length,
        elements_count: elementsCount,
        relationships_count: relationshipsCount,
        total_size: elementsCount + relationshipsCount,
      });

      setInputValue('');
    } catch (error) {
      console.error('Error in sendMessage:', error);
      uiService.showToast('An error occurred while sending the message', 'error');
    }
  };

  const handleImportMessageModel = async (content: string) => {
    if (!modelingService) {
      uiService.showToast('Modeling service not ready', 'error');
      return;
    }

    const jsonBlocks = uiService.extractJsonBlocks(content);
    for (const block of jsonBlocks) {
      try {
        const parsed = JSON.parse(block.json) as Partial<BESSERModel>;
        await modelingService.replaceModel(parsed);
        uiService.showToast('Imported model into editor', 'success');

        const confirmationMessage: ChatMessage = {
          id: uiService.generateId('msg'),
          action: 'agent_reply_str',
          message: '[OK] Imported the suggested model into the editor.',
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, confirmationMessage]);
        return;
      } catch {
        // Try next block if available.
      }
    }

    uiService.showToast('No valid model payload available to import.', 'error');
  };

  const handleCopyJson = () => {
    const currentModel = modelingService?.getCurrentModel();
    if (currentModel) {
      const jsonString = JSON.stringify(currentModel, null, 2);
      navigator.clipboard
        .writeText(jsonString)
        .then(() => {
          uiService.showToast('JSON copied to clipboard.', 'success');
        })
        .catch(() => {
          uiService.showToast('Failed to copy JSON', 'error');
        });
    }
  };

  const handleDownloadJson = () => {
    const currentModel = modelingService?.getCurrentModel();
    if (currentModel) {
      const jsonString = JSON.stringify(currentModel, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${currentDiagramType}_${Date.now()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      uiService.showToast('JSON downloaded.', 'success');
    }
  };

  const getCurrentModelJson = () => {
    const currentModel = modelingService?.getCurrentModel();
    return currentModel ? JSON.stringify(currentModel, null, 2) : '{\n  "error": "No diagram model available"\n}';
  };

  const formattedMessageContentById = useMemo(() => {
    const map = new Map<string, string>();
    for (const message of messages) {
      map.set(message.id, uiService.formatMessageContent(message));
    }
    return map;
  }, [messages, uiService]);

  const kitMessages = useMemo<KitMessage[]>(
    () =>
      messages.map((message) => ({
        id: message.id,
        role: message.isUser ? 'user' : 'assistant',
        content: formattedMessageContentById.get(message.id) || '',
        createdAt: message.timestamp,
      })),
    [messages, formattedMessageContentById],
  );

  const handleChatSubmit = (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    void sendMessage();
  };

  if (!isOnDiagramPage) {
    return null;
  }

  const messageCountLabel = `${messages.length} message${messages.length === 1 ? '' : 's'}`;
  const rateLimitLabel = `${rateLimitStatus.requestsLastMinute}/8 per min`;

  return (
    <>
      <div className="fixed bottom-5 right-4 z-[1000] md:right-16">
        <Card
          className={cn(
            'absolute bottom-[74px] right-0 flex h-[min(78vh,700px)] w-[min(96vw,520px)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-all duration-300 sm:w-[480px] lg:w-[520px]',
            isVisible ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-4 scale-95 opacity-0',
          )}
        >
          <div className="flex items-center justify-between border-b border-border bg-slate-900 px-4 py-3 text-white dark:bg-slate-100 dark:text-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/10">
                <img src={AGENT_AVATAR_SRC} alt="Agent" className="h-6 w-6 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">BESSER UML Assistant</p>
                <p className="mt-1 text-xs opacity-80">AI modeling support</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-white hover:bg-white/15 hover:text-white dark:text-slate-900 dark:hover:bg-slate-300"
                onClick={() => setShowDisclaimer(true)}
                title="Privacy and data processing"
              >
                <CircleHelp className="h-4 w-4" />
              </Button>
              <span className={cn('h-2.5 w-2.5 rounded-full', getConnectionDotClass(connectionStatus))} />
            </div>
          </div>

          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900/40">
            <MessageList
              messages={kitMessages}
              isTyping={isTyping}
              showTimeStamps={false}
              messageOptions={(message) => {
                if (message.role !== 'assistant') {
                  return {};
                }
                if (!uiService.containsImportableModel(message.content)) {
                  return {};
                }

                return {
                  actions: (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => void handleImportMessageModel(message.content)}
                      title="Import suggested model"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  ),
                };
              }}
            />
          </div>

          <Separator />
          <div className="flex items-center justify-between bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', getConnectionDotClass(connectionStatus))} />
              <span>{getConnectionLabel(connectionStatus)}</span>

              <button
                type="button"
                onClick={() => setShowJsonModal(true)}
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                title="View diagram JSON"
              >
                Model: {currentDiagramType.replace('Diagram', '')}
              </button>

              <Badge variant="outline" className={cn('h-6 gap-1 px-2 text-[10px] font-semibold', getRateLimitClass(rateLimitStatus.requestsLastMinute))}>
                <Zap className="h-3 w-3" />
                {rateLimitLabel}
              </Badge>
            </div>

            <span>{messageCountLabel}</span>
          </div>

          <Separator />
          <form className="bg-background p-3" onSubmit={handleChatSubmit}>
            <MessageInput
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Describe what you want to create or modify..."
              isGenerating={isTyping}
              stop={() => setIsTyping(false)}
              submitOnEnter
            />
          </form>
        </Card>

        <Button
          type="button"
          size="icon"
          className="h-14 w-14 rounded-full border border-slate-300 bg-white text-slate-900 shadow-lg transition-transform hover:scale-105 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          onClick={() => setIsVisible((previous) => !previous)}
          title={isVisible ? 'Close UML Assistant' : 'Open UML Assistant'}
        >
          {isVisible ? <X className="h-5 w-5" /> : <img src={AGENT_AVATAR_SRC} alt="Agent" className="h-10 w-10 rounded-full" />}
        </Button>
      </div>

      <JsonViewerModal
        isVisible={showJsonModal}
        jsonData={getCurrentModelJson()}
        diagramType={currentDiagramType}
        onClose={() => setShowJsonModal(false)}
        onCopy={handleCopyJson}
        onDownload={handleDownloadJson}
      />

      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleHelp className="h-5 w-5" />
              Privacy and Data Processing
            </DialogTitle>
            <DialogDescription>
              Important information about how the assistant processes modeling data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">Data processing notice:</strong>
            </p>
            <p>
              When you use the UML Assistant, your messages and diagram data are processed to provide AI-powered modeling support.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your diagram models and messages are sent to the AI service for processing.</li>
              <li>Data is transmitted over encrypted connections.</li>
              <li>Requests are processed to generate UML updates and modeling suggestions.</li>
              <li>Conversation history is stored locally in your current browser session.</li>
            </ul>
            <p>
              <strong className="text-foreground">Privacy:</strong> Avoid sharing sensitive or confidential information in assistant messages.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setShowDisclaimer(false)}>
              I Understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
