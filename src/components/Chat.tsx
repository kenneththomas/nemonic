import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Message } from '../types';
import { chatWithOpenRouter, OpenRouterMessage } from '../services/openrouter';
import { loadAPIKey, loadModel, saveMessages, loadMessages, loadDocuments, loadMemories } from '../services/storage';
import { retrieveRelevantChunks } from '../services/rag';

interface ChatProps {
  selectedMemories: string[];
  selectedDocuments: string[];
  model: string;
}

export default function Chat({ selectedMemories, selectedDocuments, model }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>(loadMessages());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = loadAPIKey();
      if (!apiKey) {
        throw new Error('API key not set. Please configure it in settings.');
      }

      // Build context from selected memories and documents
      let contextMessages: OpenRouterMessage[] = [];

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

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.choices[0]?.message?.content || 'No response',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get response'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
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
