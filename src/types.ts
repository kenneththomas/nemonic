export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Memory {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  tags?: string[];
  /** Number of times this memory was used (selected when sending). Default 0. */
  useCount?: number;
  /** Words or phrases that, when typed in chat, suggest this memory (flash/shake, move to top). */
  triggerWords?: string[];
}

export interface Model {
  id: string;
  name: string;
  provider: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    fileName: string;
    chunkIndex: number;
    timestamp: number;
  };
  embedding?: number[];
}

export interface ChatContext {
  messages: Message[];
  selectedMemories: string[];
  selectedDocuments: string[];
  model: string;
}
