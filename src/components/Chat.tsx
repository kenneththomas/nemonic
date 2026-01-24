import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Loader2, Coins, Zap } from 'lucide-react';
import { Message } from '../types';
import { chatWithOpenRouter, OpenRouterMessage } from '../services/openrouter';
import { loadAPIKey, loadDocuments, loadMemories, loadSystemPrompt, trackModelUsage, loadModelUsage } from '../services/storage';
import { retrieveRelevantChunks } from '../services/rag';

interface ChatProps {
  conversationId: string | null;
  messages: Message[];
  onMessagesChange: (next: Message[] | ((prev: Message[]) => Message[])) => void;
  selectedMemories: string[];
  selectedDocuments: string[];
  model: string;
}

export default function Chat({
  conversationId,
  messages,
  onMessagesChange,
  selectedMemories,
  selectedDocuments,
  model,
}: ChatProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionTokens, setCurrentSessionTokens] = useState(0);
  const [currentSessionCost, setCurrentSessionCost] = useState(0);
  const [modelPricing, setModelPricing] = useState<{ prompt: number; completion: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      // Calculate cost using stored pricing if available, otherwise use current model pricing
      const promptTokens = u.totalPromptTokens || 0;
      const completionTokens = u.totalCompletionTokens || 0;
      
      if (u.pricing && promptTokens > 0 && completionTokens > 0) {
        totalCost += calculateCost(promptTokens, completionTokens, u.pricing);
      } else if (modelPricing && promptTokens > 0 && completionTokens > 0) {
        // Fallback to current model pricing if stored pricing not available
        totalCost += calculateCost(promptTokens, completionTokens, modelPricing);
      } else if (modelPricing) {
        // Last resort: estimate using current model pricing (for old data without breakdown)
        const estimatedCost = (u.totalTokens / 1000000) * 
          ((modelPricing.prompt + modelPricing.completion) / 2);
        totalCost += estimatedCost;
      }
    });
    
    return { totalTokens, totalCost };
  }, [modelPricing, calculateCost]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    onMessagesChange((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

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

      const response = await chatWithOpenRouter(apiKey, {
        model,
        messages: allMessages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      // Track model usage
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const totalTokens = response.usage?.total_tokens || 0;
      
      trackModelUsage(
        model, 
        totalTokens,
        promptTokens,
        completionTokens,
        modelPricing || undefined
      );
      
      // Update current session stats
      setCurrentSessionTokens(prev => prev + totalTokens);
      const cost = calculateCost(promptTokens, completionTokens);
      setCurrentSessionCost(prev => prev + cost);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.choices[0]?.message?.content || 'No response',
        timestamp: Date.now(),
      };

      onMessagesChange((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get response'}`,
        timestamp: Date.now(),
      };
      onMessagesChange((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset session stats when switching conversations
  useEffect(() => {
    setCurrentSessionTokens(0);
    setCurrentSessionCost(0);
  }, [conversationId]);

  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      <div className="border-b border-gray-700 bg-gray-900 px-4 py-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-gray-400">
              <Zap size={14} />
              <span>Session:</span>
              <span className="text-white font-medium">{currentSessionTokens.toLocaleString()} tokens</span>
              {currentSessionCost > 0 && (
                <>
                  <span className="text-gray-500 mx-1">•</span>
                  <Coins size={14} />
                  <span className="text-white font-medium">${currentSessionCost.toFixed(4)}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Zap size={14} />
            <span>Total:</span>
            <span className="text-white font-medium">{overallStats.totalTokens.toLocaleString()} tokens</span>
            {overallStats.totalCost > 0 && (
              <>
                <span className="text-gray-500 mx-1">•</span>
                <Coins size={14} />
                <span className="text-white font-medium">${overallStats.totalCost.toFixed(4)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            Start a conversation by typing a message below
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg p-3">
              <Loader2 className="animate-spin" size={20} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type your message..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
