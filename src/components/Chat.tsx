import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Loader2, Coins, Zap, MoreVertical, Trash2, RotateCw, RefreshCw, Edit, Check, X, Square, Download } from 'lucide-react';
import { Message } from '../types';
import { chatWithOpenRouterStream, getModels, OpenRouterMessage } from '../services/openrouter';
import { loadAPIKey, loadDocuments, loadMemories, loadSystemPrompt, trackModelUsage, loadModelUsage, loadLLMSettings, incrementMemoryUseCount } from '../services/storage';
import { retrieveRelevantChunks } from '../services/rag';
import ModelPickerModal from './ModelPickerModal';

interface ChatProps {
  conversationId: string | null;
  messages: Message[];
  onMessagesChange: (next: Message[] | ((prev: Message[]) => Message[])) => void;
  selectedMemories: string[];
  selectedDocuments: string[];
  model: string;
  conversationTitle?: string;
  onInputChange?: (value: string) => void;
  onMemoriesUsed?: () => void;
}

export default function Chat({
  conversationId,
  messages,
  onMessagesChange,
  selectedMemories,
  selectedDocuments,
  model,
  conversationTitle,
  onInputChange,
  onMemoriesUsed,
}: ChatProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionTokens, setCurrentSessionTokens] = useState(0);
  const [currentSessionCost, setCurrentSessionCost] = useState(0);
  const [modelPricing, setModelPricing] = useState<{ prompt: number; completion: number } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [rerunWithModelMessageId, setRerunWithModelMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [usageVersion, setUsageVersion] = useState(0);
  const [comparingMessages, setComparingMessages] = useState<{ oldId: string; newId: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamContentRef = useRef<{ content: string; messageId: string; updateFn: (content: string) => void } | null>(null);
  const shouldAutoScrollRef = useRef<boolean>(false);
  const prevMessagesLengthRef = useRef<number>(0);

  // Only auto-scroll when streaming completes or when new messages are added (not during streaming)
  useEffect(() => {
    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;
    
    if (!streamingMessageId) {
      // Scroll when streaming completes or when a new message is added
      if (shouldAutoScrollRef.current || isNewMessage) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        shouldAutoScrollRef.current = false;
      }
    }
  }, [streamingMessageId, messages.length]);

  // Auto-resize textarea as user types
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const h = Math.max(42, Math.min(el.scrollHeight, 200));
    el.style.height = `${h}px`;
  }, [input]);

  // Auto-resize edit textarea to match message size (same typography as message bubbles)
  useEffect(() => {
    const el = editTextareaRef.current;
    if (!el || !editingMessageId) return;
    el.style.overflow = 'hidden';
    el.style.height = '0';
    const minH = 120;
    const maxH = Math.max(400, Math.min(500, window.innerHeight * 0.5));
    const h = Math.max(minH, Math.min(maxH, el.scrollHeight));
    el.style.height = `${h}px`;
    el.style.overflow = 'auto';
  }, [editingMessageId, editContent]);

  // Calculate cost helper function
  const calculateCost = useCallback((promptTokens: number, completionTokens: number, pricing?: { prompt: number; completion: number }) => {
    const pricingToUse = pricing || modelPricing;
    if (!pricingToUse) return 0;
    const promptCost = (promptTokens / 1000000) * pricingToUse.prompt;
    const completionCost = (completionTokens / 1000000) * pricingToUse.completion;
    return promptCost + completionCost;
  }, [modelPricing]);

  // Load model pricing when model changes
  useEffect(() => {
    const loadPricing = async () => {
      try {
        const apiKey = loadAPIKey();
        if (!apiKey) return;
        
        const models = await import('../services/openrouter').then(m => m.getModels(apiKey));
        const currentModel = models.find(m => m.id === model);
        
        if (currentModel?.pricing) {
          setModelPricing({
            prompt: parseFloat(currentModel.pricing.prompt || '0'),
            completion: parseFloat(currentModel.pricing.completion || '0'),
          });
        } else {
          setModelPricing(null);
        }
      } catch (error) {
        console.error('Error loading model pricing:', error);
        setModelPricing(null);
      }
    };
    
    loadPricing();
  }, [model]);

  // Calculate overall stats (usageVersion forces refresh when we track new usage)
  const overallStats = useMemo(() => {
    const usage = loadModelUsage();
    let totalTokens = 0;
    let totalCost = 0;
    
    usage.forEach(u => {
      totalTokens += u.totalTokens;
      // Calculate cost using stored pricing for each model
      const promptTokens = u.totalPromptTokens || 0;
      const completionTokens = u.totalCompletionTokens || 0;
      
      if (u.pricing) {
        // Use stored pricing for this specific model
        if (promptTokens > 0 || completionTokens > 0) {
          // If we have token breakdown, use accurate calculation
          totalCost += calculateCost(promptTokens, completionTokens, u.pricing);
        } else {
          // Fallback: estimate using stored pricing and total tokens (for old data without breakdown)
          const estimatedCost = (u.totalTokens / 1000000) * 
            ((u.pricing.prompt + u.pricing.completion) / 2);
          totalCost += estimatedCost;
        }
      }
      // If no stored pricing, skip cost calculation for this model (don't use wrong pricing)
    });
    
    return { totalTokens, totalCost };
  }, [calculateCost, usageVersion]);

  const executeCompletion = useCallback(
    async (
      userContent: string,
      historyMessages: Message[],
      modelToUse: string,
      assistantMessageId: string,
      isRerun: boolean
    ) => {
      const apiKey = loadAPIKey();
      if (!apiKey) throw new Error('API key not set. Please configure it in settings.');

      const llmSettings = loadLLMSettings();
      const maxMessages = llmSettings.max_messages ?? 10;

      let contextMessages: OpenRouterMessage[] = [];
      const systemPrompt = loadSystemPrompt();
      if (systemPrompt.trim()) {
        contextMessages.push({ role: 'system', content: systemPrompt });
      }
      if (selectedMemories.length > 0) {
        const memories = loadMemories();
        const selectedMemoryTexts = memories
          .filter(m => selectedMemories.includes(m.id))
          .map(m => `Memory: ${m.title}\n${m.content}`)
          .join('\n\n');
        if (selectedMemoryTexts) {
          contextMessages.push({
            role: 'system',
            content: `Relevant memories:\n${selectedMemoryTexts}`,
          });
        }
      }
      if (selectedDocuments.length > 0) {
        const allDocuments = loadDocuments();
        const selectedDocs = allDocuments.filter(d =>
          selectedDocuments.includes(d.metadata.fileName)
        );
        if (selectedDocs.length > 0) {
          const relevantChunks = await retrieveRelevantChunks(userContent, selectedDocs, 5);
          const ragContext = relevantChunks
            .map(chunk => `[From ${chunk.metadata.fileName}]: ${chunk.content}`)
            .join('\n\n');
          if (ragContext) {
            contextMessages.push({
              role: 'system',
              content: `Relevant document excerpts:\n${ragContext}`,
            });
          }
        }
      }

      const conversationMessages: OpenRouterMessage[] = historyMessages
        .slice(-maxMessages)
        .map(m => ({ role: m.role, content: m.content }));
      const allMessages = isRerun
        ? [...contextMessages, ...conversationMessages]
        : [...contextMessages, ...conversationMessages, { role: 'user' as const, content: userContent }];

      const useOnlineSearch = !!llmSettings.online_search;
      const effectiveModel =
        useOnlineSearch && !modelToUse.endsWith(':online')
          ? `${modelToUse}:online`
          : modelToUse;

      let pricingToUse: { prompt: number; completion: number } | null = null;
      if (modelToUse === model) {
        pricingToUse = modelPricing;
      } else {
        try {
          const models = await getModels(apiKey);
          const m = models.find((x: { id: string }) => x.id === modelToUse);
          if (m?.pricing) {
            pricingToUse = {
              prompt: parseFloat(m.pricing.prompt || '0'),
              completion: parseFloat(m.pricing.completion || '0'),
            };
          }
        } catch {
          /* ignore */
        }
      }

      const updateMessageContent = (content: string) => {
        onMessagesChange((prev) =>
          prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, content } : msg))
        );
      };

      // Store stream state in refs for stop handler access
      streamContentRef.current = {
        content: '',
        messageId: assistantMessageId,
        updateFn: updateMessageContent,
      };

      const { online_search: _online, max_messages: _maxMsgs, ...apiLlmSettings } = llmSettings;
      
      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      try {
        await chatWithOpenRouterStream(
          apiKey,
          { model: effectiveModel, messages: allMessages, ...apiLlmSettings },
          {
            onChunk: (c) => { 
              if (streamContentRef.current) {
                streamContentRef.current.content += c;
                streamContentRef.current.updateFn(streamContentRef.current.content);
              }
            },
            onComplete: (usage) => {
              if (streamContentRef.current) {
                streamContentRef.current = null;
              }
              setStreamingMessageId(null);
              shouldAutoScrollRef.current = true;
              abortControllerRef.current = null;
              const promptTokens = usage.prompt_tokens || 0;
              const completionTokens = usage.completion_tokens || 0;
              const totalTokens = usage.total_tokens || 0;
              const pricingToStore = pricingToUse ?? undefined;
              trackModelUsage(
                effectiveModel,
                totalTokens,
                promptTokens,
                completionTokens,
                pricingToStore
              );
              setUsageVersion((v) => v + 1);
              setCurrentSessionTokens((prev) => prev + totalTokens);
              const cost = pricingToStore
                ? calculateCost(promptTokens, completionTokens, pricingToStore)
                : 0;
              setCurrentSessionCost((prev) => prev + cost);
            },
            onError: (error) => {
              if (streamContentRef.current) {
                streamContentRef.current = null;
              }
              setStreamingMessageId(null);
              abortControllerRef.current = null;
              // Don't show error if it was aborted
              if (error.name !== 'AbortError') {
                onMessagesChange((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: `Error: ${error.message || 'Failed to get response'}` }
                      : msg
                  )
                );
              }
            },
          },
          abortController.signal
        );
      } finally {
        if (streamContentRef.current) {
          streamContentRef.current = null;
        }
        abortControllerRef.current = null;
      }
    },
    [
      model,
      modelPricing,
      selectedMemories,
      selectedDocuments,
      calculateCost,
      onMessagesChange,
    ]
  );

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    onMessagesChange((prev) => [...prev, userMessage]);
    if (selectedMemories.length > 0) {
      incrementMemoryUseCount(selectedMemories);
      onMemoriesUsed?.();
    }
    setInput('');
    onInputChange?.('');
    setIsLoading(true);
    setTimeout(() => inputRef.current?.focus(), 0);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    onMessagesChange((prev) => [...prev, assistantMessage]);
    setStreamingMessageId(assistantMessageId);

    try {
      await executeCompletion(input, messages, model, assistantMessageId, false);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setStreamingMessageId(null);
      onMessagesChange((prev) => {
        const has = prev.some((m) => m.id === assistantMessageId);
        if (has) {
          return prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${err.message}` }
              : msg
          );
        }
        return [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant' as const,
            content: `Error: ${err.message}`,
            timestamp: Date.now(),
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRerun = useCallback(
    async (messageId: string, modelOverride?: string) => {
      if (isLoading) return;
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;
      const msg = messages[idx];
      if (msg.role !== 'user') return;

      setOpenMenuId(null);
      setRerunWithModelMessageId(null);

      // Check if there's an existing assistant message after this user message
      const nextMessage = messages[idx + 1];
      const hasExistingAssistant = nextMessage?.role === 'assistant';
      const oldAssistantId = hasExistingAssistant ? nextMessage.id : null;

      const trimmed = messages.slice(0, idx + 1);
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      
      // If there's an existing assistant message, keep it for comparison
      if (hasExistingAssistant && oldAssistantId) {
        onMessagesChange(() => [...trimmed, messages[idx + 1], assistantMessage]);
      } else {
        onMessagesChange(() => [...trimmed, assistantMessage]);
      }
      
      setStreamingMessageId(assistantMessageId);
      setIsLoading(true);

      try {
        await executeCompletion(
          msg.content,
          trimmed,
          modelOverride ?? model,
          assistantMessageId,
          true
        );
        
        // After completion, if there was an existing assistant message, enable comparison mode
        if (hasExistingAssistant && oldAssistantId) {
          setComparingMessages({ oldId: oldAssistantId, newId: assistantMessageId });
        }
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setStreamingMessageId(null);
        onMessagesChange((prev) => {
          const has = prev.some((m) => m.id === assistantMessageId);
          if (has) {
            return prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: `Error: ${err.message}` }
                : m
            );
          }
          return [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'assistant' as const,
              content: `Error: ${err.message}`,
              timestamp: Date.now(),
            },
          ];
        });
      } finally {
        setIsLoading(false);
      }
    },
    [messages, model, isLoading, executeCompletion, onMessagesChange]
  );

  // Reset session stats when switching conversations
  useEffect(() => {
    setCurrentSessionTokens(0);
    setCurrentSessionCost(0);
  }, [conversationId]);

  // Close message menu on click outside
  useEffect(() => {
    if (openMenuId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      setOpenMenuId(null);
      onMessagesChange((prev) => prev.filter((m) => m.id !== messageId));
    },
    [onMessagesChange]
  );

  const handleDeleteMessageAndBelow = useCallback(
    (messageId: string) => {
      setOpenMenuId(null);
      onMessagesChange((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        if (idx === -1) return prev;
        return prev.slice(0, idx);
      });
    },
    [onMessagesChange]
  );

  const handleStartEdit = useCallback((messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message) {
      setEditingMessageId(messageId);
      setEditContent(message.content);
      setOpenMenuId(null);
    }
  }, [messages]);

  const handleSaveEdit = useCallback(() => {
    if (editingMessageId) {
      onMessagesChange((prev) =>
        prev.map((msg) =>
          msg.id === editingMessageId ? { ...msg, content: editContent } : msg
        )
      );
      setEditingMessageId(null);
      setEditContent('');
    }
  }, [editingMessageId, editContent, onMessagesChange]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditContent('');
  }, []);

  const handleSelectMessage = useCallback(
    (messageIdToKeep: string) => {
      if (!comparingMessages) return;
      
      const messageToRemove = messageIdToKeep === comparingMessages.oldId 
        ? comparingMessages.newId 
        : comparingMessages.oldId;
      
      onMessagesChange((prev) => prev.filter((m) => m.id !== messageToRemove));
      setComparingMessages(null);
    },
    [comparingMessages, onMessagesChange]
  );

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      // Finalize any remaining content
      if (streamContentRef.current) {
        streamContentRef.current = null;
      }
      
      // Abort the fetch request
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStreamingMessageId(null);
      setIsLoading(false);
    }
  }, []);

  const handleExportMarkdown = useCallback(() => {
    const filtered = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    if (filtered.length === 0) return;

    const title = conversationTitle || 'Chat export';
    const exportedAt = new Date().toISOString();
    const lines: string[] = [
      `# ${title}`,
      '',
      `*Exported ${exportedAt}*`,
      '',
    ];
    for (const m of filtered) {
      const heading = m.role === 'user' ? '## User' : '## Assistant';
      lines.push(heading);
      lines.push('');
      lines.push(m.content.trim());
      lines.push('');
    }

    const md = lines.join('\n').trimEnd();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = title.replace(/[<>:"/\\|?*]/g, '-').slice(0, 80) || 'chat';
    const date = new Date().toISOString().slice(0, 10);
    a.download = `${safeTitle}-${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, conversationTitle]);

  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      <div
        className="border-b px-4 py-2"
        style={{ backgroundColor: 'var(--theme-stats-bg)', borderColor: 'var(--theme-border)' }}
      >
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1" style={{ color: 'var(--theme-text-muted)' }}>
              <Zap size={14} />
              <span>Session:</span>
              <span className="font-medium" style={{ color: 'var(--theme-text)' }}>
                {currentSessionTokens.toLocaleString()} tokens
              </span>
              {currentSessionCost > 0 && (
                <>
                  <span className="mx-1 opacity-60">•</span>
                  <Coins size={14} />
                  <span className="font-medium" style={{ color: 'var(--theme-text)' }}>
                    ${currentSessionCost.toFixed(4)}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" style={{ color: 'var(--theme-text-muted)' }}>
              <Zap size={14} />
              <span>Total:</span>
              <span className="font-medium" style={{ color: 'var(--theme-text)' }}>
                {overallStats.totalTokens.toLocaleString()} tokens
              </span>
              {overallStats.totalCost > 0 && (
                <>
                  <span className="mx-1 opacity-60">•</span>
                  <Coins size={14} />
                  <span className="font-medium" style={{ color: 'var(--theme-text)' }}>
                    ${overallStats.totalCost.toFixed(4)}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={handleExportMarkdown}
              disabled={messages.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--theme-button-inactive-bg)',
                color: 'var(--theme-button-inactive-text)',
              }}
              title="Export chat as Markdown"
            >
              <Download size={14} />
              Export as MD
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comparingMessages && (
          <div 
            className="mx-auto max-w-4xl mb-4 p-3 rounded-lg border-2 flex items-center justify-between"
            style={{
              backgroundColor: 'var(--theme-stats-bg)',
              borderColor: 'var(--theme-accent)',
            }}
          >
            <div className="flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
              <RefreshCw size={18} className="animate-spin" />
              <span className="font-medium">Compare responses: Select which version to keep</span>
            </div>
            <button
              onClick={() => {
                // Cancel comparison: remove the new message, keep the old one
                onMessagesChange((prev) => prev.filter((m) => m.id !== comparingMessages.newId));
                setComparingMessages(null);
              }}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors hover:opacity-90"
              style={{
                backgroundColor: 'var(--theme-button-inactive-bg)',
                color: 'var(--theme-button-inactive-text)',
              }}
            >
              Cancel
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-center mt-8" style={{ color: 'var(--theme-text-muted)' }}>
            Start a conversation by typing a message below
          </div>
        )}
        {messages.map((message) => {
          const isInComparison = comparingMessages && 
            (message.id === comparingMessages.oldId || message.id === comparingMessages.newId);
          const isOldMessage = comparingMessages && message.id === comparingMessages.oldId;
          
          return (
          <div
            key={message.id}
            ref={openMenuId === message.id ? menuRef : undefined}
            className={`group flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${
              isInComparison ? 'mb-2' : ''
            }`}
          >
            <div className={`relative ${editingMessageId === message.id ? 'max-w-[95%] w-full' : 'max-w-[80%]'}`}>
              {editingMessageId === message.id ? (
                <div
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: message.role === 'user' ? 'var(--theme-user-bubble)' : 'var(--theme-assistant-bubble)',
                    color: message.role === 'user' ? '#fff' : 'var(--theme-assistant-bubble-text)',
                  }}
                >
                  <textarea
                    ref={editTextareaRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSaveEdit();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelEdit();
                      }
                    }}
                    className="w-full min-h-[120px] p-3 rounded resize-none overflow-y-auto scrollbar-hide focus:outline-none focus:ring-2 focus:ring-opacity-50 text-[0.9375rem] leading-[1.6] whitespace-pre-wrap"
                    style={{
                      backgroundColor: message.role === 'user' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      color: message.role === 'user' ? '#fff' : 'var(--theme-assistant-bubble-text)',
                      borderColor: message.role === 'user' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                    }}
                    autoFocus
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors hover:opacity-90"
                      style={{
                        backgroundColor: message.role === 'user' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                        color: message.role === 'user' ? '#fff' : 'var(--theme-assistant-bubble-text)',
                      }}
                    >
                      <Check size={14} />
                      Save (Ctrl+Enter)
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors hover:opacity-90"
                      style={{
                        backgroundColor: message.role === 'user' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                        color: message.role === 'user' ? '#fff' : 'var(--theme-assistant-bubble-text)',
                      }}
                    >
                      <X size={14} />
                      Cancel (Esc)
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`rounded-lg p-3 ${isInComparison ? 'pr-3' : 'pr-10'} ${
                    streamingMessageId === message.id ? 'streaming-bubble' : ''
                  } ${isInComparison ? 'border-2' : ''}`}
                  style={{
                    backgroundColor: message.role === 'user' ? 'var(--theme-user-bubble)' : 'var(--theme-assistant-bubble)',
                    color: message.role === 'user' ? '#fff' : 'var(--theme-assistant-bubble-text)',
                    borderColor: isInComparison 
                      ? (isOldMessage ? 'rgba(59, 130, 246, 0.5)' : 'rgba(34, 197, 94, 0.5)')
                      : 'transparent',
                  }}
                >
                  {isInComparison && message.role === 'assistant' && (
                    <div className="mb-2 pb-2 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                      <div className="text-xs font-semibold opacity-80">
                        {isOldMessage ? 'Original Response' : 'New Response'}
                      </div>
                    </div>
                  )}
                  {streamingMessageId === message.id && message.role === 'assistant' ? (
                    <div className="whitespace-pre-wrap streaming-text">
                      {message.content}
                    </div>
                  ) : message.role === 'assistant' ? (
                    <div className="chat-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                  {isInComparison && message.role === 'assistant' && !streamingMessageId && (
                    <div className="mt-3 pt-2 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                      <button
                        onClick={() => handleSelectMessage(message.id)}
                        className="w-full px-3 py-2 rounded text-sm font-medium transition-colors hover:opacity-90"
                        style={{
                          backgroundColor: isOldMessage 
                            ? 'rgba(59, 130, 246, 0.3)' 
                            : 'rgba(34, 197, 94, 0.3)',
                          color: '#fff',
                        }}
                      >
                        <Check size={16} className="inline mr-1.5" />
                        Keep this one
                      </button>
                    </div>
                  )}
                </div>
              )}
              {editingMessageId !== message.id && !isInComparison && (
                <div className="absolute top-2 right-2 flex items-center gap-0.5">
                  <button
                    onClick={() => setOpenMenuId((id) => (id === message.id ? null : message.id))}
                    className="p-1.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none transition-opacity hover:opacity-100 hover:bg-[var(--theme-bg-panel-hover)]"
                    style={{ color: 'var(--theme-text-muted)' }}
                    title="Message options"
                    aria-expanded={openMenuId === message.id}
                  >
                    <MoreVertical size={18} />
                  </button>
                {openMenuId === message.id && (
                  <div
                    className="absolute right-0 top-full mt-1 py-1 w-56 rounded-lg shadow-xl z-10 origin-top-right border"
                    style={{
                      backgroundColor: 'var(--theme-stats-bg)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    {message.role === 'user' && (
                      <>
                        <button
                          onClick={() => handleRerun(message.id)}
                          disabled={isLoading}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-t-lg transition-colors hover:bg-[var(--theme-bg-panel-hover)] disabled:opacity-50"
                          style={{ color: 'var(--theme-text)' }}
                          title="Resend this message with the same model"
                        >
                          <RotateCw size={16} />
                          Rerun (same model)
                        </button>
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            setRerunWithModelMessageId(message.id);
                          }}
                          disabled={isLoading}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--theme-bg-panel-hover)] disabled:opacity-50"
                          style={{ color: 'var(--theme-text)' }}
                          title="Resend this message with a different model"
                        >
                          <RefreshCw size={16} />
                          Rerun with different model
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleStartEdit(message.id)}
                      disabled={streamingMessageId === message.id}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--theme-bg-panel-hover)] disabled:opacity-50 disabled:cursor-not-allowed ${
                        message.role === 'user' ? '' : 'rounded-t-lg'
                      }`}
                      style={{ color: 'var(--theme-text)' }}
                    >
                      <Edit size={16} />
                      Edit message
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--theme-bg-panel-hover)]"
                      style={{ color: 'var(--theme-text)' }}
                    >
                      <Trash2 size={16} />
                      Delete this message
                    </button>
                    <button
                      onClick={() => handleDeleteMessageAndBelow(message.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-b-lg transition-colors hover:bg-[var(--theme-bg-panel-hover)]"
                      style={{ color: 'var(--theme-text)' }}
                    >
                      <Trash2 size={16} />
                      Delete this and all below
                    </button>
                  </div>
                )}
                </div>
              )}
            </div>
          </div>
        )})}
        {isLoading && !streamingMessageId && (
          <div className="flex justify-start">
            <div
              className="rounded-lg p-3"
              style={{ backgroundColor: 'var(--theme-assistant-bubble)', color: 'var(--theme-assistant-bubble-text)' }}
            >
              <Loader2 className="animate-spin" size={20} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t p-4" style={{ borderColor: 'var(--theme-border)' }}>
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              onInputChange?.(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 rounded-lg px-4 py-2 focus:outline-none focus:border-2 focus:border-[var(--theme-accent)] border resize-none min-h-[42px] max-h-[200px] overflow-y-auto scrollbar-hide"
            style={{
              backgroundColor: 'var(--theme-input-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-input-text)',
            }}
            disabled={isLoading}
          />
          {streamingMessageId ? (
            <button
              onClick={handleStop}
              className="text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors hover:opacity-90"
              style={{ backgroundColor: '#ef4444' }}
              onMouseDown={(e) => {
              // Prevent button from taking focus away from textarea
              e.preventDefault();
            }}
            >
              <Square size={20} />
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: 'var(--theme-accent)' }}
              onMouseDown={(e) => {
              // Prevent button from taking focus away from textarea
              e.preventDefault();
            }}
            >
              <Send size={20} />
            </button>
          )}
        </div>
      </div>

      <ModelPickerModal
        isOpen={rerunWithModelMessageId !== null}
        onClose={() => setRerunWithModelMessageId(null)}
        onSelect={(modelId: string) => {
          if (rerunWithModelMessageId) handleRerun(rerunWithModelMessageId, modelId);
        }}
        currentModel={model}
        title="Rerun with different model"
        confirmLabel="Rerun"
      />
    </div>
  );
}
