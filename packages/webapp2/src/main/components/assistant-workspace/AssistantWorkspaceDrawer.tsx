import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Boxes, WandSparkles, Workflow } from 'lucide-react';
import { toast } from 'react-toastify';
import { ChatForm } from '@/components/chatbot-kit/ui/chat';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import { cn } from '@/lib/utils';
import { AssistantClient, type AssistantActionPayload, type InjectionCommand } from '../../services/assistant';
import { UML_BOT_WS_URL } from '../../constant';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useProject } from '../../hooks/useProject';
import { updateCurrentDiagramThunk } from '../../services/project/projectSlice';
import { ApollonEditorContext } from '../apollon-editor-component/apollon-editor-context';
import {
  UMLModelingService,
  ClassSpec,
  SystemSpec,
  ModelModification,
  ModelUpdate,
  BESSERModel,
} from '../uml-agent-widget/services/UMLModelingService';
import type { GeneratorType } from '../sidebar/workspace-types';
import type { GenerationResult } from '../../services/generate-code/types';
import { isUMLModel } from '../../types/project';

interface AssistantWorkspaceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTriggerGenerator?: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
  onSwitchDiagram?: (diagramType: string) => Promise<boolean>;
}

interface DragState {
  pointerId: number;
  startY: number;
  startOffset: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  moved: number;
}

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'closed' | 'closing' | 'unknown';

const HANDLE_HEIGHT = 36;
const FALLBACK_CLOSED_OFFSET = -640;
const VELOCITY_SNAP_THRESHOLD = 0.35;
const POSITION_SNAP_THRESHOLD = 0.45;

const STARTER_PROMPTS = [
  'Generate a web app for hotel booking',
  'Create a library management platform',
  'Design an API for IoT monitoring',
];

const UML_DIAGRAM_TYPES = new Set(['ClassDiagram', 'ObjectDiagram', 'StateMachineDiagram', 'AgentDiagram']);

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const isUmlDiagramType = (diagramType?: string): boolean => (diagramType ? UML_DIAGRAM_TYPES.has(diagramType) : false);

const createMessageId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toKitMessage = (role: 'user' | 'assistant', content: string): ChatKitMessage => ({
  id: createMessageId(),
  role,
  content,
  createdAt: new Date(),
});

const toAssistantText = (message: unknown): string => {
  if (typeof message === 'string') {
    return message;
  }
  try {
    return JSON.stringify(message, null, 2);
  } catch {
    return String(message);
  }
};

const toSerializable = <T,>(value: T): T => {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
  } catch {
    // Fall through to JSON clone.
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
};

const logAssistantFlow = (direction: 'send' | 'receive', kind: string, payload: unknown) => {
  const snapshot = toSerializable(payload);
  if (direction === 'send') {
    if (kind === 'user_message') {
      const serialized = JSON.stringify(snapshot);
      console.log(
        `[AssistantWorkspace][SEND] ${kind} bytes=${serialized.length}`,
        snapshot,
      );
      return;
    }
    console.log(`[AssistantWorkspace][SEND] ${kind}`, snapshot);
    return;
  }
  console.log(`[AssistantWorkspace][RECV] ${kind}`, snapshot);
};

export const AssistantWorkspaceDrawer: React.FC<AssistantWorkspaceDrawerProps> = ({
  open,
  onOpenChange,
  onTriggerGenerator,
  onSwitchDiagram,
}) => {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const messageListContainerRef = useRef<HTMLDivElement | null>(null);
  const translateYRef = useRef(FALLBACK_CLOSED_OFFSET);
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const [drawerHeight, setDrawerHeight] = useState(0);
  const [isMeasured, setIsMeasured] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [translateY, setTranslateY] = useState(FALLBACK_CLOSED_OFFSET);

  const [messages, setMessages] = useState<ChatKitMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  const dispatch = useAppDispatch();
  const { editor } = useContext(ApollonEditorContext);
  const currentDiagram = useAppSelector((state) => state.diagram);
  const { currentProject, currentDiagramType } = useProject();

  const modelingServiceRef = useRef<UMLModelingService | null>(null);
  const onTriggerGeneratorRef = useRef(onTriggerGenerator);
  const onSwitchDiagramRef = useRef(onSwitchDiagram);
  const currentProjectRef = useRef(currentProject);
  const currentDiagramTypeRef = useRef(currentDiagramType);
  const currentModelRef = useRef<any>(null);

  onTriggerGeneratorRef.current = onTriggerGenerator;
  onSwitchDiagramRef.current = onSwitchDiagram;
  currentProjectRef.current = currentProject;
  currentDiagramTypeRef.current = currentDiagramType;
  currentModelRef.current = currentDiagram?.diagram?.model;

  const buildWorkspaceContext = (): {
    activeDiagramType: string;
    activeDiagramId?: string;
    activeModel?: any;
    projectSnapshot?: any;
    diagramSummaries?: Array<{ diagramType: string; diagramId?: string; title?: string }>;
  } => {
    const project = currentProjectRef.current;
    const activeType = currentDiagramTypeRef.current || 'ClassDiagram';
    const activeDiagram = project?.diagrams?.[activeType as keyof typeof project.diagrams];
    const projectModel = activeDiagram?.model;
    const editorModel = isUMLModel(currentModelRef.current) ? currentModelRef.current : undefined;
    const activeModel = isUmlDiagramType(activeType)
      ? modelingServiceRef.current?.getCurrentModel() || editorModel || projectModel
      : projectModel;

    const diagramSummaries = project
      ? Object.entries(project.diagrams).map(([diagramType, diagram]) => ({
          diagramType,
          diagramId: diagram.id,
          title: diagram.title,
        }))
      : [];

    return {
      activeDiagramType: activeType,
      activeDiagramId: activeDiagram?.id,
      activeModel,
      projectSnapshot: project || undefined,
      diagramSummaries,
    };
  };

  const [assistantClient] = useState(
    () =>
      new AssistantClient(UML_BOT_WS_URL, {
        clientMode: 'workspace',
        contextProvider: buildWorkspaceContext,
      }),
  );

  const [modelingService, setModelingService] = useState<UMLModelingService | null>(null);

  useEffect(() => {
    if (editor && dispatch && !modelingService) {
      const service = new UMLModelingService(editor, dispatch);
      modelingServiceRef.current = service;
      setModelingService(service);
    } else if (editor && modelingService) {
      modelingService.updateEditorReference(editor);
      modelingServiceRef.current = modelingService;
    }
  }, [dispatch, editor, modelingService]);

  useEffect(() => {
    if (modelingService && currentDiagram?.diagram?.model && isUMLModel(currentDiagram.diagram.model)) {
      modelingService.updateCurrentModel(currentDiagram.diagram.model);
    }
  }, [currentDiagram, modelingService]);

  const closedOffset = isMeasured && drawerHeight > 0 ? -(drawerHeight - HANDLE_HEIGHT) : FALLBACK_CLOSED_OFFSET;
  const hasConversation = messages.length > 0;

  const updateTranslateY = (nextOffset: number) => {
    if (translateYRef.current === nextOffset) {
      return;
    }
    translateYRef.current = nextOffset;
    setTranslateY(nextOffset);
  };

  const ensureMeasuredDrawerHeight = (): number => {
    const element = drawerRef.current;
    if (!element) {
      return 0;
    }
    const measuredHeight = Math.round(element.getBoundingClientRect().height);
    if (measuredHeight > 0) {
      setDrawerHeight((previous) => (previous === measuredHeight ? previous : measuredHeight));
      setIsMeasured((previous) => (previous ? previous : true));
      return measuredHeight;
    }
    return 0;
  };

  useLayoutEffect(() => {
    const element = drawerRef.current;
    if (!element) {
      return;
    }

    const measure = () => ensureMeasuredDrawerHeight();
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (isDragging) {
      return;
    }
    if (!isMeasured) {
      if (open) {
        updateTranslateY(0);
      }
      return;
    }
    updateTranslateY(open ? 0 : closedOffset);
  }, [closedOffset, isDragging, isMeasured, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (messageListContainerRef.current) {
      messageListContainerRef.current.scrollTop = messageListContainerRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const waitForSwitchRender = async (): Promise<void> => {
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

  const ensureTargetDiagramReady = async (targetDiagramType?: string): Promise<boolean> => {
    if (!targetDiagramType || targetDiagramType === currentDiagramTypeRef.current) {
      return true;
    }

    const switchDiagramHandler = onSwitchDiagramRef.current;
    if (!switchDiagramHandler) {
      return false;
    }

    const switched = await switchDiagramHandler(targetDiagramType);
    if (!switched) {
      return false;
    }

    await waitForSwitchRender();
    return true;
  };

  const enqueueAssistantTask = (task: () => Promise<void> | void) => {
    operationQueueRef.current = operationQueueRef.current
      .then(async () => {
        await task();
      })
      .catch((error) => {
        console.error('Assistant task queue error:', error);
      });
  };

  const handleInjection = async (command: InjectionCommand) => {
    try {
      const diagramReady = await ensureTargetDiagramReady(command.diagramType);
      if (!diagramReady) {
        throw new Error(`Could not switch to ${command.diagramType || 'the target diagram'}`);
      }

      const targetDiagramType = command.diagramType || currentDiagramTypeRef.current || 'ClassDiagram';
      const targetIsUml = isUmlDiagramType(targetDiagramType);
      let applied = false;

      if (targetIsUml && modelingServiceRef.current) {
        let update: ModelUpdate | null = null;
        switch (command.action) {
          case 'inject_element':
            if (command.element && typeof command.element === 'object' && command.element.className) {
              update = modelingServiceRef.current.processSimpleClassSpec(command.element as ClassSpec, command.diagramType);
            } else if (command.element) {
              throw new Error('inject_element payload is missing required className field');
            }
            break;
          case 'inject_complete_system':
            if (command.systemSpec && typeof command.systemSpec === 'object' && Array.isArray(command.systemSpec.classes ?? command.systemSpec.states ?? command.systemSpec.objects)) {
              update = modelingServiceRef.current.processSystemSpec(command.systemSpec as SystemSpec, command.diagramType);
            } else if (command.systemSpec) {
              throw new Error('inject_complete_system payload is missing a valid classes/states/objects array');
            }
            break;
          case 'modify_model':
            if (command.modification && typeof command.modification === 'object' && command.modification.action && command.modification.target) {
              update = modelingServiceRef.current.processModelModification(command.modification as ModelModification);
            } else if (command.modification) {
              throw new Error('modify_model payload is missing required action or target fields');
            }
            break;
          default:
            break;
        }

        if (update) {
          await modelingServiceRef.current.injectToEditor(update);
          applied = true;
        } else if (command.model) {
          await modelingServiceRef.current.replaceModel(command.model as Partial<BESSERModel>);
          applied = true;
        }
      }

      if (!applied && command.model) {
        const result = await dispatch(updateCurrentDiagramThunk({ model: command.model as any }));
        if (updateCurrentDiagramThunk.rejected.match(result)) {
          throw new Error(result.error.message || 'Failed to persist assistant model update');
        }
        applied = true;
      }

      if (!applied && targetIsUml && !modelingServiceRef.current) {
        throw new Error('UML modeling service not ready');
      }

      if (!applied) {
        throw new Error('Assistant did not provide a valid update payload');
      }

      const infoMessage =
        typeof command.message === 'string' && command.message.trim()
          ? command.message
          : 'Applied assistant model update.';
      setMessages((prev) => [...prev, toKitMessage('assistant', infoMessage)]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Could not apply assistant update: ${errorMessage}`);
      setMessages((prev) => [
        ...prev,
        toKitMessage('assistant', `I wasn't able to apply that change \u2014 ${errorMessage}. Try rephrasing your request.`),
      ]);
    }
  };

  const handleAction = async (payload: AssistantActionPayload) => {
    if (payload.action === 'assistant_message') {
      return;
    }

    if (payload.action === 'switch_diagram') {
      const diagramType = typeof payload.diagramType === 'string' ? payload.diagramType : '';
      if (!diagramType) {
        return;
      }
      const switchDiagramHandler = onSwitchDiagramRef.current;
      const switched = switchDiagramHandler ? await switchDiagramHandler(diagramType) : false;
      if (!switched) {
        setMessages((prev) => [
          ...prev,
          toKitMessage('assistant', `Could not switch to ${diagramType}.`),
        ]);
      } else {
        const reason = payload.reason;
        if (typeof reason === 'string' && reason.trim()) {
          setMessages((prev) => [...prev, toKitMessage('assistant', reason)]);
        }
      }
      return;
    }

    if (payload.action === 'trigger_generator') {
      const generatorType = payload.generatorType;
      const triggerGeneratorHandler = onTriggerGeneratorRef.current;
      if (!triggerGeneratorHandler || typeof generatorType !== 'string') {
        setMessages((prev) => [
          ...prev,
          toKitMessage('assistant', 'Generation is not available in this context.'),
        ]);
        return;
      }

      const result = await triggerGeneratorHandler(generatorType as GeneratorType, payload.config);
      logAssistantFlow('send', 'frontend_event.generator_result', {
        action: 'frontend_event',
        eventType: 'generator_result',
        generatorType,
        result,
      });
      assistantClient.sendFrontendEvent('generator_result', {
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
      const message = typeof payload.message === 'string' ? payload.message : 'Something went wrong on the assistant side.';
      setMessages((prev) => [...prev, toKitMessage('assistant', message)]);
    }
  };

  useEffect(() => {
    if (!open) {
      assistantClient.clearHandlers();
      assistantClient.disconnect({ allowReconnect: false, clearQueue: true });
      setIsGenerating(false);
      setConnectionStatus('disconnected');
      return;
    }

    assistantClient.onMessage((message) => {
      logAssistantFlow('receive', 'assistant_message', message);
      setMessages((previous) => [...previous, toKitMessage('assistant', toAssistantText(message.message))]);
    });
    assistantClient.onConnection((connected) => {
      const next = connected ? 'connected' : (assistantClient.connectionState as ConnectionStatus);
      logAssistantFlow('receive', 'connection', { connected, state: next });
      setConnectionStatus((previous) => (previous === next ? previous : next));
    });
    assistantClient.onTyping((typing) => {
      logAssistantFlow('receive', 'typing', { typing });
      setIsGenerating((previous) => (previous === typing ? previous : typing));
    });
    assistantClient.onInjection((command) => {
      logAssistantFlow('receive', 'injection_command', command);
      enqueueAssistantTask(() => handleInjection(command));
    });
    assistantClient.onAction((payload) => {
      logAssistantFlow('receive', 'action_payload', payload);
      enqueueAssistantTask(() => handleAction(payload));
    });

    setConnectionStatus((previous) => {
      const next = (assistantClient.connectionState as ConnectionStatus) || 'connecting';
      return previous === next ? previous : next;
    });
    assistantClient.connect().catch(() => {
      setConnectionStatus((previous) => (previous === 'disconnected' ? previous : 'disconnected'));
      toast.error('Could not reach the AI assistant \u2014 make sure the backend is running.');
    });

    return () => {
      assistantClient.clearHandlers();
    };
  }, [assistantClient, open]);

  const totalTravel = Math.max(1, 0 - closedOffset);
  const openProgress = isMeasured ? clamp((translateY - closedOffset) / totalTravel, 0, 1) : open ? 1 : 0;

  const updateDragPosition = (clientY: number) => {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }
    const now = performance.now();
    const dragDistance = clientY - dragState.startY;
    const currentClosedOffset = isMeasured ? closedOffset : -Math.max(drawerHeight, 1);
    const nextOffset = clamp(dragState.startOffset + dragDistance, currentClosedOffset, 0);

    const deltaTime = Math.max(1, now - dragState.lastTime);
    dragState.velocity = (clientY - dragState.lastY) / deltaTime;
    dragState.moved = Math.max(dragState.moved, Math.abs(dragDistance));
    dragState.lastY = clientY;
    dragState.lastTime = now;

    updateTranslateY(nextOffset);
  };

  const finishDrag = () => {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }

    if (dragHandleRef.current && dragHandleRef.current.hasPointerCapture(dragState.pointerId)) {
      try {
        dragHandleRef.current.releasePointerCapture(dragState.pointerId);
      } catch {
        // Ignore release failures.
      }
    }

    dragStateRef.current = null;
    setIsDragging(false);

    const progress = clamp((translateYRef.current - closedOffset) / totalTravel, 0, 1);
    let shouldOpen = progress >= POSITION_SNAP_THRESHOLD;
    if (dragState.moved < 6) {
      shouldOpen = !open;
    } else if (Math.abs(dragState.velocity) > VELOCITY_SNAP_THRESHOLD) {
      shouldOpen = dragState.velocity > 0;
    }
    onOpenChange(shouldOpen);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const measuredHeight = isMeasured ? drawerHeight : ensureMeasuredDrawerHeight();
    if (measuredHeight <= 0) {
      return;
    }

    const startOffset = open ? translateYRef.current : -(measuredHeight - HANDLE_HEIGHT);
    if (!open) {
      updateTranslateY(startOffset);
    }

    dragHandleRef.current = event.currentTarget;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail on some devices; window listeners still handle drag.
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocity: 0,
      moved: 0,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }
    const onPointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      updateDragPosition(event.clientY);
    };

    const onPointerEnd = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      finishDrag();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [isDragging, drawerHeight, isMeasured, closedOffset, totalTravel, open, onOpenChange]);

  const handleSubmit = (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    const normalizedInput = inputValue.trim();
    if (!normalizedInput || isGenerating) {
      return;
    }

    setMessages((previousMessages) => [...previousMessages, toKitMessage('user', normalizedInput)]);
    setInputValue('');

    const context = buildWorkspaceContext();
    const modelSnapshot = modelingServiceRef.current?.getCurrentModel() || context.activeModel;
    logAssistantFlow('send', 'user_message', {
      action: 'user_message',
      protocolVersion: '2.0',
      clientMode: 'workspace',
      message: normalizedInput,
      context,
    });
    const sendResult = assistantClient.sendMessage(normalizedInput, context.activeDiagramType, modelSnapshot, context);
    logAssistantFlow('send', 'send_result', { sendResult });
    if (sendResult === 'queued') {
      toast.info('Reconnecting to the assistant \u2014 your message will be sent automatically.');
      setConnectionStatus('connecting');
      assistantClient.connect().catch(() => setConnectionStatus('disconnected'));
    } else if (sendResult === 'error') {
      toast.error('Could not send your message \u2014 please try again.');
    }
  };

  const renderComposer = (className: string) => (
    <ChatForm className={className} isPending={isGenerating} handleSubmit={handleSubmit}>
      {({ files, setFiles }) => (
        <MessageInput
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          allowAttachments
          files={files}
          setFiles={setFiles}
          stop={() => setIsGenerating(false)}
          isGenerating={isGenerating}
        />
      )}
    </ChatForm>
  );

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt);
  };

  return (
    <>
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-30 bg-slate-950/70 transition-opacity duration-200',
          (open || isDragging) && openProgress > 0.02 && 'pointer-events-auto',
        )}
        style={{ opacity: openProgress * 0.65 }}
        onClick={() => onOpenChange(false)}
      />

      <section
        ref={drawerRef}
        className={cn(
          'pointer-events-none absolute inset-0 z-40 flex flex-col overflow-hidden bg-transparent',
          !isDragging && 'transition-transform duration-300 ease-out',
        )}
        style={{
          transform:
            !isMeasured && !open && !isDragging
              ? `translateY(calc(-100% + ${HANDLE_HEIGHT}px))`
              : `translateY(${translateY}px)`,
        }}
        aria-hidden={!open && !isDragging}
      >
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col border-t border-border bg-background pb-10 transition-opacity duration-200',
            (open || isDragging) ? 'pointer-events-auto' : 'pointer-events-none',
            openProgress < 0.02 && !open && !isDragging && 'opacity-0',
          )}
        >
          {!hasConversation ? (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-6 sm:px-8">
              <div className="pointer-events-none absolute -left-24 top-8 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
              <div className="pointer-events-none absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-500/10" />
              <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(100,116,139,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.22)_1px,transparent_1px)] [background-size:56px_56px]" />

              <div className="relative flex min-h-[30%] w-full items-start justify-center pt-3 sm:min-h-[33%] sm:pt-8">
                <div className="w-full max-w-4xl text-center">
                  <img src="/images/logo.png" alt="BESSER" className="mx-auto h-14 w-auto brightness-0 dark:invert sm:h-16" />
                  <div className="mt-6 space-y-3">
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      Welcome to the BESSER Web Modeling Assistant
                    </h2>
                    <p className="mx-auto max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                      Describe your idea in natural language and shape it into a model-ready project.{' '}
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <span
                          className={cn(
                            'inline-block h-2 w-2 rounded-full',
                            connectionStatus === 'connected' && 'bg-emerald-500',
                            connectionStatus === 'connecting' && 'bg-amber-400 animate-pulse',
                            (connectionStatus === 'disconnected' || connectionStatus === 'closed') && 'bg-red-400',
                          )}
                        />
                        {connectionStatus === 'connected'
                          ? 'Connected'
                          : connectionStatus === 'connecting'
                            ? 'Connecting\u2026'
                            : 'Disconnected'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative mx-auto grid w-full max-w-5xl gap-3 pb-6 sm:grid-cols-3">
                <div className="rounded-2xl border border-sky-200/70 bg-sky-50/75 p-4 dark:border-sky-900/60 dark:bg-sky-950/20">
                  <div className="mb-3 inline-flex rounded-lg bg-sky-500/15 p-2 text-sky-700 dark:text-sky-300">
                    <WandSparkles className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">Describe the idea</p>
                  <p className="mt-1 text-xs text-muted-foreground">Explain the domain, users, and goals in plain language.</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/75 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <div className="mb-3 inline-flex rounded-lg bg-emerald-500/15 p-2 text-emerald-700 dark:text-emerald-300">
                    <Boxes className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">Shape the model</p>
                  <p className="mt-1 text-xs text-muted-foreground">Refine entities, relations, and behaviors before generation.</p>
                </div>
                <div className="rounded-2xl border border-violet-200/70 bg-violet-50/75 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
                  <div className="mb-3 inline-flex rounded-lg bg-violet-500/15 p-2 text-violet-700 dark:text-violet-300">
                    <Workflow className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">Move to generation</p>
                  <p className="mt-1 text-xs text-muted-foreground">Trigger frontend generators with validated assistant configuration.</p>
                </div>
              </div>

              <div className="relative flex min-h-0 flex-1 items-center justify-center pb-6 sm:pb-10">
                <div className="w-full max-w-2xl space-y-3">
                  <div className="flex flex-wrap justify-center gap-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handlePromptClick(prompt)}
                        className="rounded-full border border-border/80 bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-slate-400 hover:text-foreground dark:hover:border-slate-500"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-background/90 p-3 shadow-lg backdrop-blur sm:p-4">
                    {renderComposer('w-full')}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div ref={messageListContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-6 sm:px-8">
                <div className="mx-auto w-full max-w-4xl">
                  <MessageList messages={messages} isTyping={isGenerating} showTimeStamps={false} />
                </div>
              </div>
              <div className="border-t border-border bg-background px-4 py-3 sm:px-8">
                <div className="mx-auto w-full max-w-4xl">{renderComposer('w-full')}</div>
              </div>
            </>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-10 items-end justify-center pb-1">
          <div
            className={cn(
              'pointer-events-auto inline-flex cursor-row-resize touch-none select-none items-center gap-2 rounded-full border border-border/80 bg-background/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground shadow-md backdrop-blur',
              openProgress > 0.75 && 'shadow-sm',
            )}
            onPointerDown={handlePointerDown}
            role="button"
            aria-label={open ? 'Push up to close assistant workspace' : 'Pull down to open assistant workspace'}
            tabIndex={0}
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', openProgress > 0.75 && 'rotate-180')} />
            <span>{openProgress > 0.75 ? 'Push up' : 'Pull down assistant'}</span>
          </div>
        </div>
      </section>
    </>
  );
};
