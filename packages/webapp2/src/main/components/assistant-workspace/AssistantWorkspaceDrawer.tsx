import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Boxes, WandSparkles, Workflow } from 'lucide-react';
import { ChatForm } from '@/components/chatbot-kit/ui/chat';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import { cn } from '@/lib/utils';

interface AssistantWorkspaceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const HANDLE_HEIGHT = 36;
const FALLBACK_CLOSED_OFFSET = -640;
const VELOCITY_SNAP_THRESHOLD = 0.35;
const POSITION_SNAP_THRESHOLD = 0.45;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const STARTER_PROMPTS = [
  'Generate a web app for hotel booking',
  'Create a library management platform',
  'Design an API for IoT monitoring',
];

const createMessageId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createAssistantReply = (prompt: string): string => {
  const normalizedPrompt = prompt.toLowerCase();
  if (normalizedPrompt.includes('web app')) {
    return 'Great. Next I can map pages, entities, and generation settings for your web app.';
  }
  if (normalizedPrompt.includes('library') || normalizedPrompt.includes('catalog')) {
    return 'Nice start. I can shape a model with books, members, loans, and search flows.';
  }
  if (normalizedPrompt.includes('api')) {
    return 'Good choice. I can structure API resources, operations, and domain entities.';
  }
  return 'I captured your request. Next we can transform it into a concrete modeling flow.';
};

export const AssistantWorkspaceDrawer: React.FC<AssistantWorkspaceDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const responseTimerRef = useRef<number | null>(null);
  const messageListContainerRef = useRef<HTMLDivElement | null>(null);
  const translateYRef = useRef(FALLBACK_CLOSED_OFFSET);

  const [drawerHeight, setDrawerHeight] = useState(0);
  const [isMeasured, setIsMeasured] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [translateY, setTranslateY] = useState(FALLBACK_CLOSED_OFFSET);

  const [messages, setMessages] = useState<ChatKitMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const closedOffset = isMeasured && drawerHeight > 0
    ? -(drawerHeight - HANDLE_HEIGHT)
    : FALLBACK_CLOSED_OFFSET;

  const hasConversation = messages.length > 0;

  const updateTranslateY = (nextOffset: number) => {
    translateYRef.current = nextOffset;
    setTranslateY(nextOffset);
  };

  const ensureMeasuredDrawerHeight = (): number => {
    const element = drawerRef.current;
    if (!element) {
      return 0;
    }

    const measuredHeight = element.getBoundingClientRect().height;
    if (measuredHeight > 0) {
      setDrawerHeight(measuredHeight);
      setIsMeasured(true);
      return measuredHeight;
    }

    return 0;
  };

  const clearPendingAssistantReply = () => {
    if (responseTimerRef.current !== null) {
      window.clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }
  };

  useLayoutEffect(() => {
    const element = drawerRef.current;
    if (!element) {
      return;
    }

    const measure = () => {
      ensureMeasuredDrawerHeight();
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
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
    return () => {
      window.removeEventListener('keydown', onEscape);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (messageListContainerRef.current) {
      messageListContainerRef.current.scrollTop = messageListContainerRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  useEffect(() => {
    return () => {
      clearPendingAssistantReply();
    };
  }, []);

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

    const userMessage: ChatKitMessage = {
      id: createMessageId(),
      role: 'user',
      content: normalizedInput,
      createdAt: new Date(),
    };

    setMessages((previousMessages) => [...previousMessages, userMessage]);
    setInputValue('');
    setIsGenerating(true);

    clearPendingAssistantReply();
    responseTimerRef.current = window.setTimeout(() => {
      const assistantMessage: ChatKitMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: createAssistantReply(normalizedInput),
        createdAt: new Date(),
      };
      setMessages((previousMessages) => [...previousMessages, assistantMessage]);
      setIsGenerating(false);
      responseTimerRef.current = null;
    }, 700);
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
          stop={() => {
            clearPendingAssistantReply();
            setIsGenerating(false);
          }}
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
          openProgress > 0.02 && 'pointer-events-auto',
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
        <div className={cn(
          'pointer-events-auto flex min-h-0 flex-1 flex-col border-t border-border bg-background pb-10 transition-opacity duration-200',
          openProgress < 0.02 && !open && !isDragging && 'opacity-0',
        )}>
          {!hasConversation ? (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-6 sm:px-8">
              <div className="pointer-events-none absolute -left-24 top-8 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
              <div className="pointer-events-none absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-500/10" />
              <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(100,116,139,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.22)_1px,transparent_1px)] [background-size:56px_56px]" />

              <div className="relative flex min-h-[30%] w-full items-start justify-center pt-3 sm:min-h-[33%] sm:pt-8">
                <div className="w-full max-w-4xl text-center">
                  <img
                    src="/images/logo.png"
                    alt="BESSER"
                    className="mx-auto h-14 w-auto brightness-0 dark:invert sm:h-16"
                  />

                  <div className="mt-6 space-y-3">
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      Welcome to the BESSER Web Modeling Assistant
                    </h2>
                    <p className="mx-auto max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                      Describe your idea in natural language and shape it into a model-ready project.
                      Start with your goal, domain, or features and iterate quickly before generation.
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    Explain the domain, users, and goals in plain language.
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/75 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <div className="mb-3 inline-flex rounded-lg bg-emerald-500/15 p-2 text-emerald-700 dark:text-emerald-300">
                    <Boxes className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">Shape the model</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Refine entities, relations, and behaviors before generation.
                  </p>
                </div>
                <div className="rounded-2xl border border-violet-200/70 bg-violet-50/75 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
                  <div className="mb-3 inline-flex rounded-lg bg-violet-500/15 p-2 text-violet-700 dark:text-violet-300">
                    <Workflow className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">Move to generation</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Continue to diagramming and code generation with context kept.
                  </p>
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
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-200',
                openProgress > 0.75 && 'rotate-180',
              )}
            />
            <span>{openProgress > 0.75 ? 'Push up' : 'Pull down assistant'}</span>
          </div>
        </div>
      </section>
    </>
  );
};
