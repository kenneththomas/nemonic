import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Loader2, Coins, Zap, MoreVertical, Trash2 } from 'lucide-react';
import { Message } from '../types';
import { chatWithOpenRouterStream, OpenRouterMessage } from '../services/openrouter';
import { loadAPIKey, loadDocuments, loadMemories, loadSystemPrompt, trackModelUsage, loadModelUsage, loadLLMSettings, incrementMemoryUseCount } from '../services/storage';
import { retrieveRelevantChunks } from '../services/rag';

interface ChatProps {
  conversationId: string | null;
  messages: Message[];
  onMessagesChange: (next: Message[] | ((prev: Message[]) => Message[])) => void;
  selectedMemories: string[];
  selectedDocuments: string[];
  model: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessageId]);

  // Auto-resize textarea as user types
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const h = Math.max(42, Math.min(el.scrollHeight, 200));
    el.style.height = `${h}px`;
  }, [input]);

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

  // Calculate overall stats
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
  }, [calculateCost]);

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
    
    // Keep focus on textarea after sending
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    // Create assistant message placeholder for streaming (outside try block for error handling)
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    try {
      const apiKey = loadAPIKey();
      if (!apiKey) {
        throw new Error('API key not set. Please configure it in settings.');
      }

      // Build context from selected memories and documents
      let contextMessages: OpenRouterMessage[] = [];

      // Add custom system prompt if set
      const systemPrompt = loadSystemPrompt();
      if (systemPrompt.trim()) {
        contextMessages.push({
          role: 'system',
          content: systemPrompt,
        });
      }

      // Add selected memories
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

      // Add RAG context from selected documents
      if (selectedDocuments.length > 0) {
        const allDocuments = loadDocuments();
        const selectedDocs = allDocuments.filter(d => 
          selectedDocuments.includes(d.metadata.fileName)
        );
        
        if (selectedDocs.length > 0) {
          const relevantChunks = await retrieveRelevantChunks(input, selectedDocs, 5);
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

      // Add conversation history
      const conversationMessages: OpenRouterMessage[] = messages
        .slice(-10) // Last 10 messages for context
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      const allMessages = [...contextMessages, ...conversationMessages, {
        role: 'user' as const,
        content: input,
      }];

      const llmSettings = loadLLMSettings();
      
      onMessagesChange((prev) => [...prev, assistantMessage]);
      setStreamingMessageId(assistantMessageId);

      // Use streaming API
      await chatWithOpenRouterStream(
        apiKey,
        {
          model,
          messages: allMessages,
          ...llmSettings,
        },
        {
          onChunk: (content) => {
            // Update message content incrementally
            onMessagesChange((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + content }
                  : msg
              )
            );
          },
          onComplete: (usage) => {
            console.log('onComplete called with usage:', usage);
            setStreamingMessageId(null);
            
            // Track model usage
            const promptTokens = usage.prompt_tokens || 0;
            const completionTokens = usage.completion_tokens || 0;
            const totalTokens = usage.total_tokens || 0;
            
            console.log('Token counts:', { promptTokens, completionTokens, totalTokens });
            
            // Ensure we have pricing before tracking (it should be loaded by now)
            const pricingToStore = modelPricing || undefined;
            
            trackModelUsage(
              model, 
              totalTokens,
              promptTokens,
              completionTokens,
              pricingToStore
            );
            
            // Update current session stats
            setCurrentSessionTokens(prev => {
              const newTotal = prev + totalTokens;
              console.log('Updating session tokens:', prev, '+', totalTokens, '=', newTotal);
              return newTotal;
            });
            // Calculate cost using the pricing we're storing (or current modelPricing)
            const cost = pricingToStore 
              ? calculateCost(promptTokens, completionTokens, pricingToStore)
              : 0;
            setCurrentSessionCost(prev => prev + cost);
          },
          onError: (error) => {
            setStreamingMessageId(null);
            // Update message with error
            onMessagesChange((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: `Error: ${error.message || 'Failed to get response'}` }
                  : msg
              )
            );
          },
        }
      );
    } catch (error: any) {
      setStreamingMessageId(null);
      // If we have a streaming message, update it with error, otherwise create new error message
      onMessagesChange((prev) => {
        const hasStreamingMessage = prev.some(m => m.id === assistantMessageId);
        if (hasStreamingMessage) {
          return prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${error.message || 'Failed to get response'}` }
              : msg
          );
        } else {
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Error: ${error.message || 'Failed to get response'}`,
            timestamp: Date.now(),
          };
          return [...prev, errorMessage];
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

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
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-8" style={{ color: 'var(--theme-text-muted)' }}>
            Start a conversation by typing a message below
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            ref={openMenuId === message.id ? menuRef : undefined}
            className={`group flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="relative max-w-[80%]">
              <div
                className="rounded-lg p-3 pr-10"
                style={{
                  backgroundColor: message.role === 'user' ? 'var(--theme-user-bubble)' : 'var(--theme-assistant-bubble)',
                  color: message.role === 'user' ? '#fff' : 'var(--theme-assistant-bubble-text)',
                }}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
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
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-t-lg transition-colors hover:bg-[var(--theme-bg-panel-hover)]"
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
            </div>
          </div>
        ))}
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
        </div>
      </div>
    </div>
  );
}
